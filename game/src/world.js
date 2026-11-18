// NEON TIDE v6 — the 3D city of Port Solano (three.js). Builds the whole
// scene from the seeded RNG: ground, road grid, district buildings with
// collision boxes, landmarks (harbor containers, casino neon, airfield
// runway + parked plane, pier, marina boats, beach), street lamps, rain
// points and the day/night lighting rig. Physics stays 2D on the XZ plane.
import { DISTRICTS, SEED, WORLD, ROAD_WIDTH, ROADS_X, ROADS_Z } from './config.js';
import { makeRng, clamp, lerp } from './rng.js';

const PALETTE = [0x2a2f4a, 0x3a2f4a, 0x2f4a3a, 0x4a3a2f, 0x353a4d, 0x41354d];
const NEON_COLORS = [0xff2d78, 0x00e5ff, 0xffb300, 0x7cff00, 0xff5a00];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(SEED);
    this.colliders = []; // {x0,z0,x1,z1}
    this.buildings = [];
    this.lamps = [];
    this.rain = null;
    this.rainVel = null;
    this.timeOfDay = 19.5; // dusk start, hours
    this.rainIntensity = 0;
    this._buildGround();
    this._buildRoads();
    this._buildBuildings();
    this._buildLandmarks();
    this._buildLamps();
    this._buildRain();
    this._buildLights();
  }

  _mat(color, emissive = 0x000000, eInt = 0) {
    return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: eInt });
  }
  _box(w, h, d, mat, x, y, z, collide = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = h > 4;
    m.receiveShadow = true;
    this.scene.add(m);
    if (collide) this.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return m;
  }

  _buildGround() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1900), this._mat(0x1d2419));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; this.scene.add(g);
    // Beach sand strip (south) and marina water (south-west).
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(2200, 150), this._mat(0xc9b078));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 700); sand.receiveShadow = true; this.scene.add(sand);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 150), this._mat(0x0a3a5a));
    water.rotation.x = -Math.PI / 2; water.position.set(-600, 0.06, 700); this.scene.add(water);
  }

  _buildRoads() {
    const roadMat = this._mat(0x3d3d4a);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c84a });
    for (const x of ROADS_X) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 1560), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, 0); r.receiveShadow = true; this.scene.add(r);
    }
    for (const z of ROADS_Z) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(2260, ROAD_WIDTH), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.08, z); r.receiveShadow = true; this.scene.add(r);
    }
    // Centre dashes.
    for (const x of ROADS_X) for (let z = -700; z < 700; z += 40) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 12), lineMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.1, z); this.scene.add(d);
    }
    for (const z of ROADS_Z) for (let x = -1050; x < 1050; x += 40) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), lineMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.1, z); this.scene.add(d);
    }
  }

  _districtAt(x, z) {
    for (const d of DISTRICTS) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
    return DISTRICTS[0];
  }

  _buildBuildings() {
    const rng = this.rng;
    // Blocks between roads: one or two buildings per block, kept off roads.
    for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
      for (let iz = 0; iz < ROADS_Z.length - 1; iz++) {
        const x0 = ROADS_X[ix] + ROAD_WIDTH / 2 + 12;
        const x1 = ROADS_X[ix + 1] - ROAD_WIDTH / 2 - 12;
        const z0 = ROADS_Z[iz] + ROAD_WIDTH / 2 + 12;
        const z1 = ROADS_Z[iz + 1] - ROAD_WIDTH / 2 - 12;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const d = this._districtAt(cx, cz);
        if (d.name === 'Airfield' || d.name === 'Beachfront' || d.name === 'Marina') continue;
        if (d.name === 'Harbor' && rng.chance(0.5)) continue; // container yards instead
        const n = rng.chance(0.55) ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const w = rng.range(28, Math.min(70, (x1 - x0) / n - 8));
          const dep = rng.range(24, Math.min(60, z1 - z0 - 8));
          const bx = n === 1 ? cx : x0 + (x1 - x0) * (k + 0.5) / n;
          const bz = cz + rng.range(-8, 8);
          const h = rng.range(d.hMin, d.hMax);
          const color = rng.pick(PALETTE);
          const b = this._box(w, h, dep, this._mat(color), bx, h / 2, bz, true);
          this.buildings.push(b);
          // Lit windows: bright emissive strips so the night city reads.
          if (rng.chance(0.85)) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, Math.min(3.5, h * 0.15)),
              new THREE.MeshBasicMaterial({ color: rng.chance(0.5) ? 0xffe9a8 : 0x9fd8ff }));
            win.position.set(bx, h * 0.72, bz + dep / 2 + 0.15); this.scene.add(win);
            const win2 = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, Math.min(2.5, h * 0.1)),
              new THREE.MeshBasicMaterial({ color: 0xffd27a }));
            win2.position.set(bx, h * 0.4, bz + dep / 2 + 0.15); this.scene.add(win2);
          }
          // Neon trim on Neon Mile / Downtown towers.
          if (rng.chance(d.neon)) {
            const neon = this._box(w + 0.6, 0.7, dep + 0.6,
              new THREE.MeshBasicMaterial({ color: rng.pick(NEON_COLORS) }), bx, h + 0.4, bz);
            neon.castShadow = false;
            this.buildings.push(neon);
          }
        }
      }
    }
  }

  _buildLandmarks() {
    const rng = this.rng;
    // Harbor container yard (west edge).
    const contColors = [0xc23b2e, 0x2e7dc2, 0x3fae5a, 0xd8a13a];
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-1080, -840), z = rng.range(-160, 560);
      const c = this._box(22, 7, 8, this._mat(rng.pick(contColors)), x, 3.5, z, true);
      c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    }
    // Airfield runway + parked plane (north-west).
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(420, 34), this._mat(0x3a3a44));
    runway.rotation.x = -Math.PI / 2; runway.position.set(-850, 0.09, -550); this.scene.add(runway);
    const planeBody = this._box(46, 5, 6, this._mat(0xd8d8de), -850, 4, -600, true);
    const wing = this._box(10, 1, 44, this._mat(0xb8b8c0), -850, 4.5, -600, false);
    const tail = this._box(8, 8, 1.5, this._mat(0xff3355), -872, 7, -600, false);
    void planeBody; void wing; void tail;
    // Neon Mile casino signs: three tall glowing pylons.
    const casinos = [[40, 300, 0xff2d78, 'NEON'], [160, 340, 0x00e5ff, 'TIDE'], [260, 260, 0xffb300, 'PALMS']];
    for (const [x, z, color] of casinos) {
      const pylon = this._box(3, 22, 3, new THREE.MeshBasicMaterial({ color }), x, 11, z, true);
      const cap = this._box(10, 3, 3, new THREE.MeshBasicMaterial({ color }), x, 23, z, false);
      void pylon; void cap;
    }
    // Pier (south-west) + marina boats.
    const pier = this._box(14, 2, 90, this._mat(0x6a4a2a), -960, 1, 660, false);
    void pier;
    for (let i = 0; i < 6; i++) {
      const bx = -720 + i * 52;
      const hull = this._box(16, 4, 7, this._mat(0xe8e8f0), bx, 2, 700, true);
      const mast = this._box(1, 12, 1, this._mat(0x8a8a8a), bx, 9, 700, false);
      void hull; void mast;
    }
    // Park trees in Suburbs / Beachfront.
    for (let i = 0; i < 40; i++) {
      const x = rng.range(620, 1080), z = rng.range(220, 580);
      const trunk = this._box(1.5, 5, 1.5, this._mat(0x5a3a22), x, 2.5, z, false);
      const top = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 6), this._mat(0x2f6a2f));
      top.position.set(x, 11, z); top.castShadow = true; this.scene.add(top);
      void trunk;
    }
  }

  _buildLamps() {
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const x of ROADS_X) for (const z of ROADS_Z) {
      const pole = this._box(0.8, 9, 0.8, this._mat(0x222226), x + 16, 4.5, z + 16, false);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lampMat);
      bulb.position.set(x + 16, 9.4, z + 16); this.scene.add(bulb);
      // Warm pool of light on the ground under each lamp.
      const pool = new THREE.Mesh(new THREE.CircleGeometry(13, 12),
        new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0.07 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x + 16, 0.12, z + 16); this.scene.add(pool);
      this.lamps.push(bulb);
      void pole;
    }
  }

  _buildRain() {
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 300;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 300;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fb8d8, size: 0.55, transparent: true, opacity: 0.7 }));
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x8fa8ff, 0x1a1410, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe0b3, 1.5);
    this.sun.position.set(120, 180, -60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -160; this.sun.shadow.camera.right = 160;
    this.sun.shadow.camera.top = 160; this.sun.shadow.camera.bottom = -160;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.Fog(0x0a0a18, 60, 320);
    this.scene.background = new THREE.Color(0x1a2340);
  }

  // Push a circle out of building colliders. Returns true if it hit.
  collideCircle(p, r) {
    let hit = false;
    for (const c of this.colliders) {
      const nx = clamp(p.x, c.x0, c.x1), nz = clamp(p.z, c.z0, c.z1);
      const dx = p.x - nx, dz = p.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * r; p.z = nz + (dz / d) * r;
        } else {
          p.x += r; // centre inside box: shove out on +x
        }
      }
    }
    p.x = clamp(p.x, WORLD.minX, WORLD.maxX);
    p.z = clamp(p.z, WORLD.minZ, WORLD.maxZ);
    return hit;
  }

  pointInBuilding(x, z) {
    for (const c of this.colliders) if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return true;
    return false;
  }

  update(dt, focusX, focusZ) {
    // Day/night: sun swings with the clock; night is dark blue with lamps on.
    const t = this.timeOfDay;
    const day = t > 6 && t < 19;
    const sunH = Math.sin(((t - 6) / 12) * Math.PI); // 0 at dawn/dusk, 1 at noon
    const bright = day ? 0.55 + 0.45 * Math.max(0, sunH) : 0.32;
    this.sun.intensity = day ? 0.7 + 1.1 * Math.max(0, sunH) : 0.3;
    this.sun.position.set(120 * Math.cos((t / 24) * Math.PI * 2), 60 + 140 * Math.max(0, sunH), -60);
    this.hemi.intensity = 0.55 + bright * 0.7;
    const sky = day ? new THREE.Color(0x87a8d8).lerp(new THREE.Color(0x1a2340), 1 - bright) : new THREE.Color(0x0a0a18);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    for (const l of this.lamps) l.material.color.setHex(day ? 0x555544 : 0xffe9a8);
    // Rain follows the player and falls diagonally.
    if (this.rainIntensity > 0.02) {
      this.rain.visible = true;
      this.rain.material.opacity = 0.35 + 0.45 * this.rainIntensity;
      this.rain.position.set(focusX, 0, focusZ);
      const pos = this.rain.geometry.attributes.position.array;
      const fall = 90 * dt * (0.6 + this.rainIntensity);
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] -= fall;
        pos[i] += fall * 0.22; // wind slant
        if (pos[i + 1] < 0) { pos[i + 1] = 55 + Math.random() * 5; pos[i] = (Math.random() - 0.5) * 300; pos[i + 2] = (Math.random() - 0.5) * 300; }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    } else this.rain.visible = false;
  }
}
