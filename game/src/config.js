// NEON TIDE v6 — config: world layout, districts, vehicles, weapons, economy.
// Fresh for v6 (3D). All names, places and prices are original.
export const SAVE_KEY = 'neon-tide-v6-save';
export const SEED = 20261119;
export const WORLD = { minX: -1100, maxX: 1100, minZ: -750, maxZ: 750 };
export const ROAD_WIDTH = 26;
export const ROADS_X = [-1000, -800, -600, -400, -200, 0, 200, 400, 600, 800, 1000];
export const ROADS_Z = [-600, -400, -200, 0, 200, 400, 600];

// Districts: name, rect, building height range, palette note.
export const DISTRICTS = [
  { name: 'Downtown', x0: -200, z0: -200, x1: 400, z1: 200, hMin: 26, hMax: 70, neon: 0.4 },
  { name: 'Harbor', x0: -1100, z0: -200, x1: -800, z1: 600, hMin: 6, hMax: 14, neon: 0.1 },
  { name: 'Beachfront', x0: -1100, z0: 600, x1: 1100, z1: 750, hMin: 4, hMax: 12, neon: 0.3 },
  { name: 'Old Town', x0: 600, z0: -600, x1: 1100, z1: -200, hMin: 8, hMax: 18, neon: 0.2 },
  { name: 'Suburbs', x0: 600, z0: 200, x1: 1100, z1: 600, hMin: 5, hMax: 10, neon: 0.05 },
  { name: 'Airfield', x0: -1100, z0: -750, x1: -600, z1: -400, hMin: 5, hMax: 12, neon: 0.1 },
  { name: 'Neon Mile', x0: -200, z0: 200, x1: 400, z1: 400, hMin: 10, hMax: 26, neon: 1.0 },
  { name: 'Marina', x0: -800, z0: 600, x1: -400, z1: 750, hMin: 4, hMax: 10, neon: 0.4 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  return 'Downtown';
}

// Vehicle types: top speed (units/s), accel, turn rate, hit points, colour.
export const CARS = {
  sedan: { top: 240, accel: 170, turn: 2.6, hp: 100, color: 0x3a6fd8, label: 'Sedan' },
  taxi: { top: 230, accel: 180, turn: 2.7, hp: 90, color: 0xf2c200, label: 'Taxi' },
  sport: { top: 330, accel: 260, turn: 3.1, hp: 80, color: 0xff3355, label: 'Sport' },
  truck: { top: 190, accel: 120, turn: 2.0, hp: 180, color: 0x7a8a99, label: 'Truck' },
  cruiser: { top: 300, accel: 240, turn: 3.0, hp: 120, color: 0x1a1a22, label: 'Cruiser' },
  bike: { top: 360, accel: 300, turn: 3.6, hp: 55, color: 0x00e5ff, label: 'Tide Runner 900' },
};

export const WEAPONS = {
  fists: { damage: 12, rate: 0.45, range: 14, auto: false, ammo: Infinity, price: 0, label: 'Fists' },
  pistol: { damage: 22, rate: 0.38, range: 220, auto: false, ammo: 12, price: 0, label: 'Pistol' },
  smg: { damage: 13, rate: 0.09, range: 200, auto: true, ammo: 40, price: 800, label: 'SMG' },
};

export const UPGRADES = {
  engine: { label: 'Engine', prices: [600, 1200, 2400], topMul: [0, 0.12, 0.24, 0.38] },
  grip: { label: 'Grip Tires', prices: [450, 900, 1800], turnMul: [0, 0.12, 0.24, 0.38] },
  armor: { label: 'Car Armor', prices: [500, 1000, 2000], hpMul: [0, 0.25, 0.5, 0.85] },
  nos: { label: 'NOS Kit', prices: [700, 1400, 2800], nosMax: [0, 100, 160, 240] },
};
export const NOS_BOOST = 1.45;
export const NOS_DRAIN = 34;

export const ANCHORS = {
  // All anchors sit on roads or the clear sidewalk strip beside them, never
  // inside a building block — the collision solver pushes anything inside a
  // block back out, so a target inside a block can never be reached.
  start: { x: -14, z: 180 },
  club: { x: 14, z: 40 },
  garage: { x: 214, z: 300 },
  gunshop: { x: -386, z: 200 },
  safehouse1: { x: -14, z: 180 },
  safehouse2: { x: 814, z: 420 },
  sportM2: { x: 414, z: 60 },
  harborDock: { x: -986, z: 300 },
  gangCorner: { x: -600, z: 300 },
  stashHouse: { x: -786, z: -120 },
  vault: { x: -700, z: 620 },
  casino: { x: 214, z: 320 },
  airfield: { x: -850, z: -550 },
  pier: { x: -960, z: 680 },
  marina: { x: -600, z: 680 },
  bossArena: { x: 950, z: -620 },
  brokerYard: { x: 814, z: -480 },
};
