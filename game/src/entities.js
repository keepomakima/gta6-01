// Everyone who lives in Port Solano: the player on foot and in cars, traffic,
// pedestrians, police and gang members. All movement, collisions, stealing,
// combat and the wanted system live here. Missions only read this state.
import { CRIME_HEAT, H_ROADS, LANE, PLACES, PLAYER, V_ROADS, VEHICLES, WANTED_HEAT, WEAPONS, WORLD } from './config.js';

let nextId = 1;
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

export function wantedLevel(heat) {
  let level = 0;
  for (let i = 0; i < WANTED_HEAT.length; i += 1) if (heat >= WANTED_HEAT[i]) level = i;
  return level;
}

export function makeCar(G, type, x, y, angle, driver) {
  const spec = VEHICLES[type];
  return {
    id: nextId += 1, type, x, y, angle, speed: 0, hp: spec.hp, maxHp: spec.hp,
    driver, color: spec.color, w: 46, h: 24, smoke: 0,
    // traffic AI fields
    axis: 'v', road: 0, dir: 1, targetSpeed: 0, turnCd: 0, block: false,
  };
}

export function makePed(G, x, y) {
  return {
    id: nextId += 1, x, y, angle: G.rng.range(0, Math.PI * 2),
    speed: G.rng.range(28, 52), state: 'walk', fleeX: 0, fleeY: 0, fleeT: 0,
    color: G.rng.pick(['#c2a878', '#8c5a3a', '#5a7a8c', '#7a5a8c', '#a8a8a8', '#3a6e4a']),
    road: G.rng.pick(V_ROADS), vertical: G.rng.chance(0.5), dir: G.rng.chance(0.5) ? 1 : -1,
  };
}

export function spawnParkedCars(G) {
  const types = ['sedan', 'taxi', 'sport', 'truck'];
  for (let i = 0; i < 16; i += 1) {
    const vx = G.rng.pick(V_ROADS);
    const hy = G.rng.pick(H_ROADS);
    const vertical = G.rng.chance(0.5);
    const x = vertical ? vx + (G.rng.chance(0.5) ? LANE + 12 : -LANE - 12) : G.rng.range(120, WORLD.w - 120);
    const y = vertical ? G.rng.range(120, WORLD.h - 120) : hy + (G.rng.chance(0.5) ? LANE + 12 : -LANE - 12);
    if (G.city.solidAt(x, y, 20)) continue;
    const car = makeCar(G, G.rng.pick(types), x, y, vertical ? Math.PI / 2 : 0, 'parked');
    car.angle = vertical ? (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (G.rng.chance(0.5) ? 0 : Math.PI);
    G.cars.push(car);
  }
  // The mission sport car, parked by the boardwalk, always there.
  const sc = makeCar(G, 'sport', PLACES.sportCar.x, PLACES.sportCar.y, Math.PI / 2, 'parked');
  sc.missionCar = true;
  G.cars.push(sc);
}

export function spawnTraffic(G, count) {
  const types = ['sedan', 'taxi', 'sedan', 'truck', 'taxi'];
  for (let i = 0; i < count; i += 1) {
    const vertical = G.rng.chance(0.5);
    const road = vertical ? G.rng.pick(V_ROADS) : G.rng.pick(H_ROADS);
    const dir = G.rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? LANE : -LANE;
    const x = vertical ? road + lane : G.rng.range(100, WORLD.w - 100);
    const y = vertical ? G.rng.range(100, WORLD.h - 100) : road + lane;
    const car = makeCar(G, G.rng.pick(types), x, y, vertical ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI), 'traffic');
    car.axis = vertical ? 'v' : 'h';
    car.road = road;
    car.dir = dir;
    car.targetSpeed = G.rng.range(90, 170);
    car.speed = car.targetSpeed;
    G.cars.push(car);
  }
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i += 1) {
    const vertical = G.rng.chance(0.5);
    const road = vertical ? G.rng.pick(V_ROADS) : G.rng.pick(H_ROADS);
    const side = G.rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * (LANE + 26) : G.rng.range(100, WORLD.w - 100);
    const y = vertical ? G.rng.range(100, WORLD.h - 100) : road + side * (LANE + 26);
    if (G.city.solidAt(x, y, 8)) continue;
    G.peds.push(makePed(G, x, y));
  }
}

