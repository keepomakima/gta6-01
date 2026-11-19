// NEON TIDE v7 "Golden Hour" — render.js
// three.js renderer: the golden-hour city, the chase camera, every moving
// thing. Physics and logic live in XZ; three.js only draws them. Shadows
// are off under ?noshadow=1 (headless swiftshader runs ~4 fps with shadows).
// v7 vs v6r2 — the whole visual layer is new: gradient sky dome with a low
// amber sun disc, ACES tone mapping, warm fog, canvas window facades
// (lit at night), rooftop props, palm trees, traffic lights, billboards,
// benches, car headlights / taillights, a NOS flame, and animated
// pedestrians (pedestrians.js) in varied clothes.
import { lightLevels, isNight, isGoldenHour } from './weather.js';
import { districtAt, GOLDEN_HOUR } from './config.js';
import { heliSpot } from './helicopter.js';
import { drawPeds } from './pedestrians.js';

let R = null; // renderer bundle, created once by initRenderer

// One shared canvas facade texture per variant: a dark wall with a grid of
// windows, some lit warm. Buildings tint it with their district colour.
function makeFacadeTexture(variant) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a4c5c';
  ctx.fillRect(0, 0, 128, 256);
  let seed = 1234 + variant * 777;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rnd() < 0.55;
      ctx.fillStyle = lit ? (rnd() < 0.7 ? '#ffd27a' : '#9ad8ff') : '#23252f';
      ctx.fillRect(8 + col * 20, 12 + row * 27, 13, 18);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBillboardTexture(b) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = b.bg;
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = b.fg;
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.text, 256, 78);
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillText(b.sub, 256, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function initRenderer(S) {
  const canvas = document.getElementById('game-canvas');
  const noShadow = new URLSearchParams(location.search).has('noshadow');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = !noShadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8975a);
  scene.fog = new THREE.Fog(0xe8975a, 150, 700);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);
  camera.position.set(0, 10, -20);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a2a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(GOLDEN_HOUR.sunColor, 1.35);
  sun.position.set(-260, GOLDEN_HOUR.sunHeight, -80);
  sun.castShadow = !noShadow;
  if (!noShadow) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  }
  scene.add(sun);
  scene.add(sun.target);

  // Gradient sky dome: amber horizon, dusk-blue zenith at golden hour.
  const skyUniforms = {
    topColor: { value: new THREE.Color(0x3a5a8a) },
    bottomColor: { value: new THREE.Color(0xffc07a) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 14),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vP; void main(){ float h = clamp(vP.y / 900.0 * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.8)), 1.0); }',
    }));
  scene.add(sky);
  // Low amber sun disc, parked in the west sky at golden hour.
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, fog: false }));
  sunDisc.position.set(-800, 95, -260);
  scene.add(sunDisc);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2300, 1600),
    new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x232228, roughness: 0.9 });
  for (let x = -1000; x <= 1000; x += 200) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(26, 1560), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, 0);
    scene.add(r);
  }
  for (let z = -700; z <= 700; z += 200) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2260, 26), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, z);
    scene.add(r);
  }
  // Sidewalk strips: pale edges along every road so peds read as walking
  // on sidewalks, not in the middle of the asphalt.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1 });
  for (let x = -1000; x <= 1000; x += 200) {
    for (const off of [-16, 16]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 1560), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(x + off, 0.03, 0);
      scene.add(w);
    }
  }
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(2260, 60),
    new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.03, 745);
  scene.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 300),
    new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.25, metalness: 0.4 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.01, 920);
  scene.add(sea);
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(420, 40),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.85 }));
  runway.rotation.x = -Math.PI / 2; runway.position.set(880, 0.03, -620);
  scene.add(runway);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 0.4, 130),
    new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 }));
  pier.position.set(-1040, 0.2, 685);
  scene.add(pier);
  const plane = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 46),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.05, roughness: 0.5 }));
  fus.position.y = 4; plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(52, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d8e8, metalness: 0.05, roughness: 0.5 }));
  wing.position.y = 3; plane.add(wing);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff3355, metalness: 0.4, roughness: 0.4 }));
  tailFin.position.set(0, 8, -21); plane.add(tailFin);
  plane.scale.setScalar(1.6);
  plane.rotation.y = 0.6;
  plane.position.set(850, 0, -600);
  scene.add(plane);

  // Buildings: window facades + rooftop props + neon edges on Neon Mile.
  const facades = [];
  for (let i = 0; i < 6; i++) facades.push(makeFacadeTexture(i));
  const roofAcMat = new THREE.MeshStandardMaterial({ color: 0x777780, roughness: 0.9 });
  const roofTowerMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 });
  for (const b of S.world.buildings) {
    const mat = new THREE.MeshStandardMaterial({
      // Facade texture is multiplied by this colour: lighten the district
      // colour toward white so facades read as buildings, not black slabs.
      map: facades[b.facade % 6],
      color: new THREE.Color(b.color).lerp(new THREE.Color(0xffffff), 0.4),
      roughness: 0.85,
      emissive: b.lit ? 0x111122 : 0x000000,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    m.position.set(b.x, b.h / 2, b.z);
    m.castShadow = !noShadow;
    m.receiveShadow = true;
    scene.add(m);
    // Rooftop props: AC units, antennas, water towers.
    if (b.roof === 'ac') {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), roofAcMat);
      ac.position.set(b.x + b.w * 0.2, b.h + 1, b.z);
      scene.add(ac);
    } else if (b.roof === 'antenna') {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 6), roofAcMat);
      ant.position.set(b.x, b.h + 5, b.z);
      scene.add(ant);
    } else if (b.roof === 'tower') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 5, 10), roofTowerMat);
      tank.position.set(b.x - b.w * 0.2, b.h + 3.5, b.z);
      scene.add(tank);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.5, 10), roofTowerMat);
      cone.position.set(b.x - b.w * 0.2, b.h + 7, b.z);
      scene.add(cone);
    }
    if (b.lit && b.h > 20) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.8, b.d + 0.3),
        new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      strip.position.set(b.x, b.h * 0.62, b.z);
      scene.add(strip);
    }
    if (b.district === 'Neon Mile') {
      const neon = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.7, b.d + 0.4),
        new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff2d78 : 0x00e5ff }));
      neon.position.set(b.x, b.h + 0.5, b.z);
      scene.add(neon);
    }
  }
  const cb = S.world.casino;
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(3, 22, 3),
    new THREE.MeshStandardMaterial({ color: 0x222228 }));
  pylon.position.set(cb.x, 11, cb.z + cb.d / 2 + 6);
  scene.add(pylon);
  const pylonCap = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3),
    new THREE.MeshBasicMaterial({ color: 0xff2d78 }));
  pylonCap.position.set(cb.x, 22, cb.z + cb.d / 2 + 6);
  scene.add(pylonCap);
  const pylonText = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  pylonText.position.set(cb.x, 19, cb.z + cb.d / 2 + 6);
  scene.add(pylonText);
  // Street lamps: poles + warm bulbs + pools of light on the ground.
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x333338 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const lampPoolMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.07 });
  for (const L of S.lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6.5, 6), lampPoleMat);
    pole.position.set(L.x, 3.25, L.z);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lampGlowMat);
    bulb.position.set(L.x, 6.5, L.z);
    scene.add(bulb);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 16), lampPoolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(L.x, 0.05, L.z);
    scene.add(pool);
  }
  // Palm trees along the shore: trunk + five drooping fronds.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.9 });
  for (const palm of S.world.palms) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 7), trunkMat);
    trunk.position.y = 4.5; trunk.castShadow = true; g.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 4), frondMat);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(Math.sin(a) * 2.2, 9.4, Math.cos(a) * 2.2);
      frond.rotation.z = Math.sin(a) * 1.1;
      frond.rotation.x = -Math.cos(a) * 1.1;
      g.add(frond);
    }
    g.position.set(palm.x, 0, palm.z);
    scene.add(g);
  }
  // Traffic lights at downtown intersections: pole + 3-light head.
  const lightMeshes = [];
  const tlPoleMat = new THREE.MeshStandardMaterial({ color: 0x222228 });
  for (const L of S.world.lights) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 6), tlPoleMat);
    pole.position.y = 4; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 1), new THREE.MeshStandardMaterial({ color: 0x111114 }));
    head.position.y = 8.4; g.add(head);
    const lamps3 = [];
    for (let i = 0; i < 3; i++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x331111 }));
      bulb.position.set(0, 9.4 - i * 1.0, 0.55);
      g.add(bulb);
      lamps3.push(bulb);
    }
    g.position.set(L.x, 0, L.z);
    scene.add(g);
    lightMeshes.push({ bulbs: lamps3, phase: L.phase });
  }
  // Billboards with painted canvas ads.
  for (const b of S.world.billboards) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(40, 13),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(b) }));
    board.position.y = 16; g.add(board);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333338 });
    for (const px of [-14, 14]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 10, 6), postMat);
      post.position.set(px, 5, 0); g.add(post);
    }
    g.position.set(b.x, 0, b.z);
    g.rotation.y = b.ry;
    scene.add(g);
  }
  // Benches on the boardwalk and the club plaza.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 });
  for (const bn of S.world.benches) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 1.4), benchMat);
    seat.position.y = 1; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.3), benchMat);
    back.position.set(0, 1.8, -0.6); g.add(back);
    g.position.set(bn.x, 0, bn.z);
    scene.add(g);
  }

  R = {
    renderer, scene, camera, hemi, sun, sky, skyUniforms, sunDisc,
    lampGlowMat, lampPoolMat, lightMeshes,
    carMeshes: new Map(), pedMeshes: new Map(), enemyMeshes: new Map(),
    playerMesh: null, heliMesh: null, heliCone: null,
    beacon: null, markerMesh: null, crateMeshes: new Map(),
    spikeMesh: null, rainPoints: null, rainGeo: null, nosFlameMesh: null,
    camPos: new THREE.Vector3(0, 10, -20),
    camLook: new THREE.Vector3(0, 1, 0),
  };
  buildPlayerMesh(S);
  buildHeliMesh(S);
  buildRain(S);
  buildNosFlame(S);
  return R;
}

