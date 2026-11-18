// NEON TIDE v6-rebuild-2 — render.js
// three.js renderer: the city, the chase camera, every moving thing.
// Physics and logic live in XZ; three.js only draws them. Shadows are off
// under ?noshadow=1 (headless swiftshader runs ~4 fps with shadows on).
import { lightLevels, isNight } from './weather.js';
import { districtAt } from './config.js';
import { heliSpot } from './helicopter.js';

let R = null; // renderer bundle, created once by initRenderer

export function initRenderer(S) {
  const canvas = document.getElementById('game-canvas');
  const noShadow = new URLSearchParams(location.search).has('noshadow');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = !noShadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x87b5e0, 120, 420);
  const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 900);
  camera.position.set(0, 10, -20);
  const hemi = new THREE.HemisphereLight(0x99aaff, 0x221133, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.5);
  sun.position.set(120, 180, -60);
  sun.castShadow = !noShadow;
  if (!noShadow) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  }
  scene.add(sun);
  scene.add(sun.target);

  // Ground + roads.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2300, 1600),
    new THREE.MeshStandardMaterial({ color: 0x2e2e38, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.9 });
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
  // Beach strip (south) and sea plane beyond it.
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(2260, 60),
    new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.03, 745);
  scene.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 300),
    new THREE.MeshStandardMaterial({ color: 0x1a4a6b, roughness: 0.4, metalness: 0.3 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.01, 920);
  scene.add(sea);
  // Runway.
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(420, 40),
    new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.85 }));
  runway.rotation.x = -Math.PI / 2; runway.position.set(880, 0.03, -620);
  scene.add(runway);
  // Silent Pier deck: 0.4 thick, top at y=0.4, so sentry vision cones
  // drawn at y=1.0 stay visible above it.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 0.4, 130),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }));
  pier.position.set(-1040, 0.2, 685);
  scene.add(pier);
  // Parked plane on the runway (fuselage + wings + tail), scaled up and
  // angled across the runway so it reads clearly from the chase camera.
  const plane = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 46),
    // Near-white, almost no metal: a metal fuselage reads navy-black on its
    // shadow side, which hid the plane in the first runway shot.
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

  // Buildings: one mesh each (a few hundred), neon edge strips on Neon Mile.
  const buildingMeshes = [];
  for (const b of S.world.buildings) {
    const mat = new THREE.MeshStandardMaterial({
      color: b.color, roughness: 0.85,
      emissive: b.lit ? 0x111122 : 0x000000,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    m.position.set(b.x, b.h / 2, b.z);
    m.castShadow = !noShadow;
    m.receiveShadow = true;
    scene.add(m);
    buildingMeshes.push(m);
    // Lit window strips: two glowing bands on tall buildings.
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
  // Casino pylon: 3x22 sign on the FRONT side of the casino (z + d/2 + 6),
  // plus a glowing cap — visible from the road, never hidden behind the roof.
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
  // Street lamps: poles + warm pools of light on the ground.
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x333338 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  for (const L of S.lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), lampPoleMat);
    pole.position.set(L.x, 3.5, L.z);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlowMat);
    bulb.position.set(L.x, 7, L.z);
    scene.add(bulb);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.07 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(L.x, 0.05, L.z);
    scene.add(pool);
  }

  R = {
    renderer, scene, camera, hemi, sun,
    carMeshes: new Map(), pedMeshes: new Map(), enemyMeshes: new Map(),
    playerMesh: null, heliMesh: null, heliCone: null,
    beacon: null, markerMesh: null, crateMeshes: new Map(),
    spikeMesh: null, rainPoints: null, rainGeo: null,
    camPos: new THREE.Vector3(0, 10, -20),
    camLook: new THREE.Vector3(0, 1, 0),
  };
  buildPlayerMesh(S);
  buildHeliMesh(S);
  buildRain(S);
  return R;
}

// Player on foot: a visible third-person character (teal jacket, dark jeans).
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
  // Spotlight cone: apex at the heli, base on the ground (radius 6, len 28).
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

