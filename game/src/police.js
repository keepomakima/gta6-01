// NEON TIDE v4 — police: wanted stars, foot cops, cruiser pursuit, roadblocks,
// busted/wasted. One job: make the law respond to crime and let the heat cool.
import { MAX_WANTED, WANTED_DECAY_SECONDS, PLACES } from './config.js';
import { makeCar } from './entities.js';
import { rectBlocked } from './world.js';

export function addWanted(G, stars) {
  G.wanted = Math.min(MAX_WANTED, G.wanted + stars);
  G.heatT = 0;
  G.lastSeenT = 0;
  if (G.wanted >= 1) G.audio.sfx('siren');
}

export function crimeSeen(G) {
  // Crimes only raise heat when a cop is near enough to witness them.
  for (const cop of G.cops) {
    if (Math.hypot(cop.x - G.player.x, cop.y - G.player.y) < 420) return true;
  }
  for (const c of G.cars) {
    if (c.type === 'cruiser' && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 500) return true;
  }
  return G.wanted > 0;
}

export function spawnFootCop(G, x, y) {
  G.cops.push({
    x, y, angle: 0, hp: 50, speed: 165, shootCd: 1.5, state: 'chase',
    name: `UNIT ${String(G.cops.length + 1).padStart(2, '0')}`,
  });
}

export function spawnCruiser(G) {
  const p = G.player;
  const ang = Math.random() * Math.PI * 2;
  const x = Math.max(80, Math.min(2520, p.x + Math.cos(ang) * 520));
  const y = Math.max(80, Math.min(1720, p.y + Math.sin(ang) * 520));
  const car = makeCar('cruiser', x, y, Math.atan2(p.y - y, p.x - x), 'police');
  car.speed = 200;
  G.cars.push(car);
  G.cruisers.push(car);
  return car;
}

