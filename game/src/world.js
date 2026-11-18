// NEON TIDE v6-rebuild-2 — world.js
// Port Solano: a 2200x1500 grid city. Roads every 200 units (width 26);
// buildings live only inside the blocks between roads, so every road point
// is drivable and every mission anchor (always on a road line) is reachable.
// Deterministic from the seed: the same seed builds the same city.
import { RNG } from './random.js';
import { SEED, districtAt } from './config.js';

const PALETTE = [0x2c3050, 0x3a2c50, 0x2c4a50, 0x503a2c, 0x403050, 0x2c3a5a];

export function buildWorld() {
  const rng = new RNG(SEED);
  const buildings = [];
  // Blocks: centres at odd multiples of 100 (-900..900, -700..700).
  for (let bx = -1000; bx <= 1000; bx += 200) {
    for (let bz = -700; bz <= 700; bz += 200) {
      const cx = bx + 100, cz = bz + 100;
      // Airfield corner stays flat (runway + terminal), Marina south-west
      // keeps the pier deck clear, Neon Mile keeps the casino plaza clear.
      if (cx > 600 && cz < -400) continue;
      if (cx < -700 && cz > 500) continue;
      if (cx === 300 && cz === 500) continue; // casino plaza
      const district = districtAt(cx, cz);
      const tall = district === 'Downtown';
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const w = rng.range(28, 62), d = rng.range(28, 62);
        const ox = rng.range(-45, 45), oz = rng.range(-45, 45);
        const x = cx + ox, z = cz + oz;
        if (Math.abs(x) > 1080 || Math.abs(z) > 730) continue;
        const h = tall ? rng.range(30, 95) : rng.range(8, 34);
        buildings.push({
          x, z, w, d, h,
          color: rng.pick(PALETTE),
          district,
          lit: rng.chance(0.85), // 85% of windows lit at night
        });
      }
    }
  }
  // Casino: a wide low landmark on the Neon Mile plaza, front facing the
  // road at z=400. Its pylon sign stands on the FRONT side (z + d/2 + 6).
  const casino = { x: 300, z: 500, w: 120, d: 70, h: 26, color: 0x6b1a4a, district: 'Neon Mile', lit: true, casino: true };
  buildings.push(casino);
  // Harbor warehouses: long low blocks on the west docks.
  buildings.push({ x: -950, z: 100, w: 60, d: 130, h: 16, color: 0x4a3a2c, district: 'Harbor', lit: true });
  buildings.push({ x: -950, z: -300, w: 60, d: 110, h: 14, color: 0x3a2c22, district: 'Harbor', lit: true });
  // Airfield terminal + parked plane markers (visual only, no collision).
  // Terminal sits in the far north-east corner, clear of the runway
  // sightline (an earlier build put it mid-frame in the runway shot).
  buildings.push({ x: 1020, z: -700, w: 150, d: 40, h: 18, color: 0x555560, district: 'Airfield', lit: true });

  return {
    buildings,
    casino,
    // Silent Pier: a thin deck (0.4 thick, top y=0.4) so sentry vision
    // cones drawn at y=1.0 stay visible above it.
    pier: { x0: -1100, x1: -980, z0: 620, z1: 750, top: 0.4 },
    runway: { x0: 650, x1: 1100, z0: -750, z1: -500 },
    collideCircle(x, z, r) {
      let nx = x, nz = z;
      for (const b of buildings) {
        const hw = b.w / 2 + r, hd = b.d / 2 + r;
        if (Math.abs(nx - b.x) < hw && Math.abs(nz - b.z) < hd) {
          const px = hw - Math.abs(nx - b.x);
          const pz = hd - Math.abs(nz - b.z);
          if (px < pz) nx = b.x + (nx < b.x ? -hw : hw);
          else nz = b.z + (nz < b.z ? -hd : hd);
        }
      }
      nx = Math.max(-1090, Math.min(1090, nx));
      nz = Math.max(-740, Math.min(740, nz));
      return { x: nx, z: nz };
    },
    buildingAt(x, z) {
      for (const b of buildings) {
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return b;
      }
      return null;
    },
    onPier(x, z) {
      const p = this.pier;
      return x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;
    },
  };
}

// Is a point on a road (within the road half-width of a grid line)?
export function isOnRoad(x, z) {
  const rx = Math.abs(x - Math.round(x / 200) * 200);
  const rz = Math.abs(z - Math.round(z / 200) * 200);
  return rx <= 13 || rz <= 13;
}

// Street lamps along every road, deterministic positions for the renderer.
export function streetLamps() {
  const lamps = [];
  for (let x = -1000; x <= 1000; x += 200) {
    for (let z = -600; z <= 600; z += 200) lamps.push({ x: x + 14, z });
  }
  for (let z = -600; z <= 600; z += 200) {
    for (let x = -1000; x <= 1000; x += 200) lamps.push({ x, z: z + 14 });
  }
  return lamps;
}