// One car mesh per car id (traffic, parked, cruisers, player car).
function carMeshFor(car) {
  let m = R.carMeshes.get(car.id);
  if (m) return m;
  const g = new THREE.Group();
  const isBike = car.type === 'bike';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(isBike ? 0.9 : 2.1, isBike ? 0.7 : 0.75, isBike ? 3.4 : 4.6),
    new THREE.MeshStandardMaterial({ color: car.color, metalness: 0.65, roughness: 0.3 }));
  body.position.y = isBike ? 0.7 : 0.55;
  body.castShadow = true;
  g.add(body);
  if (!isBike) {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x101024, metalness: 0.8, roughness: 0.2 }));
    cabin.position.set(0, 1.2, -0.2);
    g.add(cabin);
  } else {
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2d78, roughness: 0.7 }));
    rider.position.y = 1.35;
    g.add(rider);
  }
  if (car.type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.65, -0.2);
    g.add(bar);
    R.cruiserBar = bar;
  }
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
  // Health bar above the head (billboarded by facing the camera each frame).
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.8 }));
  barBg.position.y = 3.3; g.add(barBg);
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  barFg.position.set(0, 3.3, 0.01); g.add(barFg);
  g.userData.barFg = barFg;
  g.userData.barBg = barBg;
  // Sentry vision cone: a flat triangle on the ground, apex at the sentry,
  // 44 wide, 70 long, at y=1.0 (above the 0.4 pier deck). Built directly in
  // local XZ so it points along the group's +z (the sentry's coneDir).
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

// Snap the chase camera to a shot pose (used by shots.js): the camera starts
// exactly at the shot position instead of lerping in from the origin, which
// used to leave the first screenshot dark and far away.
export function snapCamera(S, pos, look) {
  R.camPos.set(pos.x, pos.y, pos.z);
  R.camLook.set(look.x, look.y, look.z);
  R.camera.position.copy(R.camPos);
  R.camera.lookAt(R.camLook);
}

export function updateRender(S, dt) {
  if (!R) return;
  const P = S.player;
  // Lighting follows the clock; night is bright (hemi 1.05 / sun 0.45).
  const L = lightLevels(S);
  R.hemi.intensity = L.hemi;
  R.sun.intensity = L.sun;
  R.scene.background.setHex(L.sky);
  R.scene.fog.color.setHex(L.sky);
  R.renderer.setClearColor(L.sky);
  // Chase camera: behind the player's heading, 16 back, 8 up.
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
  // Keep the sun target near the player so shadows stay local.
  R.sun.position.set(P.x + 120, 180, P.z - 60);
  R.sun.target.position.set(P.x, 0, P.z);
  R.sun.target.updateMatrixWorld();

  // Player mesh (hidden while driving).
  const pm = R.playerMesh;
  pm.visible = P.onFoot;
  if (P.onFoot) {
    pm.position.set(P.x, 0, P.z);
    pm.rotation.y = P.heading;
  }
  // All cars: parked, traffic, cruisers, roadblock, player car.
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
  }
  for (const [id, m] of R.carMeshes) if (!seenCars.has(id)) m.visible = false;
  // Pedestrians.
  const seenPeds = new Set();
  for (const ped of S.peds) {
    let m = R.pedMeshes.get(ped.id);
    if (!m) {
      m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x777777 + Math.floor(Math.random() * 0x888888), roughness: 0.8 }));
      body.position.y = 1.2; m.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xd8a878 }));
      head.position.y = 2.3; m.add(head);
      R.scene.add(m);
      R.pedMeshes.set(ped.id, m);
    }
    seenPeds.add(ped.id);
    m.position.set(ped.x, 0, ped.z);
    m.rotation.y = ped.heading;
    m.visible = true;
  }
  for (const [id, m] of R.pedMeshes) if (!seenPeds.has(id)) m.visible = false;
  // Enemies (with health bars that face the camera, and sentry cones).
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
  // Mission marker: pulsing beacon cylinder (26 tall, slim) + floating diamond.
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
  // Crates.
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
  // Spike strip.
  if (S.spike) {
    if (!R.spikeMesh) {
      R.spikeMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 2),
        new THREE.MeshStandardMaterial({ color: 0x111111 }));
      R.scene.add(R.spikeMesh);
    }
    R.spikeMesh.visible = true;
    R.spikeMesh.position.set(S.spike.x, 0.3, S.spike.z);
  } else if (R.spikeMesh) R.spikeMesh.visible = false;
  // Heli + spotlight.
  const H = S.heli;
  R.heliMesh.visible = H.active;
  if (H.active) {
    R.heliMesh.position.set(H.x, H.y, H.z);
    R.heliRotor.rotation.y = H.rotor;
    R.heliStrobe.material.color.setHex(H.strobe < 0.1 ? 0xffffff : 0x333333);
    const spot = heliSpot(S);
    R.heliCone.visible = !!spot;
  }
  // Rain: points drift around the camera; density follows intensity.
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