export function policeUnitList(G) {
  // Named units with distance + status for the police response panel.
  const p = G.player;
  const units = [];
  for (const cop of G.cops) {
    units.push({
      name: cop.name || 'UNIT',
      dist: Math.round(Math.hypot(cop.x - p.x, cop.y - p.y) / 10),
      status: cop.state === 'chase' ? 'PURSUIT' : cop.state.toUpperCase(),
    });
  }
  for (const c of G.cruisers) {
    units.push({
      name: 'PSPD-' + String(G.cruisers.indexOf(c) + 1).padStart(2, '0'),
      dist: Math.round(Math.hypot(c.x - p.x, c.y - p.y) / 10),
      status: 'RAMMING',
    });
  }
  if (G.heli.active) {
    units.push({ name: 'AIR-1', dist: Math.round(G.heli.dist / 10), status: G.heli.spotOn ? 'SPOTLIGHT' : 'IN SIGHT' });
  }
  if (G.roadblock && G.wanted >= 3) {
    units.push({ name: 'ROADBLOCK', dist: Math.round(Math.hypot(G.roadblock.x - p.x, G.roadblock.y - p.y) / 10), status: 'ROADBLOCK' });
  }
  return units.slice(0, 5);
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Spawn pressure scales with stars.
  const wantCops = G.wanted >= 1 ? Math.min(2 + G.wanted, 6) : 0;
  const wantCruisers = G.wanted >= 2 ? Math.min(G.wanted - 1, 3) : 0;
  if (G.cops.length < wantCops && Math.random() < dt * 0.8) {
    const ang = Math.random() * Math.PI * 2;
    spawnFootCop(G, p.x + Math.cos(ang) * 380, p.y + Math.sin(ang) * 380);
  }
  if (G.cruisers.length < wantCruisers && Math.random() < dt * 0.5) spawnCruiser(G);

  // Roadblock at 3+ stars: a cruiser parked across the road ahead.
  if (G.wanted >= 3 && !G.roadblock) {
    const ahead = p.inCar ? p.inCar.angle : p.angle;
    const bx = p.x + Math.cos(ahead) * 420;
    const by = p.y + Math.sin(ahead) * 420;
    const car = makeCar('cruiser', bx, by, ahead + Math.PI / 2, 'roadblock');
    G.cars.push(car);
    G.roadblock = { x: bx, y: by, car, t: 0 };
  }
  if (G.roadblock) {
    G.roadblock.t += dt;
    if (G.wanted < 3 || G.roadblock.t > 40) {
      const car = G.roadblock.car;
      if (car) { car.driver = null; car.parked = true; }
      G.roadblock = null;
    }
  }

  // Foot cops chase and shoot.
  for (const cop of G.cops) {
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    if (d > 34) {
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      if (!rectBlocked(G.world, nx, ny, 12)) { cop.x = nx; cop.y = ny; }
    } else if (G.mode === 'play' && p.onFoot) {
      // Busted: a cop catches the player on foot (never inside a moving car).
      bustPlayer(G, 'busted');
    }
    cop.shootCd -= dt;
    if (d < 340 && cop.shootCd <= 0) {
      cop.shootCd = 1.6 + Math.random();
      if (Math.random() < 0.45) {
        damagePlayer(G, 8, 'cop');
        G.particles.muzzle(cop.x, cop.y, cop.angle);
        G.audio.sfx('shot');
      }
    }
  }

  // Cruisers ram the player's car (or chase on foot).
  for (const c of G.cruisers) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const target = Math.atan2(p.y - c.y, p.x - c.x);
    let diff = target - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    c.speed = Math.min(430, c.speed + 120 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    c.x = nx; c.y = ny;
    if (d < 44 && p.inCar) {
      p.inCar.hp -= 14;
      G.particles.sparks(p.x, p.y);
      G.audio.sfx('crash');
      G.shake = 7;
      c.speed *= 0.4;
    } else if (d < 30 && p.onFoot && G.mode === 'play') {
      bustPlayer(G, 'busted');
    }
  }

  // Heat decays only when no cop can see the player.
  let seen = false;
  for (const cop of G.cops) if (Math.hypot(cop.x - p.x, cop.y - p.y) < 380) seen = true;
  for (const c of G.cruisers) if (Math.hypot(c.x - p.x, c.y - p.y) < 420) seen = true;
  if (G.heli.active && G.heli.spotOn) seen = true;
  if (!seen && G.wanted > 0) {
    G.heatT += dt;
    if (G.heatT > WANTED_DECAY_SECONDS) {
      G.wanted -= 1;
      G.heatT = 0;
      if (G.wanted === 0) standDown(G);
    }
  } else {
    G.heatT = 0;
  }
  G.lastSeenT = seen ? 0 : G.lastSeenT + dt;
}

export function standDown(G) {
  G.cops = [];
  for (const c of G.cruisers) { c.driver = null; c.parked = true; }
  G.cruisers = [];
  if (G.roadblock) { G.roadblock.car.driver = null; G.roadblock = null; }
  G.heli.active = false;
  G.heli.spotOn = false;
}

export function damagePlayer(G, amount, source) {
  const p = G.player;
  if (G.mode !== 'play' || p.hurtT > 0) return;
  p.hurtT = 0.5;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  G.shake = Math.max(G.shake, 4);
  if (p.hp <= 0) {
    p.hp = 0;
    bustPlayer(G, 'wasted');
  }
}

export function bustPlayer(G, kind) {
  const p = G.player;
  if (G.mode !== 'play') return;
  G.mode = kind;
  G.audio.sfx('fail');
  const fine = kind === 'busted' ? 100 : 200;
  p.money = Math.max(0, p.money - fine);
  p.hp = 100;
  p.armor = 0;
  standDown(G);
  G.wanted = 0;
  if (p.inCar) { p.inCar.driver = null; p.inCar = null; p.onFoot = true; }
  const spot = kind === 'busted' ? PLACES.policeHQ : PLACES.hospital;
  p.x = spot.x; p.y = spot.y;
  G.bustedKind = kind;
}
