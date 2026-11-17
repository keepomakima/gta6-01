// NEON TIDE — police.js
// The wanted system: heat builds stars, cops spawn and chase, roadblocks
// appear at 3 stars, and getting caught or killed sends Deke to the station
// or the hospital with a lighter wallet.

import { WANTED_MAX, HEAT_PER_STAR, PLACES } from './config.js';
import { clamp, dist, randRange, angleDiff } from './random.js';
import { createCar, stepCar, addMessage, explodeCar } from './entities.js';
import { randomRoadPoint } from './world.js';
import { burst, shake } from './particles.js';

// Stars from heat: 100 heat per star, capped at 5.
export function wantedStars(G) {
  return Math.min(WANTED_MAX, Math.floor((G.heat || 0) / HEAT_PER_STAR));
}

// Called every frame: decay heat when the player is unseen, spawn and drive
// the police response for the current star level.
export function updatePolice(G, dt) {
  const p = G.player;
  const stars = wantedStars(G);
  G.wanted = stars;
  G.wantedT = (G.wantedT || 0) + dt;

  // Heat decay: only when no cop can see the player.
  const nearestCop = nearestCopDist(G);
  const seen = nearestCop < 520;
  G.lastSeenT = seen ? 0 : (G.lastSeenT || 0) + dt;
  if (!seen && G.heat > 0) {
    G.heat = Math.max(0, G.heat - dt * 9);
  }

  // Desired police presence grows with stars.
  const wantCruisers = stars === 0 ? 0 : stars === 1 ? 1 : stars === 2 ? 2 : stars + 1;
  const wantFoot = stars >= 2 ? stars - 1 : 0;
  const cruisers = G.cars.filter((c) => c.driver === 'police');
  const foot = G.cops.filter((c) => c.hp > 0);
  if (cruisers.length < wantCruisers && G.frame % 45 === 0) {
    spawnCruiser(G);
  }
  if (foot.length < wantFoot && G.frame % 60 === 0) {
    spawnFootCop(G);
  }

  // Roadblocks at 3+ stars: a line of cruisers ahead of the player.
  if (stars >= 3 && !G.roadblock && G.frame % 200 === 0) {
    spawnRoadblock(G);
  }
  if (stars < 3 && G.roadblock) {
    G.roadblock = null;
  }

  updateCruisers(G, dt);
  updateFootCops(G, dt);

  // Busted: a foot cop touches the player while wanted.
  if (stars > 0 && p.hp > 0 && !p.inCar) {
    for (const cop of G.cops) {
      if (cop.hp > 0 && dist(cop.x, cop.y, p.x, p.y) < 26) {
        busted(G);
        return;
      }
    }
  }
  // Wasted: the player is run over hard by a cruiser at speed.
  for (const car of cruisers) {
    if (Math.abs(car.speed) > 240 && dist(car.x, car.y, p.x, p.y) < 26 && !p.inCar) {
      damagePlayer(G, 45, 'run over');
    }
  }
}

export function nearestCopDist(G) {
  const p = G.player;
  let best = Infinity;
  for (const c of G.cars) {
    if (c.driver === 'police') best = Math.min(best, dist(c.x, c.y, p.x, p.y));
  }
  for (const c of G.cops) {
    if (c.hp > 0) best = Math.min(best, dist(c.x, c.y, p.x, p.y));
  }
  return best;
}

export function spawnCruiser(G) {
  const p = G.player;
  const spot = randomRoadPoint(G.rng, p.x, p.y, 500);
  const car = createCar(G, 'cruiser', spot.x, spot.y, 0, { driver: 'police' });
  car.color = '#2b3a55';
  G.cars.push(car);
  G.audio.sirenBlip();
  return car;
}

export function spawnFootCop(G) {
  const p = G.player;
  const spot = randomRoadPoint(G.rng, p.x, p.y, 380);
  const cop = {
    kind: 'cop',
    x: spot.x, y: spot.y,
    angle: Math.atan2(p.y - spot.y, p.x - spot.x),
    hp: 80, speed: randRange(G.rng, 130, 160),
    shirt: '#24344d', state: 'chase',
    shootCooldown: randRange(G.rng, 1, 2),
    flashT: 0, walkAnim: 0, deadT: 0,
  };
  G.cops.push(cop);
  return cop;
}

function spawnRoadblock(G) {
  const p = G.player;
  const a = p.angle;
  const bx = p.x + Math.cos(a) * 420;
  const by = p.y + Math.sin(a) * 420;
  const cars = [];
  for (let i = -1; i <= 1; i += 1) {
    const px = bx + Math.cos(a + Math.PI / 2) * i * 60;
    const py = by + Math.sin(a + Math.PI / 2) * i * 60;
    const car = createCar(G, 'cruiser', px, py, a + Math.PI / 2, { driver: 'police' });
    car.speed = 0;
    car.ai = { roadblock: true };
    G.cars.push(car);
    cars.push(car);
  }
  G.roadblock = { x: bx, y: by, cars, t: 25 };
  addMessage(G, 'Roadblock ahead!', '#ff8a7a');
}

