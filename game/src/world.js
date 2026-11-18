// NEON TIDE v5 — Port Solano: roads, buildings, landmarks and districts.
// The city is a road grid; every mission point sits on a road or an open
// plaza, never inside a building. Buildings are solid rectangles.
import { WORLD_W, WORLD_H } from './config.js';

export const ROAD_Y = [200, 500, 800, 1100, 1400];
export const ROAD_X = [300, 600, 900, 1200, 1500, 1800, 2100];
export const ROAD_W = 84;

// Landmarks the missions and menus anchor on.
export const LANDMARKS = {
  club:      { x: 620,  y: 300,  label: 'Kestrel Club' },
  garage:    { x: 1420, y: 820,  label: "Rosa's Garage" },
  gunshop:   { x: 1150, y: 640,  label: 'Ironworks Arms' },
  safehouse1:{ x: 420,  y: 420,  label: 'Safehouse — Old Town' },
  safehouse2:{ x: 2150, y: 500,  label: 'Safehouse — Airfield' },
  harbor:    { x: 420,  y: 1420, label: 'Harbor Docks' },
  stash:     { x: 1820, y: 1220, label: 'Stash House' },
  vault:     { x: 320,  y: 1560, label: 'Rival Vault' },
  pier:      { x: 420,  y: 1500, label: 'Pier Office' },
  casino:    { x: 1200, y: 1500, label: 'Neon Mile Casino' },
  airfield:  { x: 2000, y: 1000, label: 'Airfield — Runway 27' },
  bossYard:  { x: 2380, y: 1300, label: 'East Yard' },
  gangCorner:{ x: 1000, y: 1000, label: '5th & Main' },
};

// Buildings: {x, y, w, h, kind, label}. All clear of roads and mission points.
export const BUILDINGS = [
  { x: 700,  y: 260,  w: 150, h: 130, kind: 'tower', label: 'Solano Tower' },
  { x: 1000, y: 260,  w: 120, h: 110, kind: 'tower', label: 'Harbor View' },
  { x: 1300, y: 260,  w: 160, h: 120, kind: 'tower', label: 'Kestrel Plaza' },
  { x: 1600, y: 300,  w: 110, h: 90,  kind: 'block', label: 'Apartments' },
  { x: 1900, y: 260,  w: 140, h: 100, kind: 'block', label: 'Motel' },
  { x: 360,  y: 560,  w: 140, h: 120, kind: 'block', label: 'Row Houses' },
  { x: 700,  y: 560,  w: 130, h: 110, kind: 'block', label: 'Market Hall' },
  { x: 1000, y: 560,  w: 120, h: 100, kind: 'block', label: 'Cafe Row' },
  { x: 1300, y: 560,  w: 140, h: 120, kind: 'block', label: 'Offices' },
  { x: 1600, y: 560,  w: 150, h: 110, kind: 'block', label: 'Depot' },
  { x: 1900, y: 560,  w: 130, h: 100, kind: 'block', label: 'Warehouse' },
  { x: 360,  y: 860,  w: 150, h: 120, kind: 'block', label: 'Old Town Hall' },
  { x: 700,  y: 860,  w: 120, h: 110, kind: 'block', label: 'Bakery' },
  { x: 1000, y: 860,  w: 140, h: 120, kind: 'block', label: 'Arcade' },
  { x: 1300, y: 900,  w: 130, h: 90,  kind: 'block', label: 'Garage Row' },
  { x: 1600, y: 900,  w: 120, h: 100, kind: 'block', label: 'Storage' },
  { x: 360,  y: 1160, w: 140, h: 110, kind: 'block', label: 'Fish Market' },
  { x: 700,  y: 1160, w: 150, h: 120, kind: 'block', label: 'Flats' },
  { x: 1000, y: 1160, w: 120, h: 110, kind: 'block', label: 'Laundromat' },
  { x: 1300, y: 1160, w: 140, h: 110, kind: 'block', label: 'Workshops' },
  { x: 2200, y: 1160, w: 130, h: 120, kind: 'block', label: 'East Yard Sheds' },
  { x: 700,  y: 1460, w: 140, h: 90,  kind: 'block', label: 'Beach Shops' },
  { x: 1000, y: 1460, w: 150, h: 90,  kind: 'block', label: 'Boardwalk Inn' },
  { x: 1600, y: 1460, w: 120, h: 90,  kind: 'block', label: 'Docks Office' },
  { x: 2200, y: 1460, w: 120, h: 90,  kind: 'block', label: 'Container Office' },
  { x: 1950, y: 860,  w: 180, h: 80,  kind: 'terminal', label: 'Airfield Terminal' },
  { x: 1080, y: 1470, w: 110, h: 80,  kind: 'casino', label: 'Casino Aurora' },
  { x: 1250, y: 1470, w: 110, h: 80,  kind: 'casino', label: 'Casino Mirage' },
  { x: 1400, y: 1470, w: 110, h: 80,  kind: 'casino', label: 'Casino Velvet' },
];

// Harbor containers (solid, low).
export const CONTAINERS = [
  { x: 300, y: 1300, w: 60, h: 40, color: '#a8542a' },
  { x: 380, y: 1320, w: 60, h: 40, color: '#2a7aa8' },
  { x: 1700, y: 1300, w: 80, h: 40, color: '#7aa82a' },
  { x: 1850, y: 1330, w: 80, h: 40, color: '#a82a6a' },
  { x: 300, y: 1180, w: 60, h: 40, color: '#2a7aa8' },
];

// Sentry posts for Mission 14 (Silent Pier). Cones face outward from the
// pier office so a direct approach from the north slips between them, but
// the south post watches the beach approach.
export const SENTRY_POSTS = [
  { x: 520, y: 1440, angle: 0 },
  { x: 330, y: 1430, angle: Math.PI },
  { x: 480, y: 1570, angle: -Math.PI / 2 },
];
export function districtAt(x, y) {
  if (x >= 1850 && y <= 1150) return 'Airfield';
  if (x >= 900 && x < 1600 && y >= 1400) return 'Neon Mile';
  if (y >= 1250) return 'Harbor';
  if (x < 900 && y >= 1000) return 'Beachfront';
  if (x >= 900 && x < 1800 && y >= 250 && y < 1000) return 'Downtown';
  if (x < 900 && y >= 250 && y < 1000) return 'Old Town';
  return 'Suburbs';
}

export function onRoad(x, y) {
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  return false;
}

function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function hitsSolid(x, y, r) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  for (const b of BUILDINGS) if (circleHitsRect(x, y, r, b)) return true;
  for (const c of CONTAINERS) if (circleHitsRect(x, y, r, c)) return true;
  return false;
}

// Push a circle out of any solid it overlaps; returns true if it collided.
export function resolveSolid(e, r) {
  let hit = false;
  for (const b of [...BUILDINGS, ...CONTAINERS]) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
      hit = true;
    } else if (d2 <= 0.01) {
      e.x = b.x - r - 1; // centre exactly inside: shove out to the left
      hit = true;
    }
  }
  e.x = Math.max(r, Math.min(WORLD_W - r, e.x));
  e.y = Math.max(r, Math.min(WORLD_H - r, e.y));
  return hit;
}
