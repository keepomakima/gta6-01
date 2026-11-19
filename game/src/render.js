// NEON TIDE v7-coverfix — render.js (structural pass)
// three.js draws the golden-hour city and the chase camera. All physics
// and logic live in XZ; this file only turns state into meshes. Shadows
// switch off under ?noshadow=1 (headless swiftshader crawls with them).
// Sky dome with a low amber sun disc, ACES tone mapping, warm fog,
// canvas window facades (lit at night), rooftop props, palms, traffic
// lights, billboards, benches, headlights/taillights, a NOS flame, and
// animated pedestrians.
// Cover-fix: a staged camera used to live for exactly one frame —
// updateRender consumed camSnap and then lerped back to the default
// chase position, so the v7 cover was really the high trailing camera,
// not the framing shots.js asked for. While shotMode is on, the staged
// camera now holds every frame; live play never sets camSnap, so the
// chase lerp is untouched. Parked helis can also be yawed toward the
// lens (helicopter.js): the mesh faces north by default, which shows
// the rotor end-on from a west-facing chase camera.
import { isGoldenHour, isNight, lightLevels } from './weather.js';
import { GOLDEN_HOUR, districtAt } from './config.js';
import { heliSpot } from './helicopter.js';
import { drawPeds } from './pedestrians.js';

let R = null; // renderer bundle, created once by initRenderer

