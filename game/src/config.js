// NEON TIDE v7 "Golden Hour" — config.js
// Tuning constants for the 3D open-world crime game in Port Solano.
// v7 changes vs v6r2: new save key, new seed, golden-hour sun tuning,
// warmer district palettes, pedestrian clothing palette, van traffic type.
export const SAVE_KEY = 'neon-tide-v7-save';
export const SEED = 20261123;
export const DEBT_START = 50000;

export const WORLD = {
  minX: -1100, maxX: 1100, minZ: -750, maxZ: 750,
  roadEvery: 200, roadWidth: 26,
};

// Golden hour: the low warm sun the whole v7 look is built around.
export const GOLDEN_HOUR = {
  clock: 17.8,            // game starts at golden hour
  sunColor: 0xffb36b,     // low amber sun
  sunHeight: 55,          // low sun -> long shadows
  fogColor: 0xe8a06a,      // warm haze
  skyTop: 0x2e4a7a,        // dusk-blue zenith over amber horizon
  skyBottom: 0xffc07a,
};

export const DISTRICTS = [
  { name: 'Downtown', color: 0x4a5578 },
  { name: 'Harbor', color: 0x6b4a30 },
  { name: 'Beachfront', color: 0x3a7a8a },
  { name: 'Old Town', color: 0x7a5a3a },
  { name: 'Suburbs', color: 0x4a7a4a },
  { name: 'Airfield', color: 0x666672 },
  { name: 'Neon Mile', color: 0x8a2a6a },
  { name: 'Marina', color: 0x2a5a8a },
];

// Landmark anchors. Every anchor sits ON a road line (x or z a multiple of
// 200) so it is always reachable — never inside a building block.
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

export const CAR_TYPES = {
  sedan: { top: 150, accel: 90, turn: 2.6, hp: 100, color: 0x9aa0b0, label: 'Solano Sedan' },
  taxi: { top: 145, accel: 85, turn: 2.6, hp: 100, color: 0xffc21a, label: 'Harbor Cab' },
  sport: { top: 210, accel: 150, turn: 3.4, hp: 80, color: 0xff3355, label: 'Neon GT' },
  truck: { top: 110, accel: 60, turn: 2.0, hp: 160, color: 0x6a7a8a, label: 'Dock Hauler' },
  van: { top: 125, accel: 70, turn: 2.2, hp: 130, color: 0x7a8a6a, label: 'Marina Van' },
  cruiser: { top: 185, accel: 130, turn: 3.2, hp: 120, color: 0x2233aa, label: 'PSPD Cruiser' },
  bike: { top: 230, accel: 170, turn: 4.4, hp: 55, color: 0x00e5ff, label: 'Tide Runner 900' },
};

// Paint jobs traffic cars wear, so the streets are not one grey fleet.
export const TRAFFIC_PAINTS = [
  0xc23a3a, 0x3a6ac2, 0x3ac27a, 0xe8d24a, 0xe8e8e8, 0x2a2a33,
  0xc27a3a, 0x7a3ac2, 0x4ac2c2, 0xb0b8c8, 0x5a3a2a, 0x2a6a4a,
];

export const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, range: 6, cooldown: 0.45, ammo: Infinity },
  pistol: { name: 'Harbor Pistol', dmg: 26, range: 90, cooldown: 0.32, ammo: 120 },
  smg: { name: 'Tide SMG', dmg: 16, range: 80, cooldown: 0.09, ammo: 240 },
};

export const UPGRADES = {
  engine: { name: 'Engine', costs: [0, 800, 1600, 3200], topMul: [1, 1.12, 1.25, 1.4] },
  grip: { name: 'Grip Tires', costs: [0, 600, 1200, 2400], turnMul: [1, 1.12, 1.25, 1.4] },
  armor: { name: 'Car Armor', costs: [0, 700, 1400, 2800], hpMul: [1, 1.3, 1.6, 2.0] },
  nos: { name: 'NOS Kit', costs: [0, 1000, 2000, 4000], cap: [0, 100, 160, 240] },
};
export const NOS_BOOST = 1.45;
export const NOS_DRAIN = 34;

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

// Pedestrian clothing palette — the living city wears colour, not grey.
export const PED_SHIRTS = [
  0xe84a5a, 0x4a7ae8, 0x4ae88a, 0xe8c24a, 0x8a4ae8, 0xe88a4a,
  0xffffff, 0x2a2a33, 0x4ac2c2, 0xc23a7a, 0x7ac24a, 0xff9a5a,
];
export const PED_PANTS = [0x222233, 0x3a3a4a, 0x5a4a3a, 0x2a4a5a, 0x6a6a7a];
export const PED_SKINS = [0xd8a878, 0xc89878, 0x8a5a3a, 0xe8b898, 0x6a4a2a];

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
