// NEON TIDE — configuration and data tables for Port Solano.
// All names, places, vehicles and story beats are original fiction.
export const WORLD = { w: 2400, h: 1600 };

// Road centrelines. Vertical roads run the full height, horizontal the full width.
export const V_ROADS = [240, 640, 1040, 1440, 1840, 2160];
export const H_ROADS = [220, 520, 820, 1120, 1420];
export const ROAD_W = 72;
export const LANE = 18; // lane offset from a road centreline

export const DISTRICTS = [
  { name: 'Downtown', x0: 0, y0: 0, x1: 1200, y1: 700, ground: '#3d4a3a' },
  { name: 'Old Town', x0: 0, y0: 700, x1: 1200, y1: 1600, ground: '#4a4238' },
  { name: 'Harbor', x0: 1700, y0: 0, x1: 2400, y1: 700, ground: '#3a4148' },
  { name: 'Beachfront', x0: 0, y0: 1420, x1: 2400, y1: 1600, ground: '#c2a878' },
  { name: 'Suburbs', x0: 1200, y0: 700, x1: 2400, y1: 1600, ground: '#44503c' },
];

// Beach strip along the south edge; the sea itself is the bottom band.
export const BEACH = { y0: 1470, waterY: 1560 };

// Five drivable vehicle types. Numbers are tuned per type so each feels different.
export const VEHICLES = {
  sedan:   { label: 'Solano Sedan',  color: '#5b7fa6', accel: 340, top: 330, grip: 2.6, hp: 100, seats: 4 },
  taxi:    { label: 'Harbor Taxi',   color: '#e8b93a', accel: 320, top: 310, grip: 2.6, hp: 90,  seats: 4 },
  sport:   { label: 'Vortex GT',     color: '#c23b4e', accel: 520, top: 470, grip: 3.4, hp: 80,  seats: 2 },
  truck:   { label: 'Dock Hauler',   color: '#7a6a4f', accel: 220, top: 240, grip: 2.0, hp: 180, seats: 2 },
  cruiser: { label: 'PSPD Cruiser',  color: '#2e4a7a', accel: 460, top: 420, grip: 3.1, hp: 140, seats: 4 },
};

export const PLAYER = {
  walkSpeed: 165, runSpeed: 265, radius: 13,
  maxHealth: 100, maxArmor: 100,
};

export const WEAPONS = {
  fists:  { label: 'Fists',  range: 46,  damage: 14, rate: 0.38, ammo: Infinity },
  pistol: { label: 'K-9 Pistol', range: 420, damage: 34, rate: 0.30, ammo: 120 },
};

// Wanted heat thresholds per star. Heat decays when no police can see the player;
// at 0 the player is clean, at 300 the whole PSPD is on them.
export const WANTED_HEAT = [0, 25, 60, 120, 200, 300];
export const CRIME_HEAT = { steal: 30, punch: 12, kill: 45, shoot: 20, hitPed: 18, hitCop: 60 };
export const BUST_FINE = 500;
export const DEBT_TOTAL = 50000;

// Key places on the map (all original locations in Port Solano).
export const PLACES = {
  club:      { x: 1040, y: 300, label: "Kestrel's Club" },
  garage:    { x: 640, y: 900, label: 'Marlowe Garage' },
  sportCar:  { x: 1440, y: 1420, label: 'Boardwalk' },
  harbor:    { x: 2160, y: 300, label: 'Harbor Docks' },
  rivalCorner:{ x: 240, y: 1120, label: 'Rival Corner' },
  stashHouse:{ x: 1840, y: 1120, label: 'Stash House' },
  hospital:  { x: 640, y: 220, label: 'Solano General' },
  precinct:  { x: 1440, y: 520, label: 'PSPD Precinct' },
  followStart:{ x: 1040, y: 820, label: 'Tail Start' },
};

