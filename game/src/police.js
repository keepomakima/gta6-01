// NEON TIDE v5 — wanted level and police: foot cops, cruisers, roadblocks,
// spike strips (wanted 4+) and the PIT maneuver (wanted 3+). Cops spawn at
// a distance and chase; lose them and the heat cools off on its own.
import { COP_FOOT_SPEED, CRUISER_SPAWN_DIST, SPIKE_MIN_WANTED, PIT_MIN_WANTED } from './config.js';
import { makeCar } from './entities.js';
import { dist, clamp, angleDiff } from './random.js';
import { burst } from './particles.js';

// Seconds between PIT attempts by the same cruiser.
const PIT_COOLDOWN = 6;

export function addWanted(g, n, reason) {
  if (g.mode !== 'play') return;
  g.wanted = clamp(g.wanted + n, 0, 5);
  g.wantedQuietT = 0;
  if (n > 0) g.popup(`WANTED ${g.wanted}★ ${reason || ''}`);
}

export function spawnCop(g, nearX, nearY) {
  // Spawn on a ring around the player, never closer than 200px: a spawn
  // point clamped back inside the city must not land on top of the player
  // (the old code could clamp a south spawn to 60px and bust instantly).
  let x = nearX, y = nearY - 320;
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2;
    const cx = clamp(nearX + Math.cos(a) * 320, 40, 2360);
    const cy = clamp(nearY + Math.sin(a) * 320, 40, 1560);
    if (dist(cx, cy, nearX, nearY) >= 200) { x = cx; y = cy; break; }
    x = cx; y = cy;
  }
  const cop = { x, y, speed: COP_FOOT_SPEED, hp: 50, fireT: 2 };
  g.cops.push(cop);
  return cop;
}

export function spawnCruiser(g) {
  const p = g.player;
  let x = p.x, y = Math.max(60, p.y - CRUISER_SPAWN_DIST);
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2;
    const cx = clamp(p.x + Math.cos(a) * CRUISER_SPAWN_DIST, 60, 2340);
    const cy = clamp(p.y + Math.sin(a) * CRUISER_SPAWN_DIST, 60, 1540);
    if (dist(cx, cy, p.x, p.y) >= 300) { x = cx; y = cy; break; }
    x = cx; y = cy;
  }
  const c = makeCar('cruiser', x, y, 0, false);
  c.pitT = 0;
  g.cruisers.push(c);
  return c;
}

export function updatePolice(g, dt) {
  const p = g.player;
  const w = g.wanted;
  // Keep the force proportional to the heat.
  const wantCops = w === 0 ? 0 : w <= 2 ? 2 : w <= 3 ? 3 : 4;
  while (g.cops.length < wantCops) spawnCop(g, p.x, p.y);
  if (g.cops.length > wantCops) g.cops.length = wantCops;
  const wantCruisers = w <= 1 ? 0 : w === 2 ? 1 : w === 3 ? 2 : 3;
  while (g.cruisers.length < wantCruisers) spawnCruiser(g);
  if (g.cruisers.length > wantCruisers) g.cruisers.length = wantCruisers;

  // Foot cops chase and grab the player on contact -> Busted.
  for (const cop of g.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d > 26) {
      const a = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
    } else if (w > 0 && g.mode === 'play' && !p.inCar) {
      // A foot cop only busts a player on foot — not one inside a car.
      g.busted();
    }
  }

  // Cruisers ram the player's car; at wanted 3+ they PIT: side-swipe,
  // spin the car and cut its speed. Cooldown per cruiser.
  for (const c of g.cruisers) {
    c.pitT = Math.max(0, (c.pitT || 0) - dt);
    const d = dist(c.x, c.y, p.x, p.y);
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    const want = Math.min(560, 260 + w * 60);
    c.angle += angleDiff(c.angle, a) * Math.min(1, dt * 2.2);
    c.speed += (want - c.speed) * Math.min(1, dt * 1.2);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (p.inCar && p.car && d < 90 && w >= PIT_MIN_WANTED && c.pitT <= 0) {
      c.pitT = PIT_COOLDOWN;
      p.car.spinT = 0.7;
      p.car.speed *= 0.55;
      g.shake = Math.min(12, g.shake + 6);
      g.popup('PIT MANEUVER!');
      burst(g.particles, p.car.x, p.car.y, 10, '#ffb84a', 200, 0.4);
      g.audio.crash();
    } else if (p.inCar && p.car && d < 34) {
      // Plain ram: damage both cars.
      p.car.cond -= 8 * dt * 10;
      p.car.speed *= 0.94;
      c.speed *= 0.9;
      if (p.car.cond <= 0) {
        g.popup('CAR WRECKED');
        g.exitCar(true);
      }
    }
    if (c.cond <= 0) {
      burst(g.particles, c.x, c.y, 16, '#ff8a4a', 240, 0.6);
      g.cruisers = g.cruisers.filter((x) => x !== c);
    }
  }

  // Roadblocks at wanted 3+: cruisers parked across the road ahead.
  g.roadblockT = (g.roadblockT || 0) - dt;
  if (w >= 3 && g.roadblockT <= 0) {
    g.roadblockT = 9;
    const a = p.inCar && p.car ? p.car.angle : p.angle;
    g.roadblocks.push({
      x: clamp(p.x + Math.cos(a) * 420, 80, 2320),
      y: clamp(p.y + Math.sin(a) * 420, 80, 1520),
      angle: a + Math.PI / 2, t: 12,
    });
  }
  for (const rb of g.roadblocks) rb.t -= dt;
  g.roadblocks = g.roadblocks.filter((rb) => rb.t > 0);

  // Spike strips at wanted 4+: dropped ahead of the player. Driving over
  // one flats a tyre — top speed -55% for 5s, condition -12.
  g.spikeT = (g.spikeT || 0) - dt;
  if (w >= SPIKE_MIN_WANTED && g.spikeT <= 0) {
    g.spikeT = 7;
    const a = p.inCar && p.car ? p.car.angle : p.angle;
    g.spikes.push({
      x: clamp(p.x + Math.cos(a) * 380, 80, 2320),
      y: clamp(p.y + Math.sin(a) * 380, 80, 1520),
      angle: a, t: 14,
    });
    g.spikeSeen = true;
  }
  for (const s of g.spikes) {
    s.t -= dt;
    if (p.inCar && p.car && dist(s.x, s.y, p.car.x, p.car.y) < 34 && p.car.flatT <= 0) {
      p.car.flatT = 5;
      p.car.cond -= 12;
      g.popup('SPIKE STRIP — TYRE FLAT!');
      burst(g.particles, p.car.x, p.car.y, 8, '#9ab8d8', 160, 0.4);
      g.audio.crash();
    }
  }
  g.spikes = g.spikes.filter((s) => s.t > 0);

  // Heat cools off when no police can see the player for a while.
  let nearest = Infinity;
  for (const cop of g.cops) nearest = Math.min(nearest, dist(cop.x, cop.y, p.x, p.y));
  for (const c of g.cruisers) nearest = Math.min(nearest, dist(c.x, c.y, p.x, p.y));
  if (nearest > 600) {
    g.wantedQuietT = (g.wantedQuietT || 0) + dt;
    if (g.wantedQuietT > 8 && w > 0) {
      g.wanted -= 1;
      g.wantedQuietT = 0;
      g.popup(`heat cooling… ${g.wanted}★`);
    }
  } else {
    g.wantedQuietT = 0;
  }

  g.audio.siren(w >= 2 && g.mode === 'play');
}
