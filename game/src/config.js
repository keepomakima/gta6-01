// NEON TIDE v4 — config: every tuned constant, district, vehicle and weapon.
// One job: hold the game's numbers so no other module hard-codes them.
export const WORLD_W = 2600;
export const WORLD_H = 1800;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 100;

export const PLAYER_SPEED = 205;
export const PLAYER_RUN_MULT = 1.55;
export const PLAYER_RADIUS = 14;

// District rectangles: name, bounds, palette accent, ambient feel.
export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 900, y: 100, w: 900, h: 500, accent: '#39c6ff', neon: true },
  { name: 'HARBOR', x: 100, y: 1150, w: 800, h: 550, accent: '#ffb347', neon: false },
  { name: 'BEACHFRONT', x: 2250, y: 100, w: 350, h: 1600, accent: '#ff7ad9', neon: true },
  { name: 'OLD TOWN', x: 100, y: 100, w: 700, h: 900, accent: '#ffd166', neon: false },
  { name: 'SUBURBS', x: 1000, y: 1100, w: 1200, h: 600, accent: '#7dff8a', neon: false },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

// Vehicle types: top speed px/s, acceleration, handling, health, colour.
export const VEHICLES = {
  sedan:   { name: 'Solano Sedan',  top: 330, accel: 240, turn: 2.6, hp: 100, color: '#5b8dd9', w: 46, h: 22 },
  taxi:    { name: 'Port Cab',      top: 320, accel: 230, turn: 2.6, hp: 100, color: '#f5c542', w: 46, h: 22 },
  sport:   { name: 'Tide GT',       top: 470, accel: 340, turn: 3.4, hp: 80,  color: '#e63946', w: 48, h: 21 },
  truck:   { name: 'Harbor Hauler', top: 260, accel: 170, turn: 2.0, hp: 160, color: '#8d99ae', w: 56, h: 26 },
  cruiser: { name: 'PSPD Cruiser',  top: 400, accel: 300, turn: 3.0, hp: 120, color: '#222831', w: 48, h: 22 },
  armored: { name: 'Vault Truck',   top: 280, accel: 180, turn: 2.1, hp: 220, color: '#3a506b', w: 58, h: 26 },
};

// Weapons: damage, range, fire rate (shots/sec), magazine, price in shop.
export const WEAPONS = {
  fists:   { name: 'Fists',   dmg: 12, range: 46,  rate: 2.2, mag: Infinity, price: 0,    slot: 1 },
  pistol:  { name: 'P-9 Pistol', dmg: 26, range: 380, rate: 3.5, mag: 12,  price: 0,    slot: 2 },
  smg:     { name: 'Vex SMG', dmg: 16, range: 320, rate: 9.0, mag: 32,  price: 800,  slot: 3 },
  shotgun: { name: 'Boomstick',  dmg: 55, range: 190, rate: 1.1, mag: 6,   price: 1200, slot: 4 },
};

export const SHOP_ITEMS = [
  { id: 'smg', label: 'Vex SMG', price: 800, desc: 'Rapid fire, 32-round mag' },
  { id: 'shotgun', label: 'Boomstick Shotgun', price: 1200, desc: 'Huge damage up close' },
  { id: 'ammo', label: 'Ammo Box', price: 100, desc: '+48 rounds for current gun' },
  { id: 'armor', label: 'Kevlar Vest', price: 300, desc: '+50 armor' },
];

// Gun shop + safehouses (x, y on a road edge so the player can reach them).
export const GUN_SHOP = { name: 'IRONWORKS ARMS', x: 1150, y: 640, color: '#ff5d8f' };
export const SAFEHOUSES = [
  { name: 'Marlowe Safehouse', x: 420, y: 420, color: '#7dff8a' },
  { name: 'Beachfront Flat', x: 2330, y: 900, color: '#ff7ad9' },
];

// Key places used by missions (all on roads, never inside a building).
export const PLACES = {
  kestrelClub: { x: 620, y: 300, label: 'Kestrel Club' },
  garage: { x: 1420, y: 820, label: 'Vex Garage' },
  harborDock: { x: 420, y: 1420, label: 'Harbor Dock 7' },
  rivalCorner: { x: 1020, y: 1020, label: 'Rival Corner' },
  stashHouse: { x: 1820, y: 1220, label: 'Stash House' },
  tailStart: { x: 820, y: 1020, label: 'Tail Start' },
  cabStand: { x: 620, y: 820, label: 'Cab Stand' },
  raceStart: { x: 220, y: 620, label: 'Race Start' },
  gearYard: { x: 1820, y: 1420, label: 'Gear Yard' },
  heistVault: { x: 300, y: 1560, label: 'Port Vault' },
  beachShowdown: { x: 2380, y: 1300, label: 'Pier 9' },
  hospital: { x: 1020, y: 620, label: 'Solano General' },
  policeHQ: { x: 1420, y: 420, label: 'PSPD HQ' },
};

export const WANTED_DECAY_SECONDS = 14;
export const MAX_WANTED = 5;
export const START_MONEY = 250;
export const DEBT_TOTAL = 50000;
// Deterministic seed shared by the game and its screenshot autopilot.
export const SHOT_SEED = 20261118;
