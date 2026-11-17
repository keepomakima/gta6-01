// Port Solano: the city itself. A fixed road grid with buildings, parks, a beach
// strip and a harbor yard, all placed from one seed so the map never changes.
// Collision is rectangle based: buildings, the sea and the map edge are solid.
import { BEACH, DISTRICTS, H_ROADS, ROAD_W, V_ROADS, WORLD } from './config.js';

const BUILDING_COLORS = ['#5a5f6e', '#6e5a4f', '#4f5a6e', '#7a6a55', '#5f6e5a', '#6e4f5a', '#556070'];
const ROOF_COLORS = ['#3a3f4a', '#4a3a30', '#33404f', '#4f4030', '#3f4a3f'];

// A building is a solid rectangle with a roof colour and a height used for shading.
function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    color: rng.pick(BUILDING_COLORS),
    roof: rng.pick(ROOF_COLORS),
    tall: rng.chance(0.3),
    windows: rng.int(2, 5),
  };
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const containers = [];
  const parks = [];

  // Blocks sit between neighbouring roads. Each block gets buildings, a park, or
  // (in the harbor corner) container stacks. Sidewalk margin keeps buildings off the road.
  const xs = [0, ...V_ROADS, WORLD.w];
  const ys = [0, ...H_ROADS, WORLD.h];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      // The beach strip is sand, not buildings; the harbor corner is containers.
      if (y0 > BEACH.y0 - 40) continue;
      const harborBlock = x0 > 1750 && y1 < 700;
      if (harborBlock) {
        for (let c = 0; c < 7; c += 1) {
          containers.push({
            x: x0 + rng.range(0, Math.max(1, x1 - x0 - 90)),
            y: y0 + rng.range(0, Math.max(1, y1 - y0 - 40)),
            w: 84, h: 34,
            color: rng.pick(['#b3543a', '#3a7a8c', '#c2a23a', '#5a8c3a', '#8c5a3a']),
          });
        }
        continue;
      }
      if (rng.chance(0.16)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = Math.floor(((x1 - x0) * (y1 - y0)) / 9000);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(8, 14) });
        }
        continue;
      }
      // Split wide blocks into two buildings, narrow ones stay whole.
      const wide = (x1 - x0) > 220;
      const tall = (y1 - y0) > 200;
      if (wide && tall) {
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, mx - x0 - 18, my - y0 - 18));
        buildings.push(makeBuilding(rng, mx + 12, y0 + 6, x1 - mx - 18, my - y0 - 18));
        buildings.push(makeBuilding(rng, x0 + 6, my + 12, mx - x0 - 18, y1 - my - 18));
        buildings.push(makeBuilding(rng, mx + 12, my + 12, x1 - mx - 18, y1 - my - 18));
      } else if (wide) {
        const mx = (x0 + x1) / 2;
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, mx - x0 - 18, y1 - y0 - 12));
        buildings.push(makeBuilding(rng, mx + 12, y0 + 6, x1 - mx - 18, y1 - y0 - 12));
      } else if (tall) {
        const my = (y0 + y1) / 2;
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, x1 - x0 - 12, my - y0 - 18));
        buildings.push(makeBuilding(rng, x0 + 6, my + 12, x1 - x0 - 12, y1 - my - 18));
      } else {
        buildings.push(makeBuilding(rng, x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12));
      }
    }
  }

  // Street lamps along every road, used for night lighting.
  // One lamp on each corner of every intersection, alternating sides.
  const lamps = [];
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      lamps.push({ x: vx + ROAD_W / 2 + 4, y: hy - ROAD_W / 2 - 4 });
      lamps.push({ x: vx - ROAD_W / 2 - 4, y: hy + ROAD_W / 2 + 4 });
    }
  }

  function pointInRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  // True when a circle of radius r at (x, y) hits something solid.
  function solidAt(x, y, r) {
    if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
    if (y > BEACH.waterY - 4) return true; // the sea
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    for (let i = 0; i < containers.length; i += 1) {
      const c = containers[i];
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
    }
    return false;
  }

  // Slide a circle along one axis: returns the furthest reachable position.
  function moveCircle(x, y, r, dx, dy) {
    let nx = x + dx;
    let ny = y + dy;
    if (solidAt(nx, y, r)) nx = x;
    if (solidAt(nx, ny, r)) ny = y;
    return { x: nx, y: ny };
  }

  function onRoad(x, y) {
    for (const vx of V_ROADS) if (Math.abs(x - vx) <= ROAD_W / 2) return true;
    for (const hy of H_ROADS) if (Math.abs(y - hy) <= ROAD_W / 2) return true;
    return false;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const vx of V_ROADS) {
      const d = Math.abs(x - vx);
      if (d < bestD) { bestD = d; best = { x: vx, y: Math.min(Math.max(y, 60), WORLD.h - 60), vertical: true }; }
    }
    for (const hy of H_ROADS) {
      const d = Math.abs(y - hy);
      if (d < bestD) { bestD = d; best = { x: Math.min(Math.max(x, 60), WORLD.w - 60), y: hy, vertical: false }; }
    }
    return best;
  }

  function districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
    return DISTRICTS[0];
  }

  return { buildings, trees, containers, parks, lamps, solidAt, moveCircle, onRoad, nearestRoadPoint, districtAt, pointInRect };
}