function buildPlayerMesh(S) {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x0f8a7a, roughness: 0.7 }));
  jacket.position.y = 1.35; jacket.castShadow = true; g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.7 }));
  head.position.y = 2.5; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222233 }));
  legs.position.y = 0.5; g.add(legs);
  R.scene.add(g);
  R.playerMesh = g;
}

function buildHeliMesh(S) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 7),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 }));
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  tail.position.set(0, 0.4, -5.5); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 1),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.y = 1.4; g.add(rotor);
  R.heliRotor = rotor;
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobe.position.set(0, -1.2, 3.4); g.add(strobe);
  R.heliStrobe = strobe;
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tailLight.position.set(0, 0.6, -8); g.add(tailLight);
  const coneGeo = new THREE.ConeGeometry(6, 28, 20, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.y = -14;
  g.add(cone);
  R.heliCone = cone;
  R.scene.add(g);
  R.heliMesh = g;
  g.visible = false;
}

function buildRain(S) {
  const N = 900;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 220;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xaaccff, size: 0.35, transparent: true, opacity: 0.5 }));
  pts.visible = false;
  R.scene.add(pts);
  R.rainPoints = pts;
  R.rainGeo = geo;
}

// Blue NOS flame cone behind the player's car while boosting.
function buildNosFlame(S) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 8),
    new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.85 }));
  cone.rotation.x = Math.PI / 2;
  cone.visible = false;
  R.scene.add(cone);
  R.nosFlameMesh = cone;
}

