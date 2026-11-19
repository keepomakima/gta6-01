// NEON TIDE v7-coverfix — achievements.js (structural pass)
// Trophies: twenty-five long-term goals that reward the way Deke actually
// plays. A trophy unlocks the moment its test first passes, queues a gold
// banner in the HUD, and is kept in the v7 save so it survives a reload.
export const TROPHIES = [
  { test: function (S) { return S.player.car !== null; }, blurb: 'Stole your first ride in Port Solano.', name: 'First Wheels', id: 'first-wheels' },
  { test: function (S) { return S.killsTotal >= 1; }, blurb: 'Dropped your first enemy.', name: 'First Blood', id: 'first-blood' },
  { test: function (S) { return S.killsTotal >= 25; }, blurb: '25 takedowns. The harbor is noticing.', name: 'Clean-Up Crew', id: 'cleanup-crew' },
  { test: function (S) { return S.stunts.maxKmh >= 300; }, blurb: 'Hit 300 km/h in any car.', name: 'Speed Demon', id: 'speed-demon' },
  { test: function (S) { return S.player.money >= 50000; }, blurb: 'Held $50,000 in cash at once.', name: 'High Roller', id: 'high-roller' },
  { test: function (S) { return S.debt <= 0; }, blurb: 'Paid off the $50,000 you owed Madame Kestrel.', name: 'Debt Free', id: 'debt-free' },
  { test: function (S) { return S.completedCount >= 10; }, blurb: 'Finished 10 missions.', name: 'Marathon', id: 'marathon' },
  { test: function (S) { return S.missions.index === 13 && S.missions.mode === 'complete' && S.missions.detection < 50; }, blurb: 'Finished the Silent Pier with detection under 50%.', name: 'Ghost of the Pier', id: 'ghost' },
  { test: function (S) { return S.heatwave.elapsed >= 60; }, blurb: 'Survived 60 seconds of Heat Wave.', name: 'Heat Wave Survivor', id: 'heat-survivor' },
  { test: function (S) { return S.garage.engine === 3 && S.garage.grip === 3 && S.garage.armor === 3 && S.garage.nos === 3; }, blurb: 'Every upgrade maxed at Lv3.', name: 'Full Garage', id: 'full-garage' },
  { test: function (S) { return S.missions.mode === 'won'; }, blurb: 'Took down both bosses and own Port Solano.', name: 'Kingmaker', id: 'kingmaker' },
  { test: function (S) { return S.stunts.points >= 1000; }, blurb: 'Banked $1,000 in stunt payouts.', name: 'Style Icon', id: 'style-icon' },
  { test: function (S) { return S.weather.clock >= 22 || S.weather.clock < 5; }, blurb: 'Still out on the streets after 22:00.', name: 'Night Owl', id: 'night-owl' },
  { test: function (S) { return S.weather.rain >= 0.7 && S.player.car !== null; }, blurb: 'Pushed a car through heavy rain.', name: 'Rain Driver', id: 'rain-driver' },
  { test: function (S) { return S.shotsFired >= 100; }, blurb: 'Fired 100 shots.', name: 'Sharpshooter', id: 'sharpshooter' },
  { test: function (S) { return S.stats.distance >= 12000; }, blurb: 'Drove 12 km across Port Solano.', name: 'Globetrotter', id: 'globetrotter' },
  { test: function (S) { return S.stats.carsEntered >= 10; }, blurb: 'Took 10 different cars.', name: 'Wheelman', id: 'wheelman' },
  { test: function (S) { return S.stats.moneyEarned >= 100000; }, blurb: 'Earned $100,000 across your career.', name: 'Big Spender', id: 'big-spender' },
  { test: function (S) { return S.stats.playtime >= 1800; }, blurb: 'Spent 30 minutes on the streets.', name: 'Survivor', id: 'survivor' },
  { test: function (S) { return S.stunts.nearMisses >= 5; }, blurb: 'Scored 5 near misses.', name: 'Showoff', id: 'showoff' },
  { test: function (S) { return S.stats.bestHeat >= 500; }, blurb: 'Scored 500 in one Heat Wave run.', name: 'Heat Wave Legend', id: 'heat-legend' },
  { test: function (S) { return S.stats.maxWanted >= 5; }, blurb: 'Lived through a 5-star wanted level.', name: 'Untouchable', id: 'untouchable' },
  { test: function (S) { return S.stats.longestDrift >= 200; }, blurb: 'Banked a single drift worth $200.', name: 'Drift King', id: 'drift-king' },
  { test: function (S) { return S.stats.maxWanted >= 3 && S.wanted === 0 && S.completedCount >= 1; }, blurb: 'Escaped a 3-star chase with the heat at zero.', name: 'Clean Getaway', id: 'clean-getaway' },
  { test: function (S) { return S.stats.playtime >= 3600; }, blurb: 'Spent a full hour in Port Solano.', name: 'Hour on the Streets', id: 'hour-on-the-streets' },
];

// The trophy case lives on the state: unlocked maps trophy id -> game time
// it was earned, toasts is the banner queue the HUD drains.
export function createTrophyCase() {
  return { unlocked: {}, toasts: [] };
}

// Run once a frame from the main loop. Every trophy whose test passes for
// the first time is unlocked and queued as a banner.
export function checkTrophies(S) {
  const c = S.achievements;
  TROPHIES.forEach((t) => {
    if (t.id in c.unlocked) return;
    let passed = false;
    try { passed = t.test(S); } catch { passed = false; }
    if (!passed) return;
    c.unlocked[t.id] = S.time;
    c.toasts.push({ name: t.name, blurb: t.blurb, until: S.time + 5 });
    if (c.toasts.length > 3) c.toasts.shift();
  });
}

// The banner the HUD should show right now, or null. Expired banners are
// dropped so the toast never sticks on screen.
export function currentToast(S) {
  const c = S.achievements;
  while (c.toasts.length > 0 && c.toasts[0].until <= S.time) c.toasts.shift();
  if (c.toasts.length === 0) return null;
  return c.toasts[0];
}

export function trophyCount(S) {
  const ids = Object.keys(S.achievements.unlocked);
  return ids.length;
}

// Save shape: just the list of earned ids; the case is rebuilt on load.
export function trophySaveIds(S) {
  return Object.keys(S.achievements.unlocked);
}

export function trophyLoadIds(S, ids) {
  if (!Array.isArray(ids)) return;
  ids.forEach((id) => {
    if (TROPHIES.some((t) => t.id === id)) S.achievements.unlocked[id] = 0;
  });
}