function updateCruisers(G, dt) {
  const p = G.player;
  const stars = wantedStars(G);
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.driver !== 'police') continue;
    if (car.hp <= 0) {
      // A wrecked cruiser is abandoned by its driver.
      car.driver = null;
      continue;
    }
    if (car.ai?.roadblock) {
      // Roadblock cruisers sit still until the block expires or is rammed.
      // The block may already be cleared (heat dropped below 3 stars), in
      // which case the cruiser just stands down.
      if (!G.roadblock) {
        car.driver = null;
        car.ai = null;
        continue;
      }
      G.roadblock.t -= dt;
      if (G.roadblock.t <= 0 || stars < 3) {
        car.driver = null;
        car.ai = null;
      }
      continue;
    }
    // Chase: steer toward the player, ram when close.
    const wantAngle = Math.atan2(p.y - car.y, p.x - car.x);
    const diff = angleDiff(car.angle, wantAngle);
    const steer = clamp(diff * 1.6, -1, 1);
    const d = dist(car.x, car.y, p.x, p.y);
    const throttle = d > 60 ? 1 : 0.4;
    const brake = d < 40 ? 0.5 : 0;
    stepCar(G, car, steer, throttle, brake, false, dt);
    // Siren flash light.
    car.sirenT = (car.sirenT || 0) + dt;
    // Ram the player's car on contact.
    if (p.inCar) {
      const pc = G.cars.find((c) => c.id === p.inCar);
      if (pc && dist(car.x, car.y, pc.x, pc.y) < 46) {
        pc.hp -= 2;
        car.hp -= 1;
        if (G.frame % 20 === 0) {
          burst(G, car.x, car.y, { count: 5, speedMin: 60, speedMax: 160, life: 0.3, size: 3, color: '#ffb347' });
          G.audio.crash();
          shake(G, 3);
        }
      }
    }
    // Despawn far away when the heat is gone.
    if (stars === 0 && d > 900) {
      G.cars.splice(i, 1);
    }
  }
  if (G.roadblock && G.roadblock.t <= 0) G.roadblock = null;
}

function updateFootCops(G, dt) {
  const p = G.player;
  for (let i = G.cops.length - 1; i >= 0; i -= 1) {
    const cop = G.cops[i];
    if (cop.hp <= 0) {
      cop.deadT += dt;
      if (cop.deadT > 8) G.cops.splice(i, 1);
      continue;
    }
    cop.flashT = Math.max(0, cop.flashT - dt);
    cop.shootCooldown -= dt;
    const d = dist(cop.x, cop.y, p.x, p.y);
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    if (d > 30) {
      const sp = cop.speed * (d > 200 ? 1.25 : 1);
      cop.x += Math.cos(cop.angle) * sp * dt;
      cop.y += Math.sin(cop.angle) * sp * dt;
      cop.walkAnim += dt * 9;
    }
    // Cops shoot at 3+ stars when the player is armed and in range.
    if (wantedStars(G) >= 3 && d < 380 && d > 60 && cop.shootCooldown <= 0) {
      cop.shootCooldown = randRange(G.rng, 1.1, 2.0);
      const a = cop.angle + randRange(G.rng, -0.1, 0.1);
      G.bullets.push({
        x: cop.x + Math.cos(a) * 22, y: cop.y + Math.sin(a) * 22,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        damage: 8, fromPlayer: false, life: 1.0,
      });
      G.audio.gunshot();
    }
    // Punch the player up close.
    if (d < 30 && G.frame % 50 === 0) {
      damagePlayer(G, 8, 'cop');
      G.audio.punch();
    }
  }
}

// Damage the player, honouring armor first. Triggers wasted at 0 HP.
export function damagePlayer(G, dmg, cause) {
  const p = G.player;
  if (p.hp <= 0 || G.mode !== 'play') return;
  let rest = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  shake(G, 4);
  burst(G, p.x, p.y, { count: 6, speedMin: 40, speedMax: 140, life: 0.35, size: 3, color: '#ff5a5a' });
  if (p.hp <= 0) {
    p.hp = 0;
    wasted(G, cause);
  }
}

export function busted(G) {
  const p = G.player;
  G.mode = 'busted';
  G.audio.busted();
  const fine = Math.min(p.money, Math.max(100, Math.floor(p.money * 0.1)));
  p.money -= fine;
  G.stats.busted += 1;
  G.bustedInfo = { fine, place: PLACES.policeStation.label };
  clearHeat(G);
  // Respawn at the police station.
  p.x = PLACES.policeStation.x;
  p.y = PLACES.policeStation.y;
  p.hp = p.maxHp;
  p.armor = 0;
  if (p.inCar) {
    const car = G.cars.find((c) => c.id === p.inCar);
    if (car) car.driver = null;
    p.inCar = null;
  }
  // Cops stand down.
  for (const c of G.cars) if (c.driver === 'police') c.driver = null;
  G.cops.length = 0;
  G.roadblock = null;
}

export function wasted(G, cause) {
  const p = G.player;
  G.mode = 'wasted';
  G.audio.wasted();
  const lost = Math.min(p.money, Math.max(100, Math.floor(p.money * 0.1)));
  p.money -= lost;
  G.stats.wasted += 1;
  G.wastedInfo = { lost, cause: cause || 'unknown', place: PLACES.hospital.label };
  clearHeat(G);
  p.x = PLACES.hospital.x;
  p.y = PLACES.hospital.y;
  p.hp = p.maxHp;
  p.armor = 0;
  if (p.inCar) {
    const car = G.cars.find((c) => c.id === p.inCar);
    if (car) {
      car.driver = null;
      if (car.hp <= 0) explodeCar(G, car);
    }
    p.inCar = null;
  }
  for (const c of G.cars) if (c.driver === 'police') c.driver = null;
  G.cops.length = 0;
  G.roadblock = null;
}

export function clearHeat(G) {
  G.heat = 0;
  G.wanted = 0;
}
