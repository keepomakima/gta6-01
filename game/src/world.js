// NEON TIDE v4 — world: Port Solano itself. Roads, blocks, buildings, beach,
// harbor, props, palms, neon signs. One job: generate the city and answer
// collision queries against it.
import { WORLD_W, WORLD_H, districtAt } from './config.js';

// Road centrelines: verticals and horizontals every ~400 px.
export const ROADS_X = [220, 620, 1020, 1420, 1820, 2220];
export const ROADS_Y = [220, 520, 820, 1120, 1420, 1680];
export const ROAD_HALF = 34;

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF + 14) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_HALF + 14) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bx = x; let by = y; let bd = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; bx = rx; by = y; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; bx = x; by = ry; }
  }
  return { x: bx, y: by };
}

export function buildWorld(rng) {
  const buildings = [];
  const props = [];
  const palms = [];
  const signs = [];
  const containers = [];
  const blockW = 400;
  const blockH = 300;

  // Buildings fill the blocks between roads; the beach strip and harbor
  // yard stay open. Each building gets lit windows and a neon sign downtown.
  for (let bx = 0; bx < 6; bx += 1) {
    for (let by = 0; by < 5; by += 1) {
      const x0 = 260 + bx * 400;
      const y0 = 260 + by * 300;
      if (x0 > 2240) continue; // beachfront strip: palms + boardwalk, no blocks
      if (by === 4 && bx < 2) continue; // harbor yard: containers instead
      const d = districtAt(x0 + 100, y0 + 100);
      const tall = d.name === 'DOWNTOWN';
      const n = tall ? 2 : rng.int(1, 3);
      for (let i = 0; i < n; i += 1) {
        const bw = rng.range(70, 130);
        const bh = rng.range(60, 110);
        // Keep buildings clear of the road bands: the next road centre is
        // 360 px right / 260 px down from the block origin, its band 40 px
        // wide, so a building must end at most 320 px right / 220 px down.
        const px = x0 + rng.range(10, Math.max(11, 320 - bw));
        const py = y0 + rng.range(10, Math.max(11, 220 - bh));
        const palette = ['#3d5a80', '#6d6875', '#8d6b9e', '#2f3e46', '#7f4f24', '#4a6fa5', '#5c6650'];
        buildings.push({
          x: px, y: py, w: bw, h: bh,
          color: rng.pick(palette),
          tall,
          roof: rng.pick(['#2b2d42', '#3a3a3a', '#465362']),
          windows: rng.int(6, 18),
          lit: rng.range(0.3, 0.8),
        });
      }
      if (tall && rng.chance(0.7)) {
        signs.push({
          x: x0 + rng.range(20, 300), y: y0 + rng.range(20, 240),
          text: rng.pick(['NEON', 'TIDE', 'KESTREL', 'PIER 9', 'SOLANO', 'BAR 88', 'HOTEL', 'CASINO']),
          color: rng.pick(['#ff5d8f', '#39c6ff', '#ffd166', '#7dff8a', '#ff7ad9']),
        });
      }
      // Street props: lamps, hydrants, planters along the block edge.
      const np = rng.int(2, 5);
      for (let i = 0; i < np; i += 1) {
        props.push({
          x: x0 + rng.range(0, 360), y: y0 + rng.range(0, 260),
          kind: rng.pick(['lamp', 'hydrant', 'planter', 'bench', 'bin']),
        });
      }
    }
  }

  // Harbor containers, stacked in rows.
  for (let i = 0; i < 26; i += 1) {
    containers.push({
      x: 300 + (i % 8) * 90 + rng.range(-8, 8),
      y: 1500 + Math.floor(i / 8) * 55 + rng.range(-6, 6),
      w: 78, h: 44,
      color: rng.pick(['#e07a5f', '#81b29a', '#f2cc8f', '#3d8bfd', '#b5838d']),
    });
  }

  // Beachfront palms along the boardwalk and the sand.
  for (let i = 0; i < 34; i += 1) {
    palms.push({
      x: rng.range(2280, 2560),
      y: 140 + i * 48 + rng.range(-12, 12),
      lean: rng.range(-0.3, 0.3),
      size: rng.range(0.8, 1.3),
    });
  }
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: rng.range(2000, 2220), y: rng.range(200, 1600), lean: rng.range(-0.3, 0.3), size: rng.range(0.8, 1.2) });
  }

  return { buildings, props, palms, signs, containers };
}

export function rectBlocked(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  for (const c of world.containers) {
    if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
  }
  if (x < 20 + r || x > WORLD_W - 20 - r || y < 20 + r || y > WORLD_H - 20 - r) return true;
  return false;
}

export function pointBlocked(world, x, y, r) { return rectBlocked(world, x, y, r); }

// Two axle points (front/back) so a car can slide along a wall instead of
// sticking on its centre circle.
export function carBlocked(world, x, y, angle, halfLen, halfWid) {
  const fx = x + Math.cos(angle) * halfLen;
  const fy = y + Math.sin(angle) * halfLen;
  const bx = x - Math.cos(angle) * halfLen;
  const by = y - Math.sin(angle) * halfLen;
  return rectBlocked(world, fx, fy, halfWid + 2) || rectBlocked(world, bx, by, halfWid + 2);
}
