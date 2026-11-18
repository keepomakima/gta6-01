// NEON TIDE v6-rebuild-2 — police.js
// Wanted 0-5, PSPD cruisers that chase, roadblocks at 3+, PIT maneuvers at
// 3+, spike strips at 4+, and the Busted / Wasted flow. In shot mode the
// whole system freezes so a staged screenshot keeps its wanted level.
import { WANTED } from './config.js';
import { makeCar } from './entities.js';

export function addWanted(S, n) {
  S.wanted = Math.max(0, Math.min(WANTED.max, S.wanted + n));
  if (n > 0) S.lastSeenAt = S.time;
}

export function updatePolice(S, dt) {
  if (S.shotMode) return; // frozen for staged screenshots
  const P = S.player;
  // Wanted decay: only while unseen for a while, one star at a time.
  if (S.wanted > 0 && S.time - S.lastSeenAt > WANTED.decayDelay) {
    S.wantedTimer += dt;
    if (S.wantedTimer > WANTED.decayEvery) {
      S.wantedTimer = 0;
      S.wanted -= 1;
    }
  } else if (S.wanted > 0) {
    S.wantedTimer = 0;
  }
  // How many cruisers should be out? One per star, capped at 5.
  const want = S.wanted;
  while (S.cruisers.length < want && S.cruisers.length < 5) {
    const a = Math.random() * Math.PI * 2;
    const car = makeCar('cruiser', P.x + Math.sin(a) * 220, P.z + Math.cos(a) * 220, a);
    car.ai = 'cruiser';
    S.cruisers.push(car);
  }
  while (S.cruisers.length > want) S.cruisers.pop();
  // Chase: steer toward the player, ram speed when close.
  for (const c of S.cruisers) {
    const dx = P.x - c.x, dz = P.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-3.2 * dt, Math.min(3.2 * dt, dh));
    const top = d < 60 ? 200 : 165;
    c.speed += (top - c.speed) * Math.min(1, dt * 1.2);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    const col = S.world.collideCircle(c.x, c.z, 4);
    c.x = col.x; c.z = col.z;
    // PIT maneuver at 3+: when alongside the player's car, shove it sideways.
    if (S.wanted >= WANTED.pitAt && P.car && d < 16 && Math.abs(dh) < 0.6) {
      if (!c.pitCooldown || S.time - c.pitCooldown > 6) {
        c.pitCooldown = S.time;
        P.car.heading += 0.7;
        P.car.speed *= 0.55;
        S.shake = Math.max(S.shake, 0.5);
        S.flash = 'PIT maneuver!';
      }
    }
    // Ram the player on foot: knockdown damage, and busted if caught.
    if (P.onFoot && d < 5) {
      P.health -= 20 * dt;
      if (S.time - (c.bustAt || 0) > 1.2) { c.bustAt = S.time; }
    }
    // The cops only "see" the player while a cruiser is close (within 150).
    // Setting lastSeenAt unconditionally made wanted never decay and the
    // M4 escape mission impossible.
    if (d < 150) S.lastSeenAt = S.time;
  }
  // Far from every cruiser, the heat cools twice as fast.
  if (S.wanted > 0 && S.cruisers.length > 0) {
    const nearest = Math.min(...S.cruisers.map((c) => Math.hypot(c.x - P.x, c.z - P.z)));
    if (nearest > 200) S.wantedTimer += dt;
  }
  // Busted: on foot, a cruiser within 4 units for over a second.
  if (P.onFoot && S.wanted > 0) {
    const near = S.cruisers.some((c) => Math.hypot(c.x - P.x, c.z - P.z) < 4.5);
    if (near) {
      S.bustedTimer = (S.bustedTimer || 0) + dt;
      if (S.bustedTimer > 1.2) busted(S);
    } else S.bustedTimer = 0;
  }
  // Roadblocks at 3+: two cruisers parked across the road ahead of the player.
  if (S.wanted >= WANTED.roadblockAt && !S.roadblock) {
    const hx = Math.sin(P.heading), hz = Math.cos(P.heading);
    S.roadblock = [
      makeCar('cruiser', P.x + hx * 160 - hz * 12, P.z + hz * 160 + hx * 12, P.heading + Math.PI / 2),
      makeCar('cruiser', P.x + hx * 160 + hz * 12, P.z + hz * 160 - hx * 12, P.heading + Math.PI / 2),
    ];
    S.roadblockAt = S.time;
  }
  if (S.roadblock && (S.wanted < WANTED.roadblockAt || S.time - S.roadblockAt > 25)) S.roadblock = null;
  // Spike strips at 4+: dropped ahead of the player's car; driving over one
  // bursts a tire (top speed -55% for 5s, condition -12).
  if (S.wanted >= WANTED.spikeAt && P.car && !S.spike) {
    const hx = Math.sin(P.heading), hz = Math.cos(P.heading);
    S.spike = { x: P.x + hx * 90, z: P.z + hz * 90, until: S.time + 20 };
  }
  if (S.spike) {
    if (S.time > S.spike.until) S.spike = null;
    else if (P.car && Math.hypot(P.car.x - S.spike.x, P.car.z - S.spike.z) < 8) {
      P.car.tireBurstUntil = S.time + 5;
      P.car.cond = Math.max(5, P.car.cond - 12);
      S.spike = null;
      S.flash = 'Tire burst! Spike strip!';
      S.shake = Math.max(S.shake, 0.6);
    }
  }
}

export function busted(S) {
  if (S.ui.screen !== 'playing') return;
  S.ui.screen = 'busted';
  const fine = Math.min(S.player.money, 500);
  S.player.money -= fine;
  S.wanted = 0;
  S.cruisers.length = 0;
  S.roadblock = null;
  S.player.health = 100;
}

// Wasted: health hit zero — respawn at the hospital, lose some cash.
export function wasted(S) {
  if (S.ui.screen !== 'playing') return;
  S.ui.screen = 'wasted';
  S.player.money = Math.max(0, S.player.money - 300);
  S.player.health = 100;
  S.wanted = 0;
  S.cruisers.length = 0;
  S.roadblock = null;
}