// v7: vans/trucks get a taller box body, taxis a roof sign, every car gets
// headlights (white, front) and taillights (red, rear) that glow at night.
function carMeshFor(car) {
  let m = R.carMeshes.get(car.id);
  if (m) return m;
  const g = new THREE.Group();
  const isBike = car.type === 'bike';
  const isVan = car.type === 'van' || car.type === 'truck';
  const bodyH = isVan ? 1.5 : 0.75;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(isBike ? 0.9 : 2.1, bodyH, isBike ? 3.4 : 4.6),
    new THREE.MeshStandardMaterial({ color: car.color, metalness: 0.65, roughness: 0.3 }));
  body.position.y = isBike ? 0.7 : (isVan ? 0.95 : 0.55);
  body.castShadow = true;
  g.add(body);
  if (!isBike && !isVan) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x101024, metalness: 0.8, roughness: 0.2 }));
    cabin.position.set(0, 1.2, -0.2);
    g.add(cabin);
  } else if (isBike) {
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2d78, roughness: 0.7 }));
    rider.position.y = 1.35;
    g.add(rider);
  }
  if (car.type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffc21a }));
    sign.position.set(0, 1.7, -0.2);
    g.add(sign);
  }
  if (car.type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.65, -0.2);
    g.add(bar);
    R.cruiserBar = bar;
  }
  // Headlights (front, +z is forward in the car's local frame) and
  // taillights (rear). Shared materials, brightened at night in updateRender.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const hx of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), headMat);
    hl.position.set(hx, 0.55, isBike ? 1.75 : 2.35);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), tailMat);
    tl.position.set(hx, 0.55, isBike ? -1.75 : -2.35);
    g.add(tl);
  }
  g.userData.headMat = headMat;
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
  const wheelGeo = new THREE.BoxGeometry(0.35, 0.7, 0.9);
  for (const [wx, wz] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.35, wz);
    g.add(w);
  }
  R.scene.add(g);
  R.carMeshes.set(car.id, g);
  return g;
}

