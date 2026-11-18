// NEON TIDE v6-rebuild-2 — config.js
// All tuning constants for the 3D open-world crime game in Port Solano.
// Original city, characters, vehicles and story. No Rockstar material.
export const SAVE_KEY = 'neon-tide-v6r2-save';
export const SEED = 20261121;
export const DEBT_START = 50000;

export const WORLD = {
  minX: -1100, maxX: 1100, minZ: -750, maxZ: 750,
  roadEvery: 200, roadWidth: 26,
};

// Districts of Port Solano (8). Order matters for the HUD + minimap legend.
export const DISTRICTS = [
  { name: 'Downtown', color: 0x3a4a6b },
  { name: 'Harbor', color: 0x4a3a2c },
  { name: 'Beachfront', color: 0x2c5a6b },
  { name: 'Old Town', color: 0x5a4a3a },
  { name: 'Suburbs', color: 0x3a5a3a },
  { name: 'Airfield', color: 0x555560 },
  { name: 'Neon Mile', color: 0x6b2a5a },
  { name: 'Marina', color: 0x2a4a6b },
];

// Landmark anchors. Every anchor sits ON a road line (x or z a multiple of 200)
// so it is always reachable — never inside a building block.
export const PLACES = {
  club: { x: 0, z: 100, name: "Kestrel Club" },
  garage: { x: 400, z: 200, name: "Rosa's Garage" },
  gunshop: { x: -200, z: -200, name: 'Ironworks Arms' },
  safehouse1: { x: 600, z: 600, name: 'Safehouse — Beachfront' },
  safehouse2: { x: -600, z: -600, name: 'Safehouse — Old Town' },
  casino: { x: 200, z: 400, name: 'TIDE Casino' },
  pier: { x: -1050, z: 700, name: 'Silent Pier' },
  airfield: { x: 800, z: -600, name: 'Port Solano Airfield' },
  harbor: { x: -800, z: 300, name: 'Harbor Docks' },
  marina: { x: -800, z: 600, name: 'Marina' },
};

// Vehicle classes. top = top speed (units/s), accel, turn (rad/s), hp.
export const CAR_TYPES = {
  sedan: { top: 150, accel: 90, turn: 2.6, hp: 100, color: 0x8a8f9a, label: 'Solano Sedan' },
  taxi: { top: 145, accel: 85, turn: 2.6, hp: 100, color: 0xffc21a, label: 'Harbor Cab' },
  sport: { top: 210, accel: 150, turn: 3.4, hp: 80, color: 0xff3355, label: 'Neon GT' },
  truck: { top: 110, accel: 60, turn: 2.0, hp: 160, color: 0x5a6b7a, label: 'Dock Hauler' },
  cruiser: { top: 185, accel: 130, turn: 3.2, hp: 120, color: 0x2233aa, label: 'PSPD Cruiser' },
  bike: { top: 230, accel: 170, turn: 4.4, hp: 55, color: 0x00e5ff, label: 'Tide Runner 900' },
};

export const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, range: 6, cooldown: 0.45, ammo: Infinity },
  pistol: { name: 'Harbor Pistol', dmg: 26, range: 90, cooldown: 0.32, ammo: 120 },
  smg: { name: 'Tide SMG', dmg: 16, range: 80, cooldown: 0.09, ammo: 240 },
};

// Garage upgrades, level 0..3 each. NOS boost is Shift while driving.
export const UPGRADES = {
  engine: { name: 'Engine', costs: [0, 800, 1600, 3200], topMul: [1, 1.12, 1.25, 1.4] },
  grip: { name: 'Grip Tires', costs: [0, 600, 1200, 2400], turnMul: [1, 1.12, 1.25, 1.4] },
  armor: { name: 'Car Armor', costs: [0, 700, 1400, 2800], hpMul: [1, 1.3, 1.6, 2.0] },
  nos: { name: 'NOS Kit', costs: [0, 1000, 2000, 4000], cap: [0, 100, 160, 240] },
};
export const NOS_BOOST = 1.45;
export const NOS_DRAIN = 34;

// Wanted / police tuning.
export const WANTED = {
  max: 5,
  decayDelay: 6,      // seconds unseen before a star decays
  decayEvery: 9,      // seconds per star once decaying
  cruiserPerStar: 1,
  roadblockAt: 3,     // stars
  pitAt: 3,
  spikeAt: 4,
  heliAt: 4,
};
// District lookup: which named district contains a world point.
// Airfield is the flat north-east corner, Neon Mile the casino strip,
// Marina the south-west docks, Harbor the west docks, Beachfront the south
// shore, Old Town the south-west blocks, Suburbs the east, Downtown centre.
export function districtAt(x, z) {
  if (x > 600 && z < -450) return 'Airfield';
  if (x >= -200 && x <= 400 && z >= 300 && z <= 600) return 'Neon Mile';
  if (x < -600 && z > 400) return 'Marina';
  if (x < -700) return 'Harbor';
  if (z > 500) return 'Beachfront';
  if (x < -200 && z > 300) return 'Old Town';
  if (x > 700) return 'Suburbs';
  return 'Downtown';
}

// Snap a point onto the nearest road centre line (roads every 200 units).
export function snapToRoad(x, z) {
  const rx = Math.round(x / 200) * 200;
  const rz = Math.round(z / 200) * 200;
  if (Math.abs(x - rx) < Math.abs(z - rz)) return { x: rx, z };
  return { x, z: rz };
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function lerp(a, b, t) { return a + (b - a) * t; }