export function spawnEnemies(G, x, y, count, hp = 60) {
  const made = [];
  for (let i = 0; i < count; i += 1) {
    const e = {
      id: nextId += 1,
      x: x + G.rng.range(-70, 70), y: y + G.rng.range(-70, 70),
      angle: G.rng.range(0, Math.PI * 2), hp, speed: G.rng.range(70, 95),
      shootCd: G.rng.range(0.5, 1.5), mission: true, dead: false,
      color: '#8c2f3a', label: 'Tidebreaker',
    };
    if (G.city.solidAt(e.x, e.y, 12)) { e.x = x; e.y = y; }
    G.enemies.push(e);
    made.push(e);
  }
  return made;
}

export function spawnPickup(G, kind, x, y, amount = 0) {
  G.pickups.push({ kind, x, y, amount, bob: G.rng.range(0, Math.PI * 2) });
}

export function addHeat(G, amount, reason) {
  const p = G.player;
  p.heat = clamp(p.heat + amount, 0, 340);
  if (reason) G.feed.push(reason);
}

export function nearestCopDist(G) {
  let best = Infinity;
  for (const c of G.cops) {
    const d = c.car ? dist(c.car.x, c.car.y, G.player.x, G.player.y) : dist(c.x, c.y, G.player.x, G.player.y);
    if (d < best) best = d;
  }
  return best;
}

// --- player ---------------------------------------------------------------

