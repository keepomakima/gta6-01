// NEON TIDE — config.js
// Every tuning constant for the open world of Port Solano lives here so the
// rest of the game reads numbers from one place instead of hard-coding them.

// World size in pixels. The city is a road grid with five districts.
export const WORLD_W = 2400;
export const WORLD_H = 1600;

// Roads: vertical and horizontal centre lines, each road 96 px wide.
export const ROAD_W = 96;
export const ROADS_V = [200, 600, 1000, 1400, 1800, 2200];
export const ROADS_H = [200, 600, 1000, 1400];

// Districts, used for naming, building style and the minimap legend.
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 800, h: 700, style: 'old' },
  { name: 'Downtown', x: 800, y: 300, w: 800, h: 700, style: 'downtown' },
  { name: 'Beachfront', x: 2000, y: 0, w: 400, h: 1600, style: 'beach' },
  { name: 'Harbor', x: 0, y: 1100, w: 1000, h: 500, style: 'harbor' },
  { name: 'Suburbs', x: 1000, y: 1100, w: 1000, h: 500, style: 'suburb' },
];

// Vehicle types. speed is top speed px/s, accel px/s^2, grip steers the car.
export const CAR_TYPES = {
  sedan:   { name: 'Meridian Sedan', top: 330, accel: 260, brake: 420, grip: 2.6, hp: 100, len: 46, wid: 22, color: '#4a7fb5' },
  taxi:    { name: 'Solano Cab',    top: 320, accel: 250, brake: 420, grip: 2.6, hp: 100, len: 46, wid: 22, color: '#e8b73a' },
  sport:   { name: 'Vortex GT',     top: 480, accel: 420, brake: 560, grip: 3.4, hp: 80,  len: 48, wid: 22, color: '#c62f4e' },
  truck:   { name: 'Hauler Truck',  top: 250, accel: 170, brake: 320, grip: 2.0, hp: 160, len: 62, wid: 26, color: '#7a6a55' },
  cruiser: { name: 'PSPD Cruiser',  top: 400, accel: 340, brake: 520, grip: 3.0, hp: 130, len: 48, wid: 23, color: '#2b3a55' },
};

export const CAR_TYPE_KEYS = ['sedan', 'taxi', 'sport', 'truck', 'cruiser'];

// On-foot movement.
export const WALK_SPEED = 210;
export const RUN_SPEED = 330;

// Wanted level: stars 0..5. heat is the raw score behind the stars.
export const WANTED_MAX = 5;
export const HEAT_PER_STAR = 100;

// Economy.
export const START_MONEY = 250;
export const DEBT_TOTAL = 50000;

// Day cycle: one full day lasts DAY_LENGTH seconds of real time.
export const DAY_LENGTH = 360;

// The clock at the start of a new game: a bright morning in Port Solano.
export const START_TIME = 9.0;

// Player combat numbers.
export const PUNCH_DAMAGE = 25;
export const PUNCH_RANGE = 34;
export const PUNCH_RATE = 0.38;
export const PISTOL_DAMAGE = 34;
export const PISTOL_AMMO_START = 24;
export const PISTOL_MAX_AMMO = 120;
export const BULLET_SPEED = 900;

// Colours for the day/night lighting tints.
export const SKY_TINTS = [
  { h: 0,  tint: [8, 12, 34, 0.55] },   // deep night
  { h: 5,  tint: [10, 14, 40, 0.45] },  // pre-dawn
  { h: 6,  tint: [70, 60, 90, 0.25] },  // dawn
  { h: 8,  tint: [255, 220, 160, 0.05] }, // morning
  { h: 12, tint: [255, 255, 255, 0] },  // noon
  { h: 17, tint: [255, 180, 110, 0.12] }, // golden hour
  { h: 18.5, tint: [220, 110, 70, 0.30] }, // sunset
  { h: 20, tint: [40, 30, 80, 0.40] },  // dusk
  { h: 22, tint: [8, 12, 34, 0.55] },   // night
  { h: 24, tint: [8, 12, 34, 0.55] },
];

// Radio stations: procedural chiptune, three moods.
export const RADIO_STATIONS = [
  { name: 'SOL 98.7 — Neon Drive', bpm: 112, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { name: 'TIDE FM — Harbor Blues', bpm: 76, root: 45, scale: [0, 3, 5, 6, 10], wave: 'triangle' },
  { name: 'KESTREL — Night Static', bpm: 140, root: 50, scale: [0, 2, 3, 7, 8], wave: 'square' },
];

// Pedestrian palette and gang colours.
export const PED_SHIRTS = ['#d97b4f', '#5f8f5a', '#7a6fb0', '#b0567a', '#4f9d9d', '#c9a227', '#8a8f96'];
export const GANG_COLOR = '#3f7d3a';
export const COP_COLOR = '#24344d';

// Mission reward table is in missions.js; these are the shared places.
export const PLACES = {
  kestrelClub: { x: 1200, y: 600, label: 'Kestrel Club' },
  garage: { x: 1440, y: 1150, label: "Deke's Garage" },
  harborDock: { x: 320, y: 1420, label: 'Harbor Dock 7' },
  stashHouse: { x: 600, y: 420, label: 'Stash House' },
  gangCorner: { x: 1600, y: 1000, label: 'Rival Corner' },
  safehouse: { x: 1800, y: 1300, label: 'Safehouse' },
  hospital: { x: 1000, y: 1180, label: 'St. Marina Hospital' },
  policeStation: { x: 600, y: 820, label: 'PSPD Central' },
  sportSpawn: { x: 1080, y: 560, label: 'Vortex GT' },
};