// Shared canvas factory for the facade and billboard textures.
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// One shared canvas facade texture per variant: a dark wall with a grid
// of windows, a little over half lit warm. Buildings tint it with their
// district colour when the material is built.
function makeFacadeTexture(v) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4c5c';
  g.fillRect(0, 0, 128, 256);
  let s = 1234 + v * 777;
  function rnd() { s = (s * 16807) % 2147483647; return s / 2147483647; }
  let y = 0;
  while (y < 9) {
    let x = 0;
    while (x < 6) {
      if (rnd() < 0.55) {
        if (rnd() < 0.7) g.fillStyle = '#ffd27a';
        else g.fillStyle = '#9ad8ff';
      } else g.fillStyle = '#23252f';
      g.fillRect(8 + x * 20, 12 + y * 27, 13, 18);
      x += 1;
    }
    y += 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A billboard face: big headline, small subline, flat brand colours.
function makeBillboardTexture(b) {
  const c = makeCanvas(512, 160);
  const g = c.getContext('2d');
  g.fillStyle = b.bg;
  g.fillRect(0, 0, 512, 160);
  g.fillStyle = b.fg;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(b.text, 256, 78);
  g.font = 'bold 26px Arial, sans-serif';
  g.fillText(b.sub, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Lerp a Vector3 toward a plain {x, y, z} target by fraction k.
function lerpToward(v, t, k) {
  v.x += (t.x - v.x) * k;
  v.y += (t.y - v.y) * k;
  v.z += (t.z - v.z) * k;
}

export function initRenderer(S) {
  const canvas = document.getElementById('game-canvas');
  const flat = new URLSearchParams(location.search).has('noshadow');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = !flat;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8975a);
  scene.fog = new THREE.Fog(0xe8975a, 150, 700);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);
  camera.position.set(0, 10, -20);
  const hemiL = new THREE.HemisphereLight(0xffd9a0, 0x3a2a2a, 0.85);
  scene.add(hemiL);
  const sunL = new THREE.DirectionalLight(GOLDEN_HOUR.sunColor, 1.35);
  sunL.position.set(-260, GOLDEN_HOUR.sunHeight, -80);
  sunL.castShadow = !flat;
  if (!flat) {
    sunL.shadow.mapSize.set(1024, 1024);
    sunL.shadow.camera.left = -160;
    sunL.shadow.camera.right = 160;
    sunL.shadow.camera.top = 160;
    sunL.shadow.camera.bottom = -160;
  }
  scene.add(sunL);
  scene.add(sunL.target);

  // Gradient sky dome: amber at the horizon, dusk blue overhead.
  const skyU = {
    topColor: { value: new THREE.Color(0x3a5a8a) },
    bottomColor: { value: new THREE.Color(0xffc07a) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 14),
    new THREE.ShaderMaterial({
      uniforms: skyU,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vP; void main(){ float h = clamp(vP.y / 900.0 * 1.6 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.8)), 1.0); }',
    }));
  scene.add(sky);
  // Low amber sun disc, parked in the west sky at golden hour.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, fog: false }));
  disc.position.set(-800, 95, -260);
  scene.add(disc);

  const groundM = new THREE.Mesh(
    new THREE.PlaneGeometry(2300, 1600),
    new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 0.95 }));
  groundM.rotation.x = -Math.PI / 2;
  groundM.receiveShadow = true;
  scene.add(groundM);
  const roadM = new THREE.MeshStandardMaterial({ color: 0x232228, roughness: 0.9 });
  let rx = -1000;
  while (rx <= 1000) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(26, 1560), roadM);
    r.rotation.x = -Math.PI / 2;
    r.position.set(rx, 0.02, 0);
    scene.add(r);
    rx += 200;
  }
  let rz = -700;
  while (rz <= 700) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2260, 26), roadM);
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.02, rz);
    scene.add(r);
    rz += 200;
  }
  // Sidewalk strips: pale edges along every road so pedestrians read as
  // walking on sidewalks instead of standing in the asphalt.
  const walkM = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1 });
  rx = -1000;
  while (rx <= 1000) {
    [-16, 16].forEach((off) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 1560), walkM);
      w.rotation.x = -Math.PI / 2;
      w.position.set(rx + off, 0.03, 0);
      scene.add(w);
    });
    rx += 200;
  }
  const beachM = new THREE.Mesh(new THREE.PlaneGeometry(2260, 60),
    new THREE.MeshStandardMaterial({ color: 0xd8b878, roughness: 1 }));
  beachM.rotation.x = -Math.PI / 2;
  beachM.position.set(0, 0.03, 745);
  scene.add(beachM);
  const seaM = new THREE.Mesh(new THREE.PlaneGeometry(2400, 300),
    new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.25, metalness: 0.4 }));
  seaM.rotation.x = -Math.PI / 2;
  seaM.position.set(0, 0.01, 920);
  scene.add(seaM);
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(420, 40),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.85 }));
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(880, 0.03, -620);
  scene.add(tarmac);
  const pierM = new THREE.Mesh(new THREE.BoxGeometry(120, 0.4, 130),
    new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 }));
  pierM.position.set(-1040, 0.2, 685);
  scene.add(pierM);
  const jet = new THREE.Group();
  const fusM = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 46),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.05, roughness: 0.5 }));
  fusM.position.y = 4;
  jet.add(fusM);
  const wingM = new THREE.Mesh(new THREE.BoxGeometry(52, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d8e8, metalness: 0.05, roughness: 0.5 }));
  wingM.position.y = 3;
  jet.add(wingM);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff3355, metalness: 0.4, roughness: 0.4 }));
  fin.position.set(0, 8, -21);
  jet.add(fin);
  jet.scale.setScalar(1.6);
  jet.rotation.y = 0.6;
  jet.position.set(850, 0, -600);
  scene.add(jet);

  // Buildings: window facades, rooftop props, neon edges on Neon Mile.
  const facadeTex = [];
  for (let i = 0; i < 6; i += 1) facadeTex.push(makeFacadeTexture(i));
  const acMat = new THREE.MeshStandardMaterial({ color: 0x777780, roughness: 0.9 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 });
  S.world.buildings.forEach((bd) => {
    const m = new THREE.MeshStandardMaterial({
      // The facade texture is multiplied by this colour: lighten the
      // district colour toward white so facades read as buildings,
      // not black slabs.
      map: facadeTex[bd.facade % 6],
      color: new THREE.Color(bd.color).lerp(new THREE.Color(0xffffff), 0.4),
      roughness: 0.85,
      emissive: bd.lit ? 0x111122 : 0x000000,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bd.w, bd.h, bd.d), m);
    mesh.position.set(bd.x, bd.h / 2, bd.z);
    mesh.castShadow = !flat;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // Rooftop props: AC units, antennas, water towers.
    switch (bd.roof) {
      case 'ac': {
        const acU = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), acMat);
        acU.position.set(bd.x + bd.w * 0.2, bd.h + 1, bd.z);
        scene.add(acU);
        break;
      }
      case 'antenna': {
        const antM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 10, 6), acMat);
        antM.position.set(bd.x, bd.h + 5, bd.z);
        scene.add(antM);
        break;
      }
      case 'tower': {
        const tankM = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 5, 10), tankMat);
        tankM.position.set(bd.x - bd.w * 0.2, bd.h + 3.5, bd.z);
        scene.add(tankM);
        const coneM = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.5, 10), tankMat);
        coneM.position.set(bd.x - bd.w * 0.2, bd.h + 7, bd.z);
        scene.add(coneM);
        break;
      }
      default: break;
    }
    if (bd.lit && bd.h > 20) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(bd.w + 0.3, 0.8, bd.d + 0.3),
        new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      edge.position.set(bd.x, bd.h * 0.62, bd.z);
      scene.add(edge);
    }
    if (bd.district === 'Neon Mile') {
      let neonColor = 0x00e5ff;
      if (Math.random() < 0.5) neonColor = 0xff2d78;
      const neonM = new THREE.Mesh(new THREE.BoxGeometry(bd.w + 0.4, 0.7, bd.d + 0.4),
        new THREE.MeshBasicMaterial({ color: neonColor }));
      neonM.position.set(bd.x, bd.h + 0.5, bd.z);
      scene.add(neonM);
    }
  });
  const casino = S.world.casino;
  const pylonM = new THREE.Mesh(new THREE.BoxGeometry(3, 22, 3),
    new THREE.MeshStandardMaterial({ color: 0x222228 }));
  pylonM.position.set(casino.x, 11, casino.z + casino.d / 2 + 6);
  scene.add(pylonM);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3),
    new THREE.MeshBasicMaterial({ color: 0xff2d78 }));
  cap.position.set(casino.x, 22, casino.z + casino.d / 2 + 6);
  scene.add(cap);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  sign.position.set(casino.x, 19, casino.z + casino.d / 2 + 6);
  scene.add(sign);
  // Street lamps: poles, warm bulbs, pools of light on the ground.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333338 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.07 });
  S.lamps.forEach((lamp) => {
    const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6.5, 6), poleMat);
    poleM.position.set(lamp.x, 3.25, lamp.z);
    scene.add(poleM);
    const bulbM = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), glowMat);
    bulbM.position.set(lamp.x, 6.5, lamp.z);
    scene.add(bulbM);
    const poolM = new THREE.Mesh(new THREE.CircleGeometry(9, 16), poolMat);
    poolM.rotation.x = -Math.PI / 2;
    poolM.position.set(lamp.x, 0.05, lamp.z);
    scene.add(poolM);
  });
  // Palm trees along the shore: trunk plus five drooping fronds.
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const frondM = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.9 });
  S.world.palms.forEach((pl) => {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 7), trunkM);
    trunk.position.y = 4.5;
    trunk.castShadow = true;
    grp.add(trunk);
    for (let fi = 0; fi < 5; fi += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 4), frondM);
      const ang = (fi / 5) * Math.PI * 2;
      frond.position.set(Math.sin(ang) * 2.2, 9.4, Math.cos(ang) * 2.2);
      frond.rotation.z = Math.sin(ang) * 1.1;
      frond.rotation.x = -Math.cos(ang) * 1.1;
      grp.add(frond);
    }
    grp.position.set(pl.x, 0, pl.z);
    scene.add(grp);
  });
  // Traffic lights at downtown intersections: pole plus a 3-light head.
  const tlMeshes = [];
  const tlPoleM = new THREE.MeshStandardMaterial({ color: 0x222228 });
  S.world.lights.forEach((L) => {
    const grp = new THREE.Group();
    const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 6), tlPoleM);
    poleM.position.y = 4;
    grp.add(poleM);
    const headM = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 1), new THREE.MeshStandardMaterial({ color: 0x111114 }));
    headM.position.y = 8.4;
    grp.add(headM);
    const lamps = [];
    [0, 1, 2].forEach((i) => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x331111 }));
      bulb.position.set(0, 9.4 - i * 1.0, 0.55);
      grp.add(bulb);
      lamps.push(bulb);
    });
    grp.position.set(L.x, 0, L.z);
    scene.add(grp);
    tlMeshes.push({ bulbs: lamps, phase: L.phase });
  });
  // Billboards with painted canvas ads.
  S.world.billboards.forEach((bb) => {
    const grp = new THREE.Group();
    const boardM = new THREE.Mesh(new THREE.PlaneGeometry(40, 13),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(bb) }));
    boardM.position.y = 16;
    grp.add(boardM);
    const postM = new THREE.MeshStandardMaterial({ color: 0x333338 });
    [-14, 14].forEach((off) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 10, 6), postM);
      post.position.set(off, 5, 0);
      grp.add(post);
    });
    grp.position.set(bb.x, 0, bb.z);
    grp.rotation.y = bb.ry;
    scene.add(grp);
  });
  // Benches on the boardwalk and the club plaza.
  const benchM = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 });
  S.world.benches.forEach((bench) => {
    const grp = new THREE.Group();
    const seatM = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 1.4), benchM);
    seatM.position.y = 1;
    grp.add(seatM);
    const backM = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.3), benchM);
    backM.position.set(0, 1.8, -0.6);
    grp.add(backM);
    grp.position.set(bench.x, 0, bench.z);
    scene.add(grp);
  });

  R = {
    renderer: renderer,
    scene: scene,
    camera: camera,
    hemi: hemiL,
    sun: sunL,
    sky: sky,
    skyUniforms: skyU,
    sunDisc: disc,
    lampGlowMat: glowMat,
    lampPoolMat: poolMat,
    lightMeshes: tlMeshes,
    carMeshes: new Map(),
    pedMeshes: new Map(),
    enemyMeshes: new Map(),
    playerMesh: null,
    heliMesh: null,
    heliCone: null,
    beacon: null,
    markerMesh: null,
    crateMeshes: new Map(),
    spikeMesh: null,
    rainPoints: null,
    rainGeo: null,
    nosFlameMesh: null,
    camPos: new THREE.Vector3(0, 10, -20),
    camLook: new THREE.Vector3(0, 1, 0),
  };
  buildPlayerMesh(S);
  buildNosFlame(S);
  buildHeliMesh(S);
  buildRain(S);
  return R;
}