// Mission list: 8 sequential story missions. Stages are interpreted by missions.js.
export const MISSIONS = [
  {
    id: 1, title: 'Welcome Back', reward: 200,
    brief: 'Deke is back in Port Solano. Walk to Madame Kestrel\'s club and hear what she wants.',
    dialog: [
      ['KESTREL', 'Deke Marlowe. Five years gone, and you walk back into my city like the tide.'],
      ['DEKE', 'I came to settle up. Fifty thousand, right?'],
      ['KESTREL', 'Fifty thousand. Work for me, and the debt shrinks. Refuse, and the harbor eats you.'],
    ],
    stages: [{ type: 'goto', at: 'club', radius: 70, text: 'Walk to Kestrel\'s Club' }],
  },
  {
    id: 2, title: 'Hot Wheels', reward: 500,
    brief: 'Kestrel wants a Vortex GT from the boardwalk. Take it — quietly if you can — and bring it to the garage.',
    dialog: [
      ['KESTREL', 'A red Vortex GT parks by the boardwalk every dusk. Bring it to your garage.'],
      ['DEKE', 'Borrowed, not stolen. Mostly.'],
    ],
    stages: [
      { type: 'goto', at: 'sportCar', radius: 90, text: 'Find the Vortex GT at the Boardwalk' },
      { type: 'steal', text: 'Take the Vortex GT (press E near it)' },
      { type: 'driveTo', at: 'garage', radius: 80, text: 'Deliver the car to Marlowe Garage' },
    ],
  },
  {
    id: 3, title: 'Harbor Run', reward: 800,
    brief: 'A package for the docks. The harbor crew waits — don\'t keep them waiting.',
    dialog: [
      ['KESTREL', 'Package in the trunk. Harbor docks, ninety seconds. The tide waits for no one.'],
    ],
    stages: [
      { type: 'goto', at: 'club', radius: 70, text: 'Pick up the package at the club' },
      { type: 'deliver', at: 'harbor', radius: 90, timer: 90, text: 'Deliver to the Harbor Docks before time runs out' },
    ],
  },
  {
    id: 4, title: 'Lose the Heat', reward: 1000,
    brief: 'The PSPD is all over you. Break line of sight and stay hidden until the heat dies down.',
    dialog: [
      ['DEKE', 'Three stars. Every cruiser in Solano is looking for me.'],
      ['KESTREL', 'Then stop being found. Lose them.'],
    ],
    stages: [
      { type: 'heat', stars: 3, text: 'Lose the police — get your wanted level back to zero' },
    ],
  },
  {
    id: 5, title: 'Street Fight', reward: 1200,
    brief: 'The Tidebreakers are muscling in on Old Town. Clear their corner — fists or pistol, your call.',
    dialog: [
      ['KESTREL', 'Four Tidebreakers hold the corner on Mercer Street. Take it back.'],
      ['DEKE', 'Consider it taken.'],
    ],
    stages: [
      { type: 'goto', at: 'rivalCorner', radius: 120, text: 'Reach the Rival Corner' },
      { type: 'kill', count: 4, area: 'rivalCorner', radius: 260, text: 'Clear out the Tidebreakers (0/4)' },
    ],
  },
  {
    id: 6, title: 'Payback', reward: 2000,
    brief: 'The rival stash house in the suburbs holds Kestrel\'s money. Grab the cash and get out in a car.',
    dialog: [
      ['KESTREL', 'My money sits in a stash house off Coral Avenue. Bring it home.'],
    ],
    stages: [
      { type: 'goto', at: 'stashHouse', radius: 90, text: 'Reach the Stash House' },
      { type: 'hold', at: 'stashHouse', radius: 70, hold: 3, text: 'Grab the cash (stay in the marker)' },
      { type: 'driveTo', at: 'garage', radius: 80, text: 'Escape to Marlowe Garage in a car' },
    ],
  },
  {
    id: 7, title: 'The Setup', reward: 2500,
    brief: 'Tail the Tidebreaker courier through downtown. Stay close enough to follow, far enough not to be seen.',
    dialog: [
      ['KESTREL', 'A courier drives the downtown loop tonight. Follow him. Do not let him see you.'],
    ],
    stages: [
      { type: 'goto', at: 'followStart', radius: 100, text: 'Get to the tail start on Mercer Street' },
      { type: 'follow', duration: 45, text: 'Tail the courier — keep your distance' },
    ],
  },
  {
    id: 8, title: 'The Big One', reward: 5000,
    brief: 'The harbor heist. Take the docks, grab the crates, and outrun the whole PSPD.',
    dialog: [
      ['KESTREL', 'Tonight we take the harbor back. Guards, crates, and a fast car out.'],
      ['DEKE', 'Fifty thousand. Tonight, the debt dies.'],
    ],
    stages: [
      { type: 'goto', at: 'harbor', radius: 120, text: 'Reach the Harbor Docks' },
      { type: 'kill', count: 6, area: 'harbor', radius: 300, text: 'Take out the harbor guards (0/6)' },
      { type: 'hold', at: 'harbor', radius: 80, hold: 4, text: 'Load the crates (stay in the marker)' },
      { type: 'driveTo', at: 'club', radius: 90, text: 'Escape to Kestrel\'s Club' },
    ],
  },
];

// Radio stations: original procedural tunes, no licensed music.
export const RADIO = [
  { name: 'TIDE FM', style: 'chill', bpm: 92 },
  { name: 'SOLANO ROCK', style: 'drive', bpm: 132 },
  { name: 'HARBOUR JAZZ', style: 'swing', bpm: 108 },
];