function enemyMeshFor(e) {
  let m = R.enemyMeshes.get(e.id);
  if (m) return m;
  const color = e.kind === 'boss' ? 0xaa1111 : e.kind === 'sentry' ? 0xcc8800 : 0x881111;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  body.position.y = 1.35; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc89878 }));
  head.position.y = 2.5; g.add(head);
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.8 }));
  barBg.position.y = 3.3; g.add(barBg);
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  barFg.position.set(0, 3.3, 0.01); g.add(barFg);
  g.userData.barFg = barFg;
  g.userData.barBg = barBg;
  if (e.kind === 'sentry') {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 1.0, 0, -22, 1.0, 70, 22, 1.0, 70,
    ]), 3));
    geo.computeVertexNormals();
    const cone = new THREE.Mesh(geo,
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
    g.add(cone);
    g.userData.cone = cone;
  }
  R.scene.add(g);
  R.enemyMeshes.set(e.id, g);
  return g;
}

export function snapCamera(S, pos, look) {
  R.camPos.set(pos.x, pos.y, pos.z);
  R.camLook.set(look.x, look.y, look.z);
  R.camera.position.copy(R.camPos);
  R.camera.lookAt(R.camLook);
}

export function updateRender(S, dt) {
  if (!R) return;
  const P = S.player;
  // Lighting follows the clock; golden hour is warm and low.
  const L = lightLevels(S);
  R.hemi.intensity = L.hemi;
  R.sun.intensity = L.sun;
  R.sun.color.setHex(L.sunColor);
  R.scene.background.setHex(L.sky);
  R.scene.fog.color.setHex(L.sky);
  R.renderer.setClearColor(L.sky);
  // Sky dome colours: amber horizon at golden hour, blue at day, dark night.
  if (L.golden) {
    R.skyUniforms.topColor.value.setHex(0x2e4a7a);
    R.skyUniforms.bottomColor.value.setHex(0xffc07a);
    R.sunDisc.visible = true;
    R.sunDisc.material.color.setHex(0xffd28a);
  } else if (isNight(S)) {
    R.skyUniforms.topColor.value.setHex(0x05050f);
    R.skyUniforms.bottomColor.value.setHex(0x1a1a33);
    R.sunDisc.visible = false;
  } else {
    R.skyUniforms.topColor.value.setHex(0x4a90d8);
    R.skyUniforms.bottomColor.value.setHex(0xbfe0f0);
    R.sunDisc.visible = false;
  }
  R.sky.position.set(P.x, 0, P.z);
  R.sunDisc.position.set(P.x - 800, 95, P.z - 260);
  R.sunDisc.lookAt(R.camera.position);
  // Lamp glow strengthens at night; traffic lights cycle on an 8s clock.
  const night = isNight(S);
  R.lampGlowMat.color.setHex(night ? 0xffe2a0 : 0xcfc2a0);
  R.lampPoolMat.opacity = night ? 0.14 : 0.05;
  const tlPhase = Math.floor(S.time / 4) % 2;
  for (const tl of R.lightMeshes) {
    const on = (tl.phase + tlPhase) % 2 === 0 ? 0 : 2; // green or red lit
    tl.bulbs.forEach((b, i) => b.material.color.setHex(i === on ? (i === 0 ? 0xff2222 : 0x33ff66) : 0x331111));
  }
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
  const wantPos = { x: P.x - fx * 16, y: 8.5, z: P.z - fz * 16 };
  const wantLook = { x: P.x + fx * 10, y: 1.5, z: P.z + fz * 10 };
  if (S.camSnap) {
    snapCamera(S, S.camSnap.pos, S.camSnap.look);
    S.camSnap = null;
  } else {
    const k = Math.min(1, dt * 4);
    R.camPos.x += (wantPos.x - R.camPos.x) * k;
    R.camPos.y += (wantPos.y - R.camPos.y) * k;
    R.camPos.z += (wantPos.z - R.camPos.z) * k;
    R.camLook.x += (wantLook.x - R.camLook.x) * k;
    R.camLook.y += (wantLook.y - R.camLook.y) * k;
    R.camLook.z += (wantLook.z - R.camLook.z) * k;
  }
  const shake = S.shake || 0;
  R.camera.position.set(
    R.camPos.x + (Math.random() - 0.5) * shake * 2,
    R.camPos.y + (Math.random() - 0.5) * shake,
    R.camPos.z + (Math.random() - 0.5) * shake * 2);
  R.camera.lookAt(R.camLook);
  // Keep the sun near the player so shadows stay local; low and west at
  // golden hour for long shadows, high at midday.
  const sunH = L.golden ? GOLDEN_HOUR.sunHeight : (night ? 60 : 180);
  R.sun.position.set(P.x - 260, sunH, P.z - 80);
  R.sun.target.position.set(P.x, 0, P.z);
  R.sun.target.updateMatrixWorld();

  const pm = R.playerMesh;
  pm.visible = P.onFoot;
  if (P.onFoot) {
    pm.position.set(P.x, 0, P.z);
    pm.rotation.y = P.heading;
  }
  const allCars = [...S.parked, ...S.traffic, ...S.cruisers, ...(S.roadblock || [])];
  if (P.car) allCars.push(P.car);
  const seenCars = new Set();
  for (const car of allCars) {
    if (car.cond <= 0 && car.ai !== 'traffic') continue;
    const m = carMeshFor(car);
    seenCars.add(car.id);
    m.position.set(car.x, 0, car.z);
    m.rotation.y = car.heading;
    m.visible = true;
    if (car === P.car) m.position.y = 0.1;
    // Headlights glow after dark; cruiser light bar flashes.
    m.userData.headMat.color.setHex(night ? 0xfff6c0 : 0x8a8a7a);
    if (car.type === 'cruiser' && R.cruiserBar) {
      R.cruiserBar.material.color.setHex(Math.floor(S.time * 4) % 2 === 0 ? 0xff2222 : 0x2266ff);
    }
  }
  for (const [id, m] of R.carMeshes) if (!seenCars.has(id)) m.visible = false;
  // Pedestrians (animated walk cycle, varied clothes) — pedestrians.js.
  drawPeds(R, S);
  // NOS flame behind the player's car while boosting.
  if (R.nosFlameMesh) {
    const show = !!S.nosFlame && !!P.car;
    R.nosFlameMesh.visible = show;
    if (show) {
      R.nosFlameMesh.position.set(
        P.car.x - Math.sin(P.car.heading) * 3.4, 0.7,
        P.car.z - Math.cos(P.car.heading) * 3.4);
      R.nosFlameMesh.rotation.y = P.car.heading;
    }
  }
  const seenEnemies = new Set();
  for (const e of S.enemies) {
    const m = enemyMeshFor(e);
    seenEnemies.add(e.id);
    m.position.set(e.x, 0, e.z);
    m.rotation.y = e.kind === 'sentry' ? e.coneDir : e.heading;
    m.visible = true;
    const frac = Math.max(0, e.hp / e.maxHp);
    m.userData.barFg.scale.x = frac;
    m.userData.barFg.position.x = -1.05 * (1 - frac);
    m.userData.barFg.lookAt(R.camera.position);
    m.userData.barBg.lookAt(R.camera.position);
  }
  for (const [id, m] of R.enemyMeshes) if (!seenEnemies.has(id)) m.visible = false;
  const M = S.missions;
  if (M.marker) {
    if (!R.beacon) {
      R.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 26, 12),
        new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.18 }));
      R.scene.add(R.beacon);
    }
    R.beacon.visible = !S.shotHideBeacon;
    R.beacon.position.set(M.marker.x, 13, M.marker.z);
    R.beacon.material.opacity = 0.14 + 0.08 * Math.sin(S.time * 4);
  } else if (R.beacon) R.beacon.visible = false;
  const seenCrates = new Set();
  if (M.crates) {
    for (const c of M.crates) {
      if (c.taken) continue;
      let m = R.crateMeshes.get(c.id);
      if (!m) {
        m = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3),
          new THREE.MeshStandardMaterial({ color: 0xcc9933, roughness: 0.6 }));
        m.position.y = 1;
        R.scene.add(m);
        R.crateMeshes.set(c.id, m);
      }
      seenCrates.add(c.id);
      m.position.set(c.x, 1, c.z);
      m.rotation.y = S.time * 0.8;
      m.visible = true;
    }
  }
  for (const [id, m] of R.crateMeshes) if (!seenCrates.has(id)) m.visible = false;
  if (S.spike) {
    if (!R.spikeMesh) {
      R.spikeMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 2),
        new THREE.MeshStandardMaterial({ color: 0x111111 }));
      R.scene.add(R.spikeMesh);
    }
    R.spikeMesh.visible = true;
    R.spikeMesh.position.set(S.spike.x, 0.3, S.spike.z);
  } else if (R.spikeMesh) R.spikeMesh.visible = false;
  const H = S.heli;
  R.heliMesh.visible = H.active;
  if (H.active) {
    R.heliMesh.position.set(H.x, H.y, H.z);
    R.heliRotor.rotation.y = H.rotor;
    R.heliStrobe.material.color.setHex(H.strobe < 0.1 ? 0xffffff : 0x333333);
    const spot = heliSpot(S);
    R.heliCone.visible = !!spot;
  }
  if (R.rainPoints) {
    R.rainPoints.visible = S.weather.rain > 0.05;
    if (R.rainPoints.visible) {
      R.rainPoints.material.opacity = 0.2 + 0.4 * S.weather.rain;
      const pos = R.rainGeo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] -= 55 * dt;
        if (pos[i + 1] < 0) pos[i + 1] = 40;
      }
      R.rainGeo.attributes.position.needsUpdate = true;
      R.rainPoints.position.set(P.x, 0, P.z);
    }
  }
  R.renderer.render(R.scene, R.camera);
}