export function snapCamera(S, pos, look) {
  R.camPos.copy(pos);
  R.camLook.copy(look);
  R.camera.position.copy(R.camPos);
  R.camera.lookAt(R.camLook);
}

export function updateRender(S, dt) {
  if (!R) return;
  const pl = S.player;
  // Lighting follows the clock; golden hour is warm and low.
  const lv = lightLevels(S);
  R.hemi.intensity = lv.hemi;
  R.sun.intensity = lv.sun;
  R.sun.color.setHex(lv.sunColor);
  R.scene.background.setHex(lv.sky);
  R.scene.fog.color.setHex(lv.sky);
  R.renderer.setClearColor(lv.sky);
  // Sky dome colours: amber horizon at golden hour, blue by day, dark
  // at night. The sun disc only shows at golden hour.
  if (lv.golden) {
    R.skyUniforms.topColor.value.setHex(0x2e4a7a);
    R.skyUniforms.bottomColor.value.setHex(0xffc07a);
    R.sunDisc.visible = true;
    R.sunDisc.material.color.setHex(0xffd28a);
  } else {
    if (isNight(S)) {
      R.skyUniforms.topColor.value.setHex(0x05050f);
      R.skyUniforms.bottomColor.value.setHex(0x1a1a33);
      R.sunDisc.visible = false;
    } else {
      R.skyUniforms.topColor.value.setHex(0x4a90d8);
      R.skyUniforms.bottomColor.value.setHex(0xbfe0f0);
      R.sunDisc.visible = false;
    }
  }
  R.sky.position.set(pl.x, 0, pl.z);
  R.sunDisc.position.set(pl.x - 800, 95, pl.z - 260);
  R.sunDisc.lookAt(R.camera.position);
  // Lamp glow strengthens at night; traffic lights cycle on an 8s clock.
  const dark = isNight(S);
  if (dark) R.lampGlowMat.color.setHex(0xffe2a0);
  else R.lampGlowMat.color.setHex(0xcfc2a0);
  if (dark) R.lampPoolMat.opacity = 0.14;
  else R.lampPoolMat.opacity = 0.05;
  const phase = Math.floor(S.time / 4) % 2;
  for (const sig of R.lightMeshes) {
    let lit = 2;
    if ((sig.phase + phase) % 2 === 0) lit = 0; // green or red lit
    for (let i = 0; i < sig.bulbs.length; i += 1) {
      const b = sig.bulbs[i];
      let col = 0x331111;
      if (i === lit) {
        if (i === 0) col = 0xff2222;
        else col = 0x33ff66;
      }
      b.material.color.setHex(col);
    }
  }
  const sx = Math.sin(pl.heading), sz = Math.cos(pl.heading);
  const wantPos = { x: pl.x - sx * 16, y: 8.5, z: pl.z - sz * 16 };
  const wantLook = { x: pl.x + sx * 10, y: 1.5, z: pl.z + sz * 10 };
  if (S.camSnap) {
    // Cover-fix: a staged camera used to be consumed on the first frame
    // and the chase lerp took over, so staged framings never survived
    // to the screenshot. In shot mode the snap now holds every frame;
    // live play never sets camSnap, so the lerp below is untouched.
    snapCamera(S, S.camSnap.pos, S.camSnap.look);
    if (!S.shotMode) S.camSnap = null;
  } else {
    let ease = dt * 4;
    if (ease > 1) ease = 1;
    lerpToward(R.camPos, wantPos, ease);
    lerpToward(R.camLook, wantLook, ease);
  }
  const sh = S.shake || 0;
  R.camera.position.set(
    R.camPos.x + (Math.random() - 0.5) * sh * 2,
    R.camPos.y + (Math.random() - 0.5) * sh,
    R.camPos.z + (Math.random() - 0.5) * sh * 2);
  R.camera.lookAt(R.camLook);
  // Keep the sun near the player so shadows stay local; low and west at
  // golden hour for long shadows, high at midday.
  let sunY = 180;
  if (lv.golden) sunY = GOLDEN_HOUR.sunHeight;
  else if (dark) sunY = 60;
  R.sun.position.set(pl.x - 260, sunY, pl.z - 80);
  R.sun.target.position.set(pl.x, 0, pl.z);
  R.sun.target.updateMatrixWorld();

  const playerM = R.playerMesh;
  playerM.visible = pl.onFoot;
  if (pl.onFoot) {
    playerM.position.set(pl.x, 0, pl.z);
    playerM.rotation.y = pl.heading;
  }
  const cars = S.parked.concat(S.traffic, S.cruisers, S.roadblock || []);
  if (pl.car) cars.push(pl.car);
  const shown = new Set();
  cars.forEach((c) => {
    if (c.cond <= 0 && c.ai !== 'traffic') return;
    const mesh = carMeshFor(c);
    shown.add(c.id);
    mesh.position.set(c.x, 0, c.z);
    mesh.rotation.y = c.heading;
    mesh.visible = true;
    if (c === pl.car) mesh.position.y = 0.1;
    // Headlights glow after dark; the cruiser light bar flashes.
    if (dark) mesh.userData.headMat.color.setHex(0xfff6c0);
    else mesh.userData.headMat.color.setHex(0x8a8a7a);
    if (c.type === 'cruiser' && R.cruiserBar) {
      let barColor = 0x2266ff;
      if (Math.floor(S.time * 4) % 2 === 0) barColor = 0xff2222;
      R.cruiserBar.material.color.setHex(barColor);
    }
  });
  R.carMeshes.forEach((m, id) => { if (!shown.has(id)) m.visible = false; });
  // Pedestrians: animated walk cycle, varied clothes — pedestrians.js.
  drawPeds(R, S);
  // NOS flame behind the player's car while boosting.
  if (R.nosFlameMesh) {
    const show = Boolean(S.nosFlame && pl.car);
    R.nosFlameMesh.visible = show;
    if (show) {
      R.nosFlameMesh.position.set(
        pl.car.x - Math.sin(pl.car.heading) * 3.4, 0.7,
        pl.car.z - Math.cos(pl.car.heading) * 3.4);
      R.nosFlameMesh.rotation.y = pl.car.heading;
    }
  }
  const shownE = new Set();
  S.enemies.forEach((foe) => {
    const mesh = enemyMeshFor(foe);
    shownE.add(foe.id);
    mesh.position.set(foe.x, 0, foe.z);
    if (foe.kind === 'sentry') mesh.rotation.y = foe.coneDir;
    else mesh.rotation.y = foe.heading;
    mesh.visible = true;
    const frac = Math.max(0, foe.hp / foe.maxHp);
    mesh.userData.barFg.scale.x = frac;
    mesh.userData.barFg.position.x = -1.05 * (1 - frac);
    mesh.userData.barFg.lookAt(R.camera.position);
    mesh.userData.barBg.lookAt(R.camera.position);
  });
  R.enemyMeshes.forEach((m, id) => { if (!shownE.has(id)) m.visible = false; });
  const ms = S.missions;
  if (ms.marker) {
    if (!R.beacon) {
      R.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 26, 12),
        new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.18 }));
      R.scene.add(R.beacon);
    }
    R.beacon.visible = !S.shotHideBeacon;
    R.beacon.position.set(ms.marker.x, 13, ms.marker.z);
    R.beacon.material.opacity = 0.14 + 0.08 * Math.sin(S.time * 4);
  } else if (R.beacon) R.beacon.visible = false;
  const shownC = new Set();
  if (ms.crates) {
    ms.crates.forEach((crate) => {
      if (crate.taken) return;
      let m = R.crateMeshes.get(crate.id);
      if (!m) {
        m = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3),
          new THREE.MeshStandardMaterial({ color: 0xcc9933, roughness: 0.6 }));
        m.position.y = 1;
        R.scene.add(m);
        R.crateMeshes.set(crate.id, m);
      }
      shownC.add(crate.id);
      m.position.set(crate.x, 1, crate.z);
      m.rotation.y = S.time * 0.8;
      m.visible = true;
    });
  }
  R.crateMeshes.forEach((m, id) => { if (!shownC.has(id)) m.visible = false; });
  if (S.spike) {
    if (!R.spikeMesh) {
      R.spikeMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 2),
        new THREE.MeshStandardMaterial({ color: 0x111111 }));
      R.scene.add(R.spikeMesh);
    }
    R.spikeMesh.visible = true;
    R.spikeMesh.position.set(S.spike.x, 0.3, S.spike.z);
  } else if (R.spikeMesh) R.spikeMesh.visible = false;
  const heli = S.heli;
  R.heliMesh.visible = heli.active;
  if (heli.active) {
    R.heliMesh.position.set(heli.x, heli.y, heli.z);
    // Parked shots yaw the heli toward the lens (cover-fix): live play
    // never sets a yaw, so this stays 0 outside staged frames.
    if (heli.yaw) R.heliMesh.rotation.y = heli.yaw;
    else R.heliMesh.rotation.y = 0;
    R.heliRotor.rotation.y = heli.rotor;
    if (heli.strobe < 0.1) R.heliStrobe.material.color.setHex(0xffffff);
    else R.heliStrobe.material.color.setHex(0x333333);
    const beam = heliSpot(S);
    R.heliCone.visible = !!beam;
  }
  if (R.rainPoints) {
    R.rainPoints.visible = S.weather.rain > 0.05;
    if (R.rainPoints.visible) {
      R.rainPoints.material.opacity = 0.2 + 0.4 * S.weather.rain;
      const arr = R.rainGeo.attributes.position.array;
      let idx = 0;
      while (idx < arr.length) {
        arr[idx + 1] -= 55 * dt;
        if (arr[idx + 1] < 0) arr[idx + 1] = 40;
        idx += 3;
      }
      R.rainGeo.attributes.position.needsUpdate = true;
      R.rainPoints.position.set(pl.x, 0, pl.z);
    }
  }
  R.renderer.render(R.scene, R.camera);
}