export function updatePlayer(G, dt, input) {
  const p = G.player;
  if (p.dead) return;
  p.attackCd = Math.max(0, (p.attackCd || 0) - dt);

  if (p.car) {
    const car = p.car;
    const spec = VEHICLES[car.type];
    const steer = input.steer();
    const throttle = input.throttle();
    const target = throttle > 0 ? spec.top : throttle < 0 ? -spec.top * 0.45 : 0;
    const accel = throttle !== 0 ? spec.accel : 200;
    car.speed += clamp(target - car.speed, -accel * dt, accel * dt);
    if (throttle === 0) car.speed *= Math.max(0, 1 - 1.6 * dt);
    const grip = input.held.brake ? spec.grip * 0.45 : spec.grip;
    car.angle += steer * grip * (car.speed / spec.top) * dt * (car.speed < 0 ? -1 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const moved = G.city.moveCircle(car.x, car.y, 17, nx - car.x, ny - car.y);
    const hitWall = (moved.x !== nx || moved.y !== ny) && Math.abs(car.speed) > 60;
    car.hitCd = Math.max(0, (car.hitCd || 0) - dt);
    if (hitWall) {
      // Kill the forward speed so the car stops grinding into the wall;
      // damage only once a second, scaled by the impact.
      const impact = Math.abs(car.speed);
      car.speed *= 0.2;
      if (car.hitCd <= 0) {
        car.hitCd = 1.0;
        car.hp -= impact * 0.02;
        G.particles.crash(moved.x, moved.y);
        G.audio.crash(clamp(impact / 300, 0.2, 1));
        G.shake = Math.min(10, impact * 0.02);
        addHeat(G, 2);
      }
    }
    car.x = moved.x;
    car.y = moved.y;
    if (input.held.brake && Math.abs(car.speed) > 80) {
      G.particles.skid(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
    }
    if (Math.random() < dt * 2 && Math.abs(car.speed) > 60) G.particles.exhaust(car.x, car.y, car.angle);
    if (car.hp < car.maxHp * 0.35 && Math.random() < dt * 8) G.particles.smoke(car.x, car.y - 6);
    if (car.hp <= 0) {
      G.particles.crash(car.x, car.y);
      G.audio.crash(1);
      exitCar(G, true);
      addHeat(G, 10, 'Your car is wrecked.');
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    G.audio.setEngine(Math.abs(car.speed) / spec.top, true);
    return;
  }

  // On foot.
  const speed = input.held.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = input.steer();
  const my = input.throttle() * -1; // W is up on screen (negative y)
  let dx = mx;
  let dy = my;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx = (dx / len) * speed * dt;
    dy = (dy / len) * speed * dt;
    const moved = G.city.moveCircle(p.x, p.y, PLAYER.radius, dx, dy);
    p.x = moved.x;
    p.y = moved.y;
    p.angle = Math.atan2(dy, dx);
    p.moving = true;
  } else {
    p.moving = false;
  }
  G.audio.setEngine(0, false);
}

export function tryEnterCar(G) {
  const p = G.player;
  if (p.car) { exitCar(G, false); return; }
  let best = null;
  let bestD = 58;
  // A mission car in reach always wins over whatever else is parked nearby.
  for (const car of G.cars) {
    if (car.driver === 'cop' || !car.missionCar) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) {
    for (const car of G.cars) {
      if (car.driver === 'cop') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
  }
  if (!best) return false;
  if (best.driver === 'traffic') {
    // The driver bails out and runs.
    const driver = makePed(G, best.x, best.y);
    driver.state = 'flee';
    driver.fleeX = p.x; driver.fleeY = p.y; driver.fleeT = 3;
    G.peds.push(driver);
    addHeat(G, CRIME_HEAT.steal, 'Car stolen — the driver ran for the police.');
  } else if (best.driver === 'parked') {
    const copNear = nearestCopDist(G) < 380;
    if (copNear) addHeat(G, CRIME_HEAT.steal, 'Car stolen in front of the PSPD.');
  }
  best.driver = 'player';
  p.car = best;
  G.audio.click();
  if (best.missionCar) G.flags.stoleMissionCar = true;
  return true;
}

export function exitCar(G, wrecked) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = wrecked ? 'wreck' : 'parked';
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  const px = car.x + Math.cos(side) * 34;
  const py = car.y + Math.sin(side) * 34;
  const spot = G.city.solidAt(px, py, PLAYER.radius) ? { x: car.x, y: car.y } : { x: px, y: py };
  p.x = spot.x;
  p.y = spot.y;
  p.car = null;
}

export function playerShoot(G, worldX, worldY) {
  const p = G.player;
  if (p.attackCd > 0 || p.dead) return;
  if (p.weapon === 'pistol') {
    if (p.ammo <= 0) { p.weapon = 'fists'; G.feed.push('Out of ammo — fists it is.'); return; }
    p.ammo -= 1;
    p.attackCd = WEAPONS.pistol.rate;
    const a = angleTo(p.x, p.y, worldX, worldY);
    p.angle = a;
    G.particles.muzzle(p.x, p.y, a);
    G.audio.shoot();
    addHeat(G, CRIME_HEAT.shoot / 4);
    // Hit the nearest shootable thing near the aim line.
    let best = null;
    let bestD = WEAPONS.pistol.range;
    const targets = [];
    for (const e of G.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
    for (const c of G.cops) if (!c.car) targets.push({ x: c.x, y: c.y, kind: 'cop', ref: c });
    for (const pd of G.peds) targets.push({ x: pd.x, y: pd.y, kind: 'ped', ref: pd });
    for (const t of targets) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d > WEAPONS.pistol.range) continue;
      const ang = angleTo(p.x, p.y, t.x, t.y);
      let diff = Math.abs(((ang - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < 0.12 + 30 / Math.max(d, 40)) {
        if (d < bestD) { bestD = d; best = t; }
      }
    }
    if (best) {
      G.particles.burst(best.x, best.y, 6, '#ff5a4d', 160, 0.3, 2);
      damageTarget(G, best, WEAPONS.pistol.damage);
    }
    // Tracer dots along the shot.
    for (let d = 20; d < bestD; d += 26) {
      G.particles.spawn(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0, 0, 0.08, 2, '#ffe9a8');
    }
  }
}

export function playerPunch(G) {
  const p = G.player;
  if (p.attackCd > 0 || p.dead) return;
  p.attackCd = WEAPONS.fists.rate;
  p.angle = p.angle; // punch in facing direction
  G.audio.punch();
  let best = null;
  let bestD = WEAPONS.fists.range;
  const targets = [];
  for (const e of G.enemies) if (!e.dead) targets.push({ x: e.x, y: e.y, kind: 'enemy', ref: e });
  for (const c of G.cops) if (!c.car) targets.push({ x: c.x, y: c.y, kind: 'cop', ref: c });
  for (const pd of G.peds) targets.push({ x: pd.x, y: pd.y, kind: 'ped', ref: pd });
  for (const t of targets) {
    const d = dist(p.x, p.y, t.x, t.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    G.particles.burst(best.x, best.y, 5, '#ffd94d', 120, 0.25, 2);
    damageTarget(G, best, WEAPONS.fists.damage);
  }
}

function damageTarget(G, target, dmg) {
  if (target.kind === 'enemy') {
    const e = target.ref;
    e.hp -= dmg;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      G.kills += 1;
      if (e.mission) G.missionKills += 1;
      G.particles.burst(e.x, e.y, 12, '#c23b4e', 200, 0.5, 3);
      addHeat(G, CRIME_HEAT.kill / 2);
      if (G.rng.chance(0.6)) spawnPickup(G, 'cash', e.x, e.y, G.rng.int(40, 120));
      else if (G.rng.chance(0.5)) spawnPickup(G, 'ammo', e.x, e.y, 24);
    }
  } else if (target.kind === 'cop') {
    const c = target.ref;
    c.hp -= dmg;
    addHeat(G, CRIME_HEAT.hitCop, 'You shot a PSPD officer.');
    if (c.hp <= 0) {
      c.down = true;
      G.particles.burst(c.x, c.y, 10, '#2e4a7a', 180, 0.5, 3);
    }
  } else if (target.kind === 'ped') {
    const pd = target.ref;
    pd.state = 'flee';
    pd.fleeX = G.player.x; pd.fleeY = G.player.y; pd.fleeT = 4;
    addHeat(G, CRIME_HEAT.hitPed, 'A pedestrian was hit.');
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.dead) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.hurtT = 0.4;
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    G.mode = 'wasted';
    G.audio.fail();
  }
}

// --- traffic AI -----------------------------------------------------------

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.driver !== 'traffic' && car.driver !== 'courier') continue;
    car.turnCd -= dt;
    // Slow for a car ahead in the same lane.
    let ahead = Infinity;
    for (const other of G.cars) {
      if (other === car || other.driver === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = car.axis === 'v' ? dy * car.dir : dx * car.dir;
      const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (forward > 0 && forward < 90 && side < 30 && forward < ahead) ahead = forward;
    }
    const want = ahead < 70 ? Math.max(0, (ahead - 40)) : car.targetSpeed;
    car.speed += clamp(want - car.speed, -300 * dt, 200 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const moved = G.city.moveCircle(car.x, car.y, 17, nx - car.x, ny - car.y);
    if (moved.x !== nx || moved.y !== ny) {
      // Blocked: turn around.
      car.dir *= -1;
      car.angle += Math.PI;
      car.speed *= 0.4;
    }
    car.x = moved.x;
    car.y = moved.y;
    // At an intersection, sometimes turn onto the cross road.
    if (car.turnCd <= 0) {
      const cross = car.axis === 'v' ? H_ROADS : V_ROADS;
      for (const c of cross) {
        const along = car.axis === 'v' ? car.y : car.x;
        if (Math.abs(along - c) < 6 && G.rng.chance(0.25)) {
          car.axis = car.axis === 'v' ? 'h' : 'v';
          car.road = c;
          car.dir = G.rng.chance(0.5) ? 1 : -1;
          car.angle = car.axis === 'v' ? car.dir * Math.PI / 2 : (car.dir > 0 ? 0 : Math.PI);
          if (car.axis === 'v') car.y = c; else car.x = c;
          car.turnCd = 4;
          break;
        }
      }
    }
    // Player car collisions with traffic.
    if (p.car && p.car !== car) {
      const d = dist(p.car.x, p.car.y, car.x, car.y);
      if (d < 44) {
        const push = (44 - d) / 2;
        const a = angleTo(car.x, car.y, p.car.x, p.car.y);
        p.car.x += Math.cos(a) * push;
        p.car.y += Math.sin(a) * push;
        car.x -= Math.cos(a) * push;
        car.y -= Math.sin(a) * push;
        const impact = Math.abs(p.car.speed - car.speed);
        if (impact > 90 && (p.car.hitCd || 0) <= 0) {
          // One damage event per collision, not one per frame of contact.
          p.car.hitCd = 0.8;
          p.car.hp -= impact * 0.03;
          car.hp -= impact * 0.03;
          G.particles.crash((p.car.x + car.x) / 2, (p.car.y + car.y) / 2);
          G.audio.crash(clamp(impact / 300, 0.2, 1));
          G.shake = 6;
          p.car.speed *= 0.6;
          car.speed *= 0.6;
          if (car.driver === 'traffic') {
            car.driver = 'parked';
            const driver = makePed(G, car.x, car.y);
            driver.state = 'flee'; driver.fleeX = p.x; driver.fleeY = p.y; driver.fleeT = 3;
            G.peds.push(driver);
            addHeat(G, 6, 'Traffic collision — witnesses called it in.');
          }
        }
        // Gentle per-frame rub while the cars touch; the push above separates them.
        p.car.speed *= 0.985;
        car.speed *= 0.985;
      }
    }
    // Traffic hitting a pedestrian on foot scares everyone nearby.
    if (Math.abs(car.speed) > 40) {
      for (const pd of G.peds) {
        if (pd.state === 'walk' && dist(car.x, car.y, pd.x, pd.y) < 30) {
          pd.state = 'flee';
          pd.fleeX = car.x; pd.fleeY = car.y; pd.fleeT = 2.5;
        }
      }
    }
    // Despawn far traffic and respawn near the player to keep the city alive.
    if (dist(car.x, car.y, p.x, p.y) > 1100) {
      const spot = G.city.nearestRoadPoint(p.x + G.rng.range(-500, 500), p.y + G.rng.range(-500, 500));
      car.x = spot.x; car.y = spot.y;
      car.axis = spot.vertical ? 'v' : 'h';
      car.road = spot.vertical ? spot.x : spot.y;
      car.dir = G.rng.chance(0.5) ? 1 : -1;
      car.angle = car.axis === 'v' ? car.dir * Math.PI / 2 : (car.dir > 0 ? 0 : Math.PI);
      car.speed = car.targetSpeed;
    }
  }
}

// --- pedestrians ----------------------------------------------------------

export function updatePeds(G, dt) {
  const p = G.player;
  for (const pd of G.peds) {
    if (pd.state === 'flee') {
      pd.fleeT -= dt;
      const a = angleTo(pd.fleeX, pd.fleeY, pd.x, pd.y);
      const moved = G.city.moveCircle(pd.x, pd.y, 9, Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt);
      pd.x = moved.x; pd.y = moved.y; pd.angle = a;
      if (pd.fleeT <= 0) pd.state = 'walk';
      continue;
    }
    // Walk the sidewalk along the current road.
    const step = pd.speed * pd.dir * dt;
    if (pd.vertical) pd.y += step; else pd.x += step;
    if (pd.x < 60 || pd.x > WORLD.w - 60 || pd.y < 60 || pd.y > WORLD.h - 60) pd.dir *= -1;
    // Turn at an intersection sometimes.
    const cross = pd.vertical ? H_ROADS : V_ROADS;
    const along = pd.vertical ? pd.y : pd.x;
    for (const c of cross) {
      if (Math.abs(along - c) < 4 && G.rng.chance(0.01)) {
        pd.vertical = !pd.vertical;
        pd.road = c;
        pd.dir = G.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    pd.angle = pd.vertical ? (pd.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (pd.dir > 0 ? 0 : Math.PI);
    // Flee gunfire or a speeding car nearby.
    if (G.gunshotT > 0 && dist(pd.x, pd.y, p.x, p.y) < 320) {
      pd.state = 'flee'; pd.fleeX = p.x; pd.fleeY = p.y; pd.fleeT = 2.5;
    }
  }
}

// --- police ---------------------------------------------------------------

export function updateCops(G, dt) {
  const p = G.player;
  const level = wantedLevel(p.heat);
  // Heat decays only while no cop is close enough to see the player.
  const near = nearestCopDist(G);
  if (level > 0 && near > 380) p.heat = Math.max(0, p.heat - 7 * dt);
  if (level === 0) p.heat = Math.max(0, p.heat - 12 * dt);

  // Spawn police to match the wanted level.
  const wantFoot = level >= 1 ? Math.min(level, 3) : 0;
  const wantCars = level >= 2 ? Math.min(level - 1, 4) : 0;
  const foot = G.cops.filter((c) => !c.car && !c.down).length;
  const cars = G.cops.filter((c) => c.car).length;
  if (foot < wantFoot) {
    const spot = G.city.nearestRoadPoint(p.x + (G.rng.chance(0.5) ? 420 : -420), p.y + (G.rng.chance(0.5) ? 320 : -320));
    G.cops.push({ kind: 'foot', x: spot.x, y: spot.y, angle: 0, hp: 50, bustT: 0, down: false, speed: 150 });
  }
  if (cars < wantCars) {
    const spot = G.city.nearestRoadPoint(p.x + (G.rng.chance(0.5) ? 600 : -600), p.y + (G.rng.chance(0.5) ? 500 : -500));
    const car = makeCar(G, 'cruiser', spot.x, spot.y, angleTo(spot.x, spot.y, p.x, p.y), 'cop');
    car.targetSpeed = 380;
    G.cars.push(car);
    G.cops.push({ kind: 'cruiser', car, x: spot.x, y: spot.y, angle: 0, hp: 140, bustT: 0, down: false });
  }
  // Roadblocks at 3+ stars: two cruisers park across the road ahead.
  if (level >= 3 && G.roadblockT <= 0) {
    G.roadblockT = 14;
    const aheadX = p.x + Math.cos(p.angle) * 420;
    const aheadY = p.y + Math.sin(p.angle) * 420;
    const spot = G.city.nearestRoadPoint(aheadX, aheadY);
    for (let i = 0; i < 2; i += 1) {
      const bx = spot.x + (spot.vertical ? 0 : i * 50 - 25);
      const by = spot.y + (spot.vertical ? i * 50 - 25 : 0);
      if (G.city.solidAt(bx, by, 20)) continue;
      const car = makeCar(G, 'cruiser', bx, by, spot.vertical ? 0 : Math.PI / 2, 'cop');
      car.block = true;
      car.targetSpeed = 0;
      G.cars.push(car);
      G.cops.push({ kind: 'cruiser', car, x: bx, y: by, angle: 0, hp: 140, bustT: 0, down: false });
    }
    G.feed.push('PSPD roadblock ahead!');
  }
  G.roadblockT -= dt;

  for (let i = G.cops.length - 1; i >= 0; i -= 1) {
    const c = G.cops[i];
    if (c.down) continue;
    if (c.car) {
      const car = c.car;
      if (car.hp <= 0) { c.down = true; continue; }
      const d = dist(car.x, car.y, p.x, p.y);
      if (car.block && d > 260) {
        // Parked roadblock: wait.
        car.speed = 0;
      } else {
        car.block = false;
        // Chase the player: steer toward them, ram on contact.
        const want = angleTo(car.x, car.y, p.x, p.y);
        let diff = ((want - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
        car.speed += clamp(400 - car.speed, -500 * dt, 420 * dt);
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        const moved = G.city.moveCircle(car.x, car.y, 17, nx - car.x, ny - car.y);
        if (moved.x !== nx || moved.y !== ny) car.speed *= 0.4;
        car.x = moved.x; car.y = moved.y;
        if (Math.random() < dt * 3) G.particles.exhaust(car.x, car.y, car.angle);
        // Ram the player's car or the player on foot.
        const target = p.car || p;
        const td = dist(car.x, car.y, target.x, target.y);
        if (td < 46) {
          if (p.car) {
            p.car.hp -= 8 * dt;
            p.car.speed *= 0.94;
            if (Math.random() < dt * 4) { G.particles.crash(car.x, car.y); G.audio.crash(0.5); }
          } else {
            damagePlayer(G, 8 * dt);
          }
        }
      }
      c.x = car.x; c.y = car.y;
      if (d > 1200 && level === 0) {
        G.cars.splice(G.cars.indexOf(car), 1);
        G.cops.splice(i, 1);
      }
    } else {
      // Foot cop chases the player on foot; catches them to bust.
      const d = dist(c.x, c.y, p.x, p.y);
      if (d > 900 && level === 0) { G.cops.splice(i, 1); continue; }
      const a = angleTo(c.x, c.y, p.x, p.y);
      const moved = G.city.moveCircle(c.x, c.y, 11, Math.cos(a) * c.speed * dt, Math.sin(a) * c.speed * dt);
      c.x = moved.x; c.y = moved.y; c.angle = a;
      if (d < 34 && !p.car) {
        c.bustT += dt;
        if (c.bustT > 1.2) {
          G.mode = 'busted';
          G.audio.fail();
          return;
        }
      } else {
        c.bustT = Math.max(0, c.bustT - dt * 2);
      }
      // A foot cop near the player's car gets run over (and remembers it).
      if (p.car && d < 40) {
        c.down = true;
        G.particles.burst(c.x, c.y, 8, '#2e4a7a', 160, 0.4, 3);
        addHeat(G, CRIME_HEAT.hitCop, 'You ran over a PSPD officer.');
        p.car.hp -= 8;
      }
    }
  }
  G.audio.setSiren(level > 0 && near < 600, G.timeSec);
}

// --- enemies --------------------------------------------------------------

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 430 && !p.dead) {
      const a = angleTo(e.x, e.y, p.x, p.y);
      if (d < 50) {
        // Too close: back off and keep shooting instead of swarming.
        const moved = G.city.moveCircle(e.x, e.y, 11, -Math.cos(a) * e.speed * 0.5 * dt, -Math.sin(a) * e.speed * 0.5 * dt);
        e.x = moved.x; e.y = moved.y;
      } else {
        const moved = G.city.moveCircle(e.x, e.y, 11, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt);
        e.x = moved.x; e.y = moved.y;
      }
      e.angle = a;
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 360) {
        e.shootCd = G.rng.range(1.1, 1.9);
        G.particles.muzzle(e.x, e.y, a);
        G.audio.shoot();
        G.gunshotT = 0.4;
        if (G.rng.chance(0.45)) damagePlayer(G, 9);
      }
      if (d < 26) damagePlayer(G, 6 * dt);
    }
  }
  // Dead enemies are counted at the moment they fall; drop them from the list.
  G.enemies = G.enemies.filter((e) => !e.dead);
}

// --- pickups --------------------------------------------------------------

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.bob += dt * 3;
    if (dist(pk.x, pk.y, p.x, p.y) < 30) {
      if (pk.kind === 'health') p.health = Math.min(PLAYER.maxHealth, p.health + 30);
      else if (pk.kind === 'armor') p.armor = Math.min(PLAYER.maxArmor, p.armor + 40);
      else if (pk.kind === 'ammo') p.ammo += pk.amount || 24;
      else if (pk.kind === 'cash') { p.money += pk.amount || 50; G.earned += pk.amount || 50; }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}
