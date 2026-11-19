// NEON TIDE v7-coverfix — police.js (structural pass)
// The wanted system: heat decays once Deke is unseen; the response
// scales with stars — one cruiser per star, roadblock at 3, PIT at 3,
// spike strip at 4, helicopter at 4.
import { WANTED } from './config.js';
import { makeCar } from './entities.js';

export function addWanted(S, n) {
  S.wanted += n;
  if (S.wanted > WANTED.max) S.wanted = WANTED.max;
  if (S.wanted < 0) S.wanted = 0;
  if (n > 0) S.lastSeenAt = S.time;
}

// One cruiser's chase: steer toward Deke, speed up when close, PIT the
// car at 3+ stars, and bust Deke on foot if it gets close enough.
function chaseCruiser(S, c, P, dt) {
  const dx = P.x - c.x, dz = P.z - c.z;
  let d = Math.hypot(dx, dz);
  if (!d) d = 1;
  const wantHeading = Math.atan2(dx, dz);
  let dh = wantHeading - c.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  let turn = dh;
  if (turn > 3.2 * dt) turn = 3.2 * dt;
  if (turn < -3.2 * dt) turn = -3.2 * dt;
  c.heading += turn;
  let top = 165;
  if (d < 60) top = 200;
  let k = dt * 1.2;
  if (k > 1) k = 1;
  c.speed += (top - c.speed) * k;
  c.x += Math.sin(c.heading) * c.speed * dt;
  c.z += Math.cos(c.heading) * c.speed * dt;
  const col = S.world.collideCircle(c.x, c.z, 4);
  c.x = col.x;
  c.z = col.z;
  if (S.wanted >= WANTED.pitAt && P.car && d < 16 && Math.abs(dh) < 0.6) {
    if (!c.pitCooldown || S.time - c.pitCooldown > 6) {
      c.pitCooldown = S.time;
      P.car.heading += 0.7;
      P.car.speed *= 0.55;
      if (S.shake < 0.5) S.shake = 0.5;
      S.flash = 'PIT maneuver!';
    }
  }
  if (P.onFoot && d < 5) {
    P.health -= 20 * dt;
    const lastBust = c.bustAt ? c.bustAt : 0;
    if (S.time - lastBust > 1.2) { c.bustAt = S.time; }
  }
  if (d < 150) S.lastSeenAt = S.time;
  return d;
}

// Roadblock: two cruisers parked across the road ahead of Deke.
function spawnRoadblock(S, P) {
  const hx = Math.sin(P.heading), hz = Math.cos(P.heading);
  const a = makeCar('cruiser', P.x + hx * 160 - hz * 12, P.z + hz * 160 + hx * 12, P.heading + Math.PI / 2);
  const b = makeCar('cruiser', P.x + hx * 160 + hz * 12, P.z + hz * 160 - hx * 12, P.heading + Math.PI / 2);
  S.roadblock = [a, b];
  S.roadblockAt = S.time;
}

// Spike strip: laid ahead of Deke's car, gone after 20 s or on the
// first tire it shreds.
function updateSpike(S, P) {
  if (S.wanted >= WANTED.spikeAt) {
    if (P.car && !S.spike) {
      const hx = Math.sin(P.heading), hz = Math.cos(P.heading);
      S.spike = { until: S.time + 20, x: P.x + hx * 90, z: P.z + hz * 90 };
    }
  }
  if (!S.spike) return;
  if (S.time > S.spike.until) S.spike = null;
  else if (P.car && Math.hypot(P.car.x - S.spike.x, P.car.z - S.spike.z) < 8) {
    P.car.tireBurstUntil = S.time + 5;
    P.car.cond = Math.max(5, P.car.cond - 12);
    S.spike = null;
    S.flash = 'Tire burst! Spike strip!';
    if (S.shake < 0.6) S.shake = 0.6;
  }
}

export function updatePolice(S, dt) {
  if (S.shotMode) return; // frozen for staged screenshots
  const P = S.player;
  if (S.wanted > 0) {
    if (S.time - S.lastSeenAt > WANTED.decayDelay) {
      S.wantedTimer += dt;
      if (S.wantedTimer > WANTED.decayEvery) {
        S.wantedTimer = 0;
        S.wanted -= 1;
      }
    } else {
      S.wantedTimer = 0;
    }
  }
  const want = S.wanted;
  while (S.cruisers.length < want && S.cruisers.length < 5) {
    const a = Math.random() * Math.PI * 2;
    const car = makeCar('cruiser', P.x + Math.sin(a) * 220, P.z + Math.cos(a) * 220, a);
    car.ai = 'cruiser';
    S.cruisers.push(car);
  }
  if (S.cruisers.length > want) S.cruisers.length = want;
  const nearest = Math.min(...S.cruisers.map((c) => chaseCruiser(S, c, P, dt)));
  if (S.wanted > 0 && S.cruisers.length > 0 && nearest > 200) {
    S.wantedTimer += dt;
  }
  if (P.onFoot && S.wanted > 0) {
    const near = S.cruisers.some((c) => Math.hypot(c.x - P.x, c.z - P.z) < 4.5);
    if (near) {
      S.bustedTimer = (S.bustedTimer || 0) + dt;
      if (S.bustedTimer > 1.2) busted(S);
    } else S.bustedTimer = 0;
  }
  if (S.wanted >= WANTED.roadblockAt) {
    if (!S.roadblock) spawnRoadblock(S, P);
  }
  if (S.roadblock && (S.wanted < WANTED.roadblockAt || S.time - S.roadblockAt > 25)) S.roadblock = null;
  updateSpike(S, P);
}

// Busted: a $500 fine (or whatever Deke has); the heat stands down.
export function busted(S) {
  if (S.ui.screen !== 'playing') return;
  S.ui.screen = 'busted';
  let fine = 500;
  if (S.player.money < fine) fine = S.player.money;
  S.player.money -= fine;
  S.wanted = 0;
  S.cruisers.length = 0;
  S.roadblock = null;
  S.player.health = 100;
}

// Wasted: the hospital patches Deke up for $300; heat stands down.
export function wasted(S) {
  if (S.ui.screen !== 'playing') return;
  S.ui.screen = 'wasted';
  S.player.money -= 300;
  if (S.player.money < 0) S.player.money = 0;
  S.player.health = 100;
  S.wanted = 0;
  S.cruisers.length = 0;
  S.roadblock = null;
}