function buildPlayerMesh(S) {
  const grp = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x0f8a7a, roughness: 0.7 }));
  top.position.y = 1.35;
  top.castShadow = true;
  grp.add(top);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.7 }));
  headM.position.y = 2.5;
  grp.add(headM);
  const legsM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222233 }));
  legsM.position.y = 0.5;
  grp.add(legsM);
  R.scene.add(grp);
  R.playerMesh = grp;
}

function buildHeliMesh(S) {
  const grp = new THREE.Group();
  const bodyM = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 7),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 }));
  grp.add(bodyM);
  const tailM = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  tailM.position.set(0, 0.4, -5.5);
  grp.add(tailM);
  const rotorM = new THREE.Mesh(new THREE.BoxGeometry(12, 0.15, 1),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotorM.position.y = 1.4;
  grp.add(rotorM);
  R.heliRotor = rotorM;
  const strobeM = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobeM.position.set(0, -1.2, 3.4);
  grp.add(strobeM);
  R.heliStrobe = strobeM;
  const tailM2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tailM2.position.set(0, 0.6, -8);
  grp.add(tailM2);
  const coneG = new THREE.ConeGeometry(6, 28, 20, 1, true);
  const coneM = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
  coneM.position.y = -14;
  grp.add(coneM);
  R.heliCone = coneM;
  R.scene.add(grp);
  R.heliMesh = grp;
  grp.visible = false;
}

