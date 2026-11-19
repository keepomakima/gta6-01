// NEON TIDE v7 "Golden Hour" — world.js
// v7: each building carries a facade index (shared canvas window texture),
// a warm district-tinted palette, and rooftop props; the world also places
// palm trees, traffic lights, billboards and benches for the street layer.
import { RNG } from './random.js';
import { SEED, districtAt } from './config.js';

// Warm sun-soaked palettes per district — no more flat navy boxes.
const PALETTES = {
  Downtown: [0x8a6a4a, 0x6a5a7a, 0x7a6a5a, 0x9a7a5a, 0x5a6a8a, 0xa88a6a],
  Harbor: [0x6b4a30, 0x5a3a2a, 0x7a5a3a, 0x4a3a2c],
  Beachfront: [0xe8d8b0, 0xd8c098, 0x8ac2c2, 0xe8b898, 0xc2d8d8],
  'Old Town': [0xa87848, 0x986838, 0xb08a58, 0x885838],
  Suburbs: [0xc2a878, 0xb89868, 0xd8c098, 0xa88a6a],
  Airfield: [0x777780, 0x666670, 0x888890],
  'Neon Mile': [0x8a2a6a, 0x6a1a5a, 0xa83a7a, 0x4a2a6a],
  Marina: [0x4a7a8a, 0x3a6a7a, 0x5a8a9a, 0x6a8a7a],
};

export function buildWorld() {
  const rng = new RNG(SEED);
  const buildings = [];
  for (let bx = -1000; bx <= 1000; bx += 200) {
    for (let bz = -700; bz <= 700; bz += 200) {
      const cx = bx + 100, cz = bz + 100;
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
        const palette = PALETTES[district] || PALETTES.Downtown;
        buildings.push({
          x, z, w, d, h,
          color: rng.pick(palette),
          district,
          lit: rng.chance(0.85), // 85% of windows lit at night
          facade: rng.int(0, 5), // shared canvas window texture
          roof: rng.pick(['ac', 'antenna', 'tower', 'none', 'ac']),
        });
      }
    }
  }
  const casino = { x: 300, z: 500, w: 120, d: 70, h: 26, color: 0x8a1a5a, district: 'Neon Mile', lit: true, casino: true, facade: 2, roof: 'none' };
  buildings.push(casino);
  buildings.push({ x: -950, z: 100, w: 60, d: 130, h: 16, color: 0x6b4a30, district: 'Harbor', lit: true, facade: 0, roof: 'ac' });
  buildings.push({ x: -950, z: -300, w: 60, d: 110, h: 14, color: 0x5a3a2a, district: 'Harbor', lit: true, facade: 1, roof: 'none' });
  buildings.push({ x: 1020, z: -700, w: 150, d: 40, h: 18, color: 0x777780, district: 'Airfield', lit: true, facade: 3, roof: 'antenna' });

  // Palm trees along the Beachfront and Marina shore roads.
  const palms = [];
  for (let x = -1000; x <= 1000; x += 100) {
    palms.push({ x, z: 720 });
    if (x % 200 === 0) palms.push({ x: x + 50, z: 690 });
  }
  for (let z = 500; z <= 700; z += 100) palms.push({ x: -1080, z });

  // Traffic lights at the busiest downtown intersections.
  const lights = [];
  for (const [x, z] of [[0, 0], [200, 0], [-200, 200], [0, -200], [400, 200], [-400, -200], [200, 400], [0, 400]]) {
    lights.push({ x: x + 15, z: z + 15, phase: (x + z) % 2 === 0 ? 0 : 1 });
  }

  // Billboards: big ad faces on the Neon Mile and Downtown.
  const billboards = [
    { x: 200, z: 430, ry: 0, text: 'TIDE', sub: 'CASINO • NEON MILE', bg: '#ff2d78', fg: '#ffffff' },
    { x: -100, z: 180, ry: Math.PI / 2, text: 'NEON GT', sub: 'ROSA\u2019S GARAGE', bg: '#00e5ff', fg: '#10202a' },
    { x: 400, z: 100, ry: -Math.PI / 2, text: 'PORT SOLANO', sub: 'GOLDEN HOUR, EVERY HOUR', bg: '#ffb36b', fg: '#3a2410' },
    { x: 0, z: -100, ry: 0, text: 'HEAT WAVE', sub: 'SURVIVE THE CHASE', bg: '#ff8844', fg: '#ffffff' },
  ];

  // Benches along the Beachfront boardwalk and the club plaza.
  const benches = [];
  for (let x = -800; x <= 800; x += 200) benches.push({ x, z: 700 });
  benches.push({ x: 20, z: 120 }, { x: -20, z: 120 });

  return {
    buildings,
    casino,
    palms,
    lights,
    billboards,
    benches,
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

export function isOnRoad(x, z) {
  const rx = Math.abs(x - Math.round(x / 200) * 200);
  const rz = Math.abs(z - Math.round(z / 200) * 200);
  return rx <= 13 || rz <= 13;
}

// Lamps stand MID-BLOCK (offset 100 along the road from each intersection),
// never at the intersection corners: the chase camera trails 16 units
// behind the car on the road line, and a corner lamp 2.5 units from the
// camera rendered as a giant cream blob that filled the whole frame.
export function streetLamps() {
  const lamps = [];
  for (let x = -1000; x <= 1000; x += 200) {
    for (let z = -600; z <= 600; z += 200) lamps.push({ x: x + 14, z: z + 100 });
  }
  for (let z = -600; z <= 600; z += 200) {
    for (let x = -1000; x <= 1000; x += 200) lamps.push({ x: x + 100, z: z + 14 });
  }
  return lamps;
}
