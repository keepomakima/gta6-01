// NEON TIDE — world.js
// Kota Port Solano 2400x1600: grid jalan, blok bangunan, distrik, pantai,
// pelabuhan, taman, palem beachfront, papan neon bernama, dan gedung khusus
// (klub Kestrel, garasi Rosa, toko Ironworks Arms, safehouse, vault, hospital).
// Semua posisi penting ada di jalan atau area terbuka — tidak ada di gedung.
import { WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_HALF, DISTRICTS, PLACES } from './config.js';
import { mulberry32, randInt, randRange } from './random.js';

// Blok yang sengaja dibiarkan terbuka (taman / plaza / dermaga), tanpa gedung.
// Format: [x0, y0, x1, y1]. Revisi: blok Palm Court (fare C) + container yard
// dicek ulang terhadap koordinat playtest — semuanya di area terbuka.
const OPEN_BLOCKS = [
  [365, 1065, 575, 1175],   // Palm Court park — fare C (420,1120)
  [965, 865, 1175, 975],    // Rival Corner plaza — misi 5
  [1565, 1375, 2165, 1600], // Container yard pelabuhan — crate misi 10
  [0, 1465, 2400, 1600],    // Dermaga selatan — vault (320,1560)
  [2165, 0, 2400, 1600],    // Pantai timur — boss arena (2380,1300)
  [365, 265, 575, 375],     // Halaman Kestrel Club
];

function inOpen(x0, y0, x1, y1) {
  return OPEN_BLOCKS.some(([a, b, c, d]) => x0 >= a && y0 >= b && x1 <= c && y1 <= d);
}

export function buildWorld(seed = 20261118) {
  const rng = mulberry32(seed);
  const buildings = [];
  // Satu gedung per blok (kadang dua gedung kecil), inset dari tepi blok.
  for (let vi = 0; vi <= ROADS_V.length; vi += 1) {
    const x0 = vi === 0 ? 0 : ROADS_V[vi - 1] + ROAD_HALF;
    const x1 = vi === ROADS_V.length ? WORLD_W : ROADS_V[vi] - ROAD_HALF;
    for (let hi = 0; hi <= ROADS_H.length; hi += 1) {
      const y0 = hi === 0 ? 0 : ROADS_H[hi - 1] + ROAD_HALF;
      const y1 = hi === ROADS_H.length ? WORLD_H : ROADS_H[hi] - ROAD_HALF;
      if (x1 - x0 < 90 || y1 - y0 < 70) continue;
      if (inOpen(x0, y0, x1, y1)) continue;
      const downtown = x0 >= 920 && x1 <= 1865 && y0 >= 175 && y1 <= 865;
      const tall = downtown && rng() < 0.55;
      const bw = randRange(rng, (x1 - x0) * 0.45, (x1 - x0) * 0.8);
      const bh = randRange(rng, (y1 - y0) * 0.45, (y1 - y0) * 0.8);
      const bx = x0 + (x1 - x0 - bw) / 2 + randRange(rng, -8, 8);
      const by = y0 + (y1 - y0 - bh) / 2 + randRange(rng, -6, 6);
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        tall,
        hue: randInt(rng, 0, 5),
        litSeed: randInt(rng, 1, 99999),
        label: tall ? 'TOWER' : '',
      });
    }
  }

  // Gedung khusus bernama (digambar dengan papan neon di render.js).
  const landmarks = [
    { id: 'club', x: 680, y: 270, w: 170, h: 90, name: 'KESTREL', color: '#ff2e88' },
    { id: 'garage', x: 1280, y: 665, w: 170, h: 95, name: "ROSA'S GARAGE", color: '#22e6ff' },
    { id: 'gunshop', x: 990, y: 665, w: 150, h: 90, name: 'IRONWORKS ARMS', color: '#ffc233' },
    { id: 'safehouse1', x: 390, y: 480, w: 130, h: 80, name: 'PALM COURT', color: '#7dff8a' },
    { id: 'safehouse2', x: 2165, y: 540, w: 120, h: 75, name: 'BEACH HOUSE', color: '#7dff8a' },
    { id: 'stash', x: 1880, y: 1080, w: 150, h: 80, name: 'STASH', color: '#ff5a3c' },
    { id: 'hospital', x: 1400, y: 120, w: 170, h: 85, name: 'SOLANO GENERAL', color: '#ffffff' },
    { id: 'police', x: 680, y: 940, w: 150, h: 85, name: 'PSPD CENTRAL', color: '#4d8dff' },
    { id: 'motel', x: 2165, y: 1080, w: 130, h: 80, name: 'NEON TIDE MOTEL', color: '#ff2e88' },
  ];
  for (const lm of landmarks) {
    buildings.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, tall: false, hue: 2, litSeed: 7, label: lm.name, landmark: lm.id });
  }

  // Palem di beachfront (jalur x > 2180) dan sekitar Palm Court.
  const palms = [];
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: randRange(rng, 2190, 2380), y: randRange(rng, 60, 1540), s: randRange(rng, 0.8, 1.3) });
  }
  for (let i = 0; i < 8; i += 1) {
    palms.push({ x: randRange(rng, 380, 560), y: randRange(rng, 1080, 1160), s: randRange(rng, 0.8, 1.2) });
  }

  // Kontainer pelabuhan di container yard.
  const containers = [];
  for (let i = 0; i < 22; i += 1) {
    containers.push({
      x: randRange(rng, 1600, 2100), y: randRange(rng, 1400, 1560),
      w: 64, h: 26, color: ['#c94f2e', '#2e7fc9', '#c9a52e', '#3fae5a'][i % 4],
      rot: rng() < 0.5 ? 0 : Math.PI / 2,
    });
  }

  // Lampu jalan di tiap persimpangan (dipakai glow malam).
  const lamps = [];
  for (const vx of ROADS_V) for (const hy of ROADS_H) lamps.push({ x: vx + 52, y: hy - 52 });

  return { buildings, landmarks, palms, containers, lamps, seed };
}

// Apakah titik (x,y) berada di jalan (aspal)?
export function onRoad(x, y) {
  for (const vx of ROADS_V) if (Math.abs(x - vx) <= ROAD_HALF) return true;
  for (const hy of ROADS_H) if (Math.abs(y - hy) <= ROAD_HALF) return true;
  return false;
}

// Tabrakan lingkaran vs gedung: true bila titik (x,y,r) menyentuh gedung.
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Nama distrik untuk titik (x,y). Beachfront & Harbor dicek dulu (overlap).
export function districtAt(x, y) {
  if (x >= 2075) return 'Beachfront';
  if (y >= 1375) return 'Harbor';
  for (const d of DISTRICTS) {
    if (d.name === 'Beachfront' || d.name === 'Harbor') continue;
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Suburbs';
}

// Titik jalan terdekat dari (x,y) — dipakai respawn & penempatan aman.
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const vx of ROADS_V) {
    const d = Math.abs(x - vx);
    if (d < bd) { bd = d; best = { x: vx, y }; }
  }
  for (const hy of ROADS_H) {
    const d = Math.abs(y - hy);
    if (d < bd) { bd = d; best = { x, y: hy }; }
  }
  return best;
}

export { PLACES };