function buildRain(S) {
  const count = 900;
  const arr = new Float32Array(count * 3);
  let i = 0;
  while (i < count) {
    arr[i * 3] = (Math.random() - 0.5) * 220;
    arr[i * 3 + 1] = Math.random() * 40;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 220;
    i += 1;
  }
  const geoM = new THREE.BufferGeometry();
  geoM.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const ptsM = new THREE.Points(geoM, new THREE.PointsMaterial({
    color: 0xaaccff, size: 0.35, transparent: true, opacity: 0.5 }));
  ptsM.visible = false;
  R.scene.add(ptsM);
  R.rainPoints = ptsM;
  R.rainGeo = geoM;
}

// Blue NOS flame cone behind the player's car while boosting.
function buildNosFlame(S) {
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 8),
    new THREE.MeshBasicMaterial({ color: 0x3399ff, transparent: true, opacity: 0.85 }));
  flame.rotation.x = Math.PI / 2;
  flame.visible = false;
  R.scene.add(flame);
  R.nosFlameMesh = flame;
}

// Vans and trucks get a taller box body, taxis a roof sign, every car
// gets headlights (white, front) and taillights (red, rear) that glow
// after dark.
function carMeshFor(car) {
  let mesh = R.carMeshes.get(car.id);
  if (mesh) return mesh;
  const grp = new THREE.Group();
  const bike = car.type === 'bike';
  const boxy = car.type === 'van' || car.type === 'truck';
  let h = 0.75;
  if (boxy) h = 1.5;
  let bw = 2.1;
  let bl = 4.6;
  if (bike) { bw = 0.9; bl = 3.4; }
  const bodyM = new THREE.Mesh(
    new THREE.BoxGeometry(bw, h, bl),
    new THREE.MeshStandardMaterial({ color: car.color, metalness: 0.65, roughness: 0.3 }));
  if (bike) bodyM.position.y = 0.7;
  else if (boxy) bodyM.position.y = 0.95;
  else bodyM.position.y = 0.55;
  bodyM.castShadow = true;
  grp.add(bodyM);
  if (!bike && !boxy) {
    const cabinM = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x101024, metalness: 0.8, roughness: 0.2 }));
    cabinM.position.set(0, 1.2, -0.2);
    grp.add(cabinM);
  }
  if (bike) {
    const riderM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2d78, roughness: 0.7 }));
    riderM.position.y = 1.35;
    grp.add(riderM);
  }
  if (car.type === 'taxi') {
    const signM = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffc21a }));
    signM.position.set(0, 1.7, -0.2);
    grp.add(signM);
  }
  if (car.type === 'cruiser') {
    const barM = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barM.position.set(0, 1.65, -0.2);
    grp.add(barM);
    R.cruiserBar = barM;
  }
  // Headlights up front (+z is forward in the car's local frame) and
  // taillights at the rear. Shared materials, brightened at night.
  const headM = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailM = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  [-0.7, 0.7].forEach((sx) => {
    const hlM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), headM);
    let fz = 2.35;
    if (bike) fz = 1.75;
    hlM.position.set(sx, 0.55, fz);
    grp.add(hlM);
    const tlM = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), tailM);
    let rz = -2.35;
    if (bike) rz = -1.75;
    tlM.position.set(sx, 0.55, rz);
    grp.add(tlM);
  });
  grp.userData.headMat = headM;
  const wheelM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });
  const wheelG = new THREE.BoxGeometry(0.35, 0.7, 0.9);
  [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]].forEach(([px, pz]) => {
    const wheel = new THREE.Mesh(wheelG, wheelM);
    wheel.position.set(px, 0.35, pz);
    grp.add(wheel);
  });
  R.scene.add(grp);
  R.carMeshes.set(car.id, grp);
  return grp;
}

