// NEON TIDE v7 "Golden Hour" — achievements.js
// Trophies: twenty-five long-term goals that reward the way von actually plays
// — driving fast, fighting clean, finishing the story, and showing off.
// A trophy unlocks the moment its test first passes, queues a gold banner
// in the HUD, and is kept in the v7 save so it survives a reload. The
// tests only read state the rest of the game already maintains (money,
// kills, garage levels, mission mode, Heat Wave clock, stunt points), so
// this module never writes game state itself except for its own case.

// One trophy: an id that goes in the save, a banner name, a one-line
// blurb for the toast, and a predicate over the live state.
export const TROPHIES = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    blurb: 'Stole your first ride in Port Solano.',
    test: (S) => S.player.car !== null,
  },
  {
    id: 'first-blood',
    name: 'First Blood',
    blurb: 'Dropped your first enemy.',
    test: (S) => S.killsTotal >= 1,
  },
  {
    id: 'cleanup-crew',
    name: 'Clean-Up Crew',
    blurb: '25 takedowns. The harbor is noticing.',
    test: (S) => S.killsTotal >= 25,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    blurb: 'Hit 300 km/h in any car.',
    test: (S) => S.stunts.maxKmh >= 300,
  },
  {
    id: 'high-roller',
    name: 'High Roller',
    blurb: 'Held $50,000 in cash at once.',
    test: (S) => S.player.money >= 50000,
  },
  {
    id: 'debt-free',
    name: 'Debt Free',
    blurb: 'Paid off the $50,000 you owed Madame Kestrel.',
    test: (S) => S.debt <= 0,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    blurb: 'Finished 10 missions.',
    test: (S) => S.completedCount >= 10,
  },
  {
    id: 'ghost',
    name: 'Ghost of the Pier',
    blurb: 'Finished the Silent Pier with detection under 50%.',
    test: (S) => S.missions.index === 13 && S.missions.mode === 'complete' && S.missions.detection < 50,
  },
  {
    id: 'heat-survivor',
    name: 'Heat Wave Survivor',
    blurb: 'Survived 60 seconds of Heat Wave.',
    test: (S) => S.heatwave.elapsed >= 60,
  },
  {
    id: 'full-garage',
    name: 'Full Garage',
    blurb: 'Every upgrade maxed at Lv3.',
    test: (S) => S.garage.engine === 3 && S.garage.grip === 3 && S.garage.armor === 3 && S.garage.nos === 3,
  },
  {
    id: 'kingmaker',
    name: 'Kingmaker',
    blurb: 'Took down both bosses and own Port Solano.',
    test: (S) => S.missions.mode === 'won',
  },
  {
    id: 'style-icon',
    name: 'Style Icon',
    blurb: 'Banked $1,000 in stunt payouts.',
    test: (S) => S.stunts.points >= 1000,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    blurb: 'Still out on the streets after 22:00.',
    test: (S) => S.weather.clock >= 22 || S.weather.clock < 5,
  },
  {
    id: 'rain-driver',
    name: 'Rain Driver',
    blurb: 'Pushed a car through heavy rain.',
    test: (S) => S.weather.rain >= 0.7 && S.player.car !== null,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    blurb: 'Fired 100 shots.',
    test: (S) => S.shotsFired >= 100,
  },
  {
    id: 'globetrotter',
    name: 'Globetrotter',
    blurb: 'Drove 12 km across Port Solano.',
    test: (S) => S.stats.distance >= 12000,
  },
  {
    id: 'wheelman',
    name: 'Wheelman',
    blurb: 'Took 10 different cars.',
    test: (S) => S.stats.carsEntered >= 10,
  },
  {
    id: 'big-spender',
    name: 'Big Spender',
    blurb: 'Earned $100,000 across your career.',
    test: (S) => S.stats.moneyEarned >= 100000,
  },
  {
    id: 'survivor',
    name: 'Survivor',
    blurb: 'Spent 30 minutes on the streets.',
    test: (S) => S.stats.playtime >= 1800,
  },
  {
    id: 'showoff',
    name: 'Showoff',
    blurb: 'Scored 5 near misses.',
    test: (S) => S.stunts.nearMisses >= 5,
  },
  {
    id: 'heat-legend',
    name: 'Heat Wave Legend',
    blurb: 'Scored 500 in one Heat Wave run.',
    test: (S) => S.stats.bestHeat >= 500,
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    blurb: 'Lived through a 5-star wanted level.',
    test: (S) => S.stats.maxWanted >= 5,
  },
  {
    id: 'drift-king',
    name: 'Drift King',
    blurb: 'Banked a single drift worth $200.',
    test: (S) => S.stats.longestDrift >= 200,
  },
  {
    id: 'clean-getaway',
    name: 'Clean Getaway',
    blurb: 'Escaped a 3-star chase with the heat at zero.',
    test: (S) => S.stats.maxWanted >= 3 && S.wanted === 0 && S.completedCount >= 1,
  },
  {
    id: 'hour-on-the-streets',
    name: 'Hour on the Streets',
    blurb: 'Spent a full hour in Port Solano.',
    test: (S) => S.stats.playtime >= 3600,
  },
];

// The trophy case lives on the state: unlocked maps trophy id -> game time
// it was earned, toasts is the banner queue the HUD drains.
export function createTrophyCase() {
  return { unlocked: {}, toasts: [] };
}

// Run once a frame from the main loop. Every trophy whose test passes for
// the first time is unlocked and queued as a banner. Cheap: twenty-five
// predicates over numbers the game already tracks.
export function checkTrophies(S) {
  const c = S.achievements;
  for (const t of TROPHIES) {
    if (c.unlocked[t.id] !== undefined) continue;
    let passed = false;
    try { passed = t.test(S); } catch { passed = false; }
    if (!passed) continue;
    c.unlocked[t.id] = S.time;
    c.toasts.push({ name: t.name, blurb: t.blurb, until: S.time + 5 });
    if (c.toasts.length > 3) c.toasts.shift();
  }
}

// The banner the HUD should show right now, or null. Expired banners are
// dropped so the toast never sticks on screen.
export function currentToast(S) {
  const c = S.achievements;
  while (c.toasts.length > 0 && c.toasts[0].until <= S.time) c.toasts.shift();
  return c.toasts.length > 0 ? c.toasts[0] : null;
}

// How many trophies the player has earned — shown on the title screen.
export function trophyCount(S) {
  return Object.keys(S.achievements.unlocked).length;
}

// Save shape: just the list of earned ids; the case is rebuilt on load.
export function trophySaveIds(S) {
  return Object.keys(S.achievements.unlocked);
}

export function trophyLoadIds(S, ids) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    if (TROPHIES.some((t) => t.id === id)) S.achievements.unlocked[id] = 0;
  }
}
