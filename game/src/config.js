// NEON TIDE v5 — config: every tunable number of the game in one place.
// Port Solano is a 2400x1600 top-down city. All names, people and places
// are original; nothing here comes from any commercial game.
export const WORLD_W = 2400;
export const WORLD_H = 1600;
export const SAVE_KEY = 'neon-tide-v5-save';
export const SEED_DEFAULT = 20261118;
export const DEBT_TOTAL = 50000;

// Player on foot.
export const WALK_SPEED = 230;
export const RUN_SPEED = 350;
export const PLAYER_HP = 100;

// Cars: top speed, acceleration, turn rate, hit points, seats.
export const CAR_TYPES = {
  sedan:   { label: 'Sedan',        top: 430, accel: 300, turn: 3.1, hp: 80,  color: '#5a7a9a' },
  taxi:    { label: 'Taxi',         top: 440, accel: 310, turn: 3.3, hp: 80,  color: '#e8b820' },
  sport:   { label: 'Sport',        top: 570, accel: 430, turn: 4.0, hp: 70,  color: '#c22a3a' },
  truck:   { label: 'Truck',        top: 310, accel: 200, turn: 2.5, hp: 150, color: '#6a6a72' },
  cruiser: { label: 'Police Cruiser', top: 530, accel: 390, turn: 3.8, hp: 90,  color: '#20242e' },
  bike:    { label: 'Tide Runner 900', top: 600, accel: 520, turn: 4.4, hp: 55,  color: '#18b8a8' },
};

// Weapons: damage per hit, shots per second, bullet speed, ammo start.
export const WEAPONS = {
  fists:   { label: 'Fists',   dmg: 25, rate: 2.2, speed: 0,    range: 46,  auto: false },
  pistol:  { label: 'Pistol',  dmg: 34, rate: 5.0, speed: 900,  range: 520, auto: true },
  smg:     { label: 'SMG',     dmg: 22, rate: 9.0, speed: 1000, range: 460, auto: true },
  shotgun: { label: 'Shotgun', dmg: 13, rate: 1.3, speed: 820,  range: 300, auto: false, pellets: 5 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

// Garage upgrades at Rosa's Garage: four items, levels 0-3.
// Index order matters for the menu: Engine, Grip Tires, Car Armor, NOS Kit.
export const UPGRADES = [
  { id: 'engine', label: 'Engine',     costs: [800, 1500, 2500], desc: '+top speed, +accel' },
  { id: 'grip',   label: 'Grip Tires', costs: [600, 1200, 2000], desc: '+turning, +braking' },
  { id: 'armor',  label: 'Car Armor',  costs: [700, 1300, 2200], desc: '+car hit points' },
  { id: 'nos',    label: 'NOS Kit',    costs: [1000, 1800, 2800], desc: 'Shift boost 1.45x' },
];
export const NOS_DRAIN = 34;      // tank units per second while boosting
export const NOS_MULT = 1.45;     // top-speed multiplier while boosting
export const NOS_TANK = 100;      // tank size once any NOS level is owned

// Gun shop (Ironworks Arms) stock: first item is the SMG.
export const SHOP_ITEMS = [
  { id: 'smg',     label: 'SMG',          price: 1200, desc: 'Rapid fire, 9 shots/s' },
  { id: 'shotgun', label: 'Shotgun',      price: 1500, desc: '5 pellets, close range' },
  { id: 'ammo',    label: 'Ammo Box',     price: 200,  desc: '+120 ammo, all guns' },
  { id: 'armor',   label: 'Body Armor',   price: 300,  desc: '+50 armor' },
];

// Wanted / police tuning.
export const WANTED_MAX = 5;
export const COP_FOOT_SPEED = 265;
export const CRUISER_SPAWN_DIST = 700;
export const SPIKE_MIN_WANTED = 4;
export const PIT_MIN_WANTED = 3;

// Enemy combat balance (fixed in v5b: vault guards must be survivable —
// 5 guards at ~2 dmg per 1.6s is ~6 dps worst case, not the ~15 dps of v5).
export const ENEMY_DMG = 2;
export const ENEMY_FIRE_INTERVAL = 1.6;
export const ENEMY_RANGE = 430;
export const ENEMY_HP = 100;
export const BOSS_HP = 320;

// Mission timers (seconds): Harbor Run, Street Race, Midnight Run.
export const MISSION_TIMERS = { m3: 120, m9: 150, m13: 90 };
export const SENTRY_RANGE = 270;
export const SENTRY_HALF_ANGLE = 0.61; // ~35 degrees each side
export const DETECT_RATE = 20;         // meter per second inside a cone
export const DETECT_FALL = 30;          // meter per second outside cones

// Missions: title, reward, short brief. Order is the play order.
export const MISSIONS = [
  { title: 'Welcome Back',  reward: 500,  brief: 'Walk to the Kestrel Club and meet Madame Kestrel.' },
  { title: 'Hot Wheels',    reward: 800,  brief: 'Steal a sport car and deliver it to Rosa\'s Garage.' },
  { title: 'Harbor Run',    reward: 1200, brief: 'Drive the package to the Harbor before the timer runs out.' },
  { title: 'Lose the Heat', reward: 1000, brief: 'Shake the 3-star wanted level. Stay out of sight.' },
  { title: 'Street Fight',  reward: 1500, brief: 'Clear the rival gang off the corner at 5th & Main.' },
  { title: 'Payback',       reward: 2000, brief: 'Hit the stash house, then bring the take to the garage.' },
  { title: 'The Setup',     reward: 1800, brief: 'Tail the target. Stay close, but never too close.' },
  { title: 'Side Hustle',   reward: 1600, brief: 'Drive the taxi. Three fares, three stops.' },
  { title: 'Street Race',   reward: 2500, brief: 'Three gates across Port Solano. Fastest wins.' },
  { title: 'Heist Prep',    reward: 2200, brief: 'Collect the three gear crates at the east docks.' },
  { title: 'The Big One',   reward: 5000, brief: 'Storm the vault, drop the guards, escape to the garage.' },
  { title: 'Tide Turns',    reward: 6000, brief: 'Boss Rook is waiting at the east yard. End this.' },
  { title: 'Midnight Run',  reward: 3500, brief: 'Three-stop getaway chain. 90 seconds on the clock.' },
  { title: 'Silent Pier',   reward: 3000, brief: 'Slip past the sentries. Reach the Pier Office unseen.' },
  { title: 'Neon Mile',     reward: 8000, brief: 'Hit the casino, grab $4,000, escape to the Airfield.' },
];