function enemyMeshFor(e) {
  let mesh = R.enemyMeshes.get(e.id);
  if (mesh) return mesh;
  let tone = 0x881111;
  if (e.kind === 'boss') tone = 0xaa1111;
  else if (e.kind === 'sentry') tone = 0xcc8800;
  const grp = new THREE.Group();
  const bodyM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshStandardMaterial({ color: tone, roughness: 0.7 }));
  bodyM.position.y = 1.35;
  bodyM.castShadow = true;
  grp.add(bodyM);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc89878 }));
  headM.position.y = 2.5;
  grp.add(headM);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.8 }));
  bg.position.y = 3.3;
  grp.add(bg);
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  fg.position.set(0, 3.3, 0.01);
  grp.add(fg);
  grp.userData.barFg = fg;
  grp.userData.barBg = bg;
  if (e.kind === 'sentry') {
    const geoM = new THREE.BufferGeometry();
    geoM.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 1.0, 0, -22, 1.0, 70, 22, 1.0, 70,
    ]), 3));
    geoM.computeVertexNormals();
    const coneM = new THREE.Mesh(geoM,
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }));
    grp.add(coneM);
    grp.userData.cone = coneM;
  }
  R.scene.add(grp);
  R.enemyMeshes.set(e.id, grp);
  return grp;
}
