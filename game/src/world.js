// NEON TIDE — world.js
// Builds Port Solano: the road grid, the buildings, parks, the beach, the
// harbor containers, and the collision tests every moving thing uses.

import { DISTRICTS, ROADS_V, ROADS_H, ROAD_W, WORLD_W, WORLD_H } from './config.js';
import { makeRng, randInt, randPick, randRange } from './random.js';

// A building is an axis-aligned box with a height (for the drawn shadow and
// roof) and a colour. Containers and walls are buildings with style flags.
export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const containers = [];
  const lamps = [];

  const half = ROAD_W / 2;
  // Walk every city block between the roads and fill it.
  for (let vi = 0; vi <= ROADS_V.length; vi += 1) {
    const x0 = vi === 0 ? 40 : ROADS_V[vi - 1] + half + 14;
    const x1 = vi === ROADS_V.length ? WORLD_W - 40 : ROADS_V[vi] - half - 14;
    for (let hi = 0; hi <= ROADS_H.length; hi += 1) {
      const y0 = hi === 0 ? 40 : ROADS_H[hi - 1] + half + 14;
      const y1 = hi === ROADS_H.length ? WORLD_H - 40 : ROADS_H[hi] - half - 14;
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const roll = rng();
      if (district.style === 'beach') {
        // Beachfront: sand, a few palms, no buildings.
        for (let i = 0; i < 5; i += 1) {
          trees.push({ x: randRange(rng, x0 + 20, x1 - 20), y: randRange(rng, y0 + 20, y1 - 20), palm: true });
        }
        continue;
      }
      if (district.style === 'harbor' && cy > 1300) {
        // Harbor yard: stacked shipping containers.
        for (let i = 0; i < 6; i += 1) {
          const cw = randInt(rng, 60, 110);
          const ch = 26;
          const c = {
            x: randRange(rng, x0 + 10, x1 - cw - 10),
            y: randRange(rng, y0 + 10, y1 - ch - 10),
            w: cw, h: ch,
            color: randPick(rng, ['#a34a2e', '#2e6b8a', '#7a8a2e', '#8a2e5a', '#3e7d5a']),
            container: true,
          };
          containers.push(c);
          buildings.push(c);
        }
        continue;
      }
      if (roll < 0.14) {
        // Park block: grass + trees, walkable.
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        const n = randInt(rng, 4, 8);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: randRange(rng, x0 + 16, x1 - 16), y: randRange(rng, y0 + 16, y1 - 16), palm: false });
        }
        continue;
      }
      if (roll < 0.22) {
        // Empty lot / parking: a couple of low walls only.
        continue;
      }
      // Built block: 1 big building or a 2x2 of smaller ones.
      const tall = district.style === 'downtown';
      const palette = tall
        ? ['#5a6b8a', '#6b5a8a', '#4a5a6b', '#7a6a5a', '#3f4a63']
        : district.style === 'old'
          ? ['#8a6a4a', '#7a5a52', '#9a7a5a', '#6b5a6b']
          : ['#a08a6a', '#8a9a7a', '#9a8a7a', '#7a8a9a'];
      if (bw > 220 && bh > 220 && rng() < 0.6) {
        const cols = 2;
        const rows = 2;
        for (let gx = 0; gx < cols; gx += 1) {
          for (let gy = 0; gy < rows; gy += 1) {
            const w = bw / cols - 24;
            const h = bh / rows - 24;
            buildings.push({
              x: x0 + gx * (bw / cols) + 12,
              y: y0 + gy * (bh / rows) + 12,
              w, h,
              hgt: tall ? randInt(rng, 26, 60) : randInt(rng, 10, 22),
              color: randPick(rng, palette),
            });
          }
        }
      } else {
        buildings.push({
          x: x0 + 12, y: y0 + 12, w: bw - 24, h: bh - 24,
          hgt: tall ? randInt(rng, 30, 64) : randInt(rng, 10, 24),
          color: randPick(rng, palette),
        });
      }
    }
  }

  // Street lamps along the roads, for the night look.
  for (const rx of ROADS_V) {
    for (const ry of ROADS_H) {
      lamps.push({ x: rx + half + 6, y: ry + half + 6 });
      lamps.push({ x: rx - half - 6, y: ry - half - 6 });
    }
  }

  return { buildings, trees, parks, containers, lamps, seed };
}

// Which district contains a point.
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[1];
}

// True when the point lies inside the named district.
export function isInDistrict(x, y, name) {
  return districtAt(x, y).name === name;
}

// The district whose centre is nearest to a point (for spawn flavour).
export function nearestDistrict(x, y) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - (d.x + d.w / 2);
    const dy = y - (d.y + d.h / 2);
    const dd = dx * dx + dy * dy;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

// True when the point is on a road (asphalt).
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// True when the point is on a sidewalk (the strip just beside a road).
export function onSidewalk(x, y) {
  const half = ROAD_W / 2;
  const band = half + 16;
  for (const rx of ROADS_V) {
    if (Math.abs(x - rx) <= band && Math.abs(x - rx) > half) return true;
  }
  for (const ry of ROADS_H) {
    if (Math.abs(y - ry) <= band && Math.abs(y - ry) > half) return true;
  }
  return false;
}

// Circle vs building collision. Returns the first building hit, else null.
export function hitBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings and the world edge. Returns true if it hit.
export function resolveBuildingCollision(world, pos, r) {
  let hit = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.y = cy + (dy / d) * r;
      } else {
        pos.y = b.y - r;
      }
    }
  }
  if (pos.x < r) { pos.x = r; hit = true; }
  if (pos.y < r) { pos.y = r; hit = true; }
  if (pos.x > WORLD_W - r) { pos.x = WORLD_W - r; hit = true; }
  if (pos.y > WORLD_H - r) { pos.y = WORLD_H - r; hit = true; }
  return hit;
}

// Nearest point on any road centre line, for traffic AI and spawning.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// A random point on a road, away from a given point.
export function randomRoadPoint(rng, awayX, awayY, minDist) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = rng() < 0.5;
    const x = vertical ? randPick(rng, ROADS_V) : randRange(rng, 100, WORLD_W - 100);
    const y = vertical ? randRange(rng, 100, WORLD_H - 100) : randPick(rng, ROADS_H);
    const dx = x - awayX;
    const dy = y - awayY;
    if (dx * dx + dy * dy >= minDist * minDist) return { x, y, vertical };
  }
  return { x: ROADS_V[0], y: ROADS_H[0], vertical: true };
}
