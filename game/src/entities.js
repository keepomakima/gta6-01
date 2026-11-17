// NEON TIDE — entities.js
// The player, pedestrians, gang enemies, pickups and every car: creation,
// on-foot movement, driving physics and the steal-a-car interaction.

import {
  CAR_TYPES, WALK_SPEED, RUN_SPEED, PUNCH_DAMAGE, PUNCH_RANGE, PUNCH_RATE,
  PISTOL_AMMO_START, PED_SHIRTS, GANG_COLOR, WORLD_W, WORLD_H,
} from './config.js';
import { clamp, dist, randInt, randPick, randRange, angleDiff } from './random.js';
import { resolveBuildingCollision, hitBuilding, onRoad } from './world.js';
import { moveVector } from './input.js';
import { burst, shake, exhaust, smoke, addSkid, muzzle, ring } from './particles.js';

let nextCarId = 1;
let nextPedId = 1;

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: 100, maxHp: 100, armor: 0,
    money: 250, weapon: 'fists', ammo: PISTOL_AMMO_START,
    inCar: null, speed: 0,
    punchCooldown: 0, shootCooldown: 0,
    walkAnim: 0, moving: false,
  };
}

export function createCar(G, type, x, y, angle, opts = {}) {
  const def = CAR_TYPES[type];
  const car = {
    id: nextCarId,
    type, name: def.name,
    x, y, angle,
    speed: 0,
    hp: def.hp, maxHp: def.hp,
    color: opts.color || def.color,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | null
    parked: opts.parked ?? false,
    top: def.top, accel: def.accel, brake: def.brake, grip: def.grip,
    len: def.len, wid: def.wid,
    smokeTimer: 0, exhaustTimer: 0,
    ai: opts.ai || null, // traffic / police brain
    targetAngle: angle,
  };
  nextCarId += 1;
  return car;
}

// Shared arcade car physics. steer -1..1, throttle 0..1, brake 0..1.
export function stepCar(G, car, steer, throttle, brake, handbrake, dt) {
  const def = CAR_TYPES[car.type];
  if (throttle > 0) car.speed += def.accel * throttle * dt;
  if (brake > 0) {
    if (car.speed > 5) car.speed -= def.brake * brake * dt;
    else car.speed -= def.accel * 0.5 * brake * dt; // reverse
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  car.speed = clamp(car.speed, -def.top * 0.35, def.top);
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  // Steering scales with speed; handbrake lets the tail slide.
  const steerFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
  const grip = handbrake ? def.grip * 1.9 : def.grip;
  car.angle += steer * grip * steerFactor * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  car.x = nx;
  car.y = ny;
  // Building collision, checked at the front and rear axle so the car's long
  // body does not clip walls when it turns: a circle at each axle with a
  // radius just over half the car's width.
  const halfLen = car.len / 2 - 6;
  const r = car.wid / 2 + 2;
  const fx = car.x + Math.cos(car.angle) * halfLen;
  const fy = car.y + Math.sin(car.angle) * halfLen;
  const rx = car.x - Math.cos(car.angle) * halfLen;
  const ry = car.y - Math.sin(car.angle) * halfLen;
  const hit = hitBuilding(G.world, fx, fy, r) || hitBuilding(G.world, rx, ry, r)
    || car.x < r || car.y < r || car.x > WORLD_W - r || car.y > WORLD_H - r;
  if (hit) {
    const impact = Math.abs(car.speed);
    car.x = before.x;
    car.y = before.y;
    car.speed *= -0.25;
    if (impact > 140) {
      car.hp -= Math.round((impact - 140) / 12);
      burst(G, car.x, car.y, { count: 8, speedMin: 60, speedMax: 200, life: 0.4, size: 3, color: '#ffb347' });
      if (car.driver === 'player') {
        G.audio.crash();
        shake(G, 5);
        addWanted(G, 4, 'crash');
      }
    }
  }
  return car;
}

// Player on foot + driving, enter/exit car, punch. Called every frame in play.
export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);

  if (p.inCar) {
    const car = G.cars.find((c) => c.id === p.inCar);
    if (!car || car.hp <= 0) {
      p.inCar = null;
    } else {
      const mv = moveVector(input);
      const throttle = mv.y < 0 ? 1 : 0;
      const brake = mv.y > 0 ? 1 : 0;
      const steer = mv.x;
      const handbrake = input.down('Space');
      stepCar(G, car, steer, throttle, brake, handbrake, dt);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      // Aim follows the mouse while driving too (for drive-by shooting).
      p.aimAngle = Math.atan2(input.mouseY + G.camera.y - car.y, input.mouseX + G.camera.x - car.x);
      // Exhaust + smoke + skid marks.
      car.exhaustTimer -= dt;
      if (car.exhaustTimer <= 0 && Math.abs(car.speed) > 30) {
        car.exhaustTimer = 0.09;
        exhaust(G, car.x, car.y, car.angle);
      }
      if (car.hp < car.maxHp * 0.4) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.12;
          smoke(G, car.x, car.y - 10);
        }
      }
      if (handbrake && Math.abs(car.speed) > 120) {
        addSkid(G, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
      }
      // Exit the car.
      if (input.hit('KeyE')) {
        exitCar(G);
      }
      // Car explodes when destroyed.
      if (car.hp <= 0) {
        explodeCar(G, car);
        p.inCar = null;
      }
      return;
    }
  }

  // On foot.
  const mv = moveVector(input);
  const running = input.any(['ShiftLeft', 'ShiftRight']);
  const speed = running ? RUN_SPEED : WALK_SPEED;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.walkAnim += dt * (running ? 13 : 9);
    const nx = p.x + mv.x * speed * dt;
    const ny = p.y + mv.y * speed * dt;
    const before = { x: p.x, y: p.y };
    p.x = nx;
    p.y = ny;
    if (resolveBuildingCollision(G.world, p, 13)) {
      p.x = before.x;
      p.y = before.y;
      resolveBuildingCollision(G.world, p, 13);
    }
  }
  // Face the mouse (aim direction).
  p.angle = Math.atan2(input.mouseY + G.camera.y - p.y, input.mouseX + G.camera.x - p.x);
  p.aimAngle = p.angle;

  // Enter the nearest car.
  if (input.hit('KeyE')) {
    const car = nearestCar(G, p.x, p.y, 56);
    if (car) stealCar(G, car);
  }
  // Punch with F or left click while unarmed.
  if ((input.hit('KeyF') || (input.mousePressed && p.weapon === 'fists')) && p.punchCooldown <= 0) {
    punch(G);
  }
  // Shoot with left click while armed.
  if (input.mouseDown && p.weapon === 'pistol' && p.shootCooldown <= 0) {
    shootPistol(G);
  }
  // Weapon switch: 1 fists, 2 pistol.
  if (input.hit('Digit1')) p.weapon = 'fists';
  if (input.hit('Digit2') && p.ammo > 0) p.weapon = 'pistol';
}

export function exitCar(G) {
  const p = G.player;
  const car = G.cars.find((c) => c.id === p.inCar);
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  // Step out to the side of the car.
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 30;
  p.y = car.y + Math.sin(car.angle + side) * 30;
  resolveBuildingCollision(G.world, p, 13);
  p.inCar = null;
  p.speed = 0;
}

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of G.cars) {
    if (c.hp <= 0) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Steal a car: empty cars are free, occupied ones make the driver flee and
// count as a crime when a cop is watching.
export function stealCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // The driver bails and runs.
    const driver = G.peds.find((pd) => pd.carId === car.id);
    if (driver) {
      driver.carId = null;
      driver.fleeing = true;
      driver.fleeX = car.x + (car.x > p.x ? 200 : -200);
      driver.fleeY = car.y + (car.y > p.y ? 200 : -200);
      driver.state = 'flee';
    }
    car.driver = 'player';
    addWanted(G, 25, 'theft');
  } else if (car.driver === 'police') {
    addWanted(G, 60, 'theft');
    car.driver = 'player';
  } else {
    car.driver = 'player';
  }
  car.parked = false;
  p.inCar = car.id;
  p.x = car.x;
  p.y = car.y;
  G.stats.carsStolen += 1;
  G.audio.pickup();
  addMessage(G, `Stole the ${car.name}`, '#ffd75a');
}

export function explodeCar(G, car) {
  burst(G, car.x, car.y, { count: 30, speedMin: 80, speedMax: 320, life: 0.9, size: 5, color: '#ff7a2a' });
  burst(G, car.x, car.y, { count: 16, speedMin: 40, speedMax: 160, life: 1.2, size: 6, color: '#555' });
  ring(G, car.x, car.y, '#ffb347');
  shake(G, 12);
  G.audio.crash();
  addWanted(G, 10, 'explosion');
  car.hp = 0;
}

// A punch: hits the nearest enemy / ped / cop in range in front of the player.
export function punch(G) {
  const p = G.player;
  p.punchCooldown = PUNCH_RATE;
  G.audio.punch();
  const hx = p.x + Math.cos(p.angle) * PUNCH_RANGE;
  const hy = p.y + Math.sin(p.angle) * PUNCH_RANGE;
  burst(G, hx, hy, { count: 4, speedMin: 40, speedMax: 120, life: 0.2, size: 3, color: '#fff' });
  const targets = [...G.enemies, ...G.peds, ...G.cops];
  for (const t of targets) {
    if (t.hp <= 0) continue;
    if (dist(p.x, p.y, t.x, t.y) < PUNCH_RANGE + 14) {
      damageTarget(G, t, PUNCH_DAMAGE, 'punch');
      addWanted(G, 12, 'assault');
      return;
    }
  }
}

export function shootPistol(G) {
  const p = G.player;
  if (p.ammo <= 0) {
    p.weapon = 'fists';
    addMessage(G, 'Out of ammo — press 1 for fists', '#ff8a7a');
    return;
  }
  p.ammo -= 1;
  p.shootCooldown = 0.22;
  const a = p.aimAngle ?? p.angle;
  const gx = p.x + Math.cos(a) * 26;
  const gy = p.y + Math.sin(a) * 26;
  G.bullets.push({
    x: gx, y: gy,
    vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
    damage: 34, fromPlayer: true, life: 1.1,
  });
  muzzle(G, gx, gy, a);
  G.audio.gunshot();
  shake(G, 1.5);
  addWanted(G, 6, 'gunfire');
}

// Damage any damageable target; handles death drops and kill credit.
export function damageTarget(G, t, dmg, cause) {
  if (t.hp <= 0) return;
  t.hp -= dmg;
  t.flashT = 0.12;
  if (t.hp > 0) {
    if (t.kind === 'ped') {
      t.state = 'flee';
      t.fleeX = t.x + (t.x > G.player.x ? 260 : -260);
      t.fleeY = t.y + (t.y > G.player.y ? 260 : -260);
    }
    return;
  }
  // Died.
  t.hp = 0;
  burst(G, t.x, t.y, { count: 12, speedMin: 40, speedMax: 180, life: 0.5, size: 3, color: '#ff5a5a' });
  if (t.kind === 'enemy') {
    G.stats.kills += 1;
    addWanted(G, 30, 'kill');
    const cash = randInt(G.rng, 40, 120);
    spawnPickup(G, t.x, t.y, 'cash', cash);
    if (G.rng() < 0.5) spawnPickup(G, t.x + 14, t.y, 'ammo', 12);
    if (G.mission) G.mission.onKill?.(G, t);
  } else if (t.kind === 'cop') {
    G.stats.kills += 1;
    addWanted(G, 45, 'kill');
  } else if (t.kind === 'ped') {
    addWanted(G, 35, 'kill');
  }
}

// --- Pedestrians ------------------------------------------------------------

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i += 1) {
    const p = {
      id: nextPedId,
      kind: 'ped',
      x: randRange(G.rng, 120, 2280),
      y: randRange(G.rng, 120, 1480),
      angle: randRange(G.rng, 0, Math.PI * 2),
      hp: 50, speed: randRange(G.rng, 40, 70),
      shirt: randPick(G.rng, PED_SHIRTS),
      state: 'walk',
      walkT: randRange(G.rng, 2, 6),
      carId: null,
      flashT: 0,
      walkAnim: randRange(G.rng, 0, 6),
    };
    // Keep peds off buildings.
    if (resolveBuildingCollision(G.world, p, 12)) {
      p.x = randRange(G.rng, 120, 2280);
      p.y = randRange(G.rng, 120, 1480);
    }
    nextPedId += 1;
    G.peds.push(p);
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const pd = G.peds[i];
    if (pd.hp <= 0) {
      pd.deadT = (pd.deadT || 0) + dt;
      if (pd.deadT > 6) G.peds.splice(i, 1);
      continue;
    }
    pd.flashT = Math.max(0, (pd.flashT || 0) - dt);
    // Flee from nearby gunfire, explosions and the player's speeding car.
    const threat = dist(pd.x, pd.y, p.x, p.y) < 90 && (p.inCar ? Math.abs(p.speed) > 200 : G.recentShot);
    if (threat && pd.state !== 'flee') {
      pd.state = 'flee';
      pd.fleeX = pd.x + (pd.x > p.x ? 300 : -300);
      pd.fleeY = pd.y + (pd.y > p.y ? 300 : -300);
    }
    if (pd.state === 'flee') {
      const a = Math.atan2(pd.fleeY - pd.y, pd.fleeX - pd.x);
      pd.angle = a;
      pd.x += Math.cos(a) * 150 * dt;
      pd.y += Math.sin(a) * 150 * dt;
      pd.walkAnim += dt * 12;
      if (dist(pd.x, pd.y, pd.fleeX, pd.fleeY) < 30 || pd.fleeT > 4) {
        pd.state = 'walk';
        pd.fleeT = 0;
      }
      pd.fleeT = (pd.fleeT || 0) + dt;
    } else {
      pd.walkT -= dt;
      if (pd.walkT <= 0) {
        pd.walkT = randRange(G.rng, 3, 8);
        pd.angle = randRange(G.rng, 0, Math.PI * 2);
        // Prefer walking along sidewalks: snap direction to the road grid.
        if (onRoad(pd.x, pd.y)) pd.angle = Math.round(pd.angle / (Math.PI / 2)) * (Math.PI / 2);
      }
      pd.x += Math.cos(pd.angle) * pd.speed * dt;
      pd.y += Math.sin(pd.angle) * pd.speed * dt;
      pd.walkAnim += dt * 6;
    }
    resolveBuildingCollision(G.world, pd, 12);
    // Keep peds in the world and off the deep beach water edge.
    pd.x = clamp(pd.x, 30, 2370);
    pd.y = clamp(pd.y, 30, 1570);
  }
  // Top the crowd back up.
  if (G.peds.length < 22 && G.frame % 120 === 0) spawnPeds(G, 2);
}

// --- Gang enemies -----------------------------------------------------------

export function spawnEnemy(G, x, y, opts = {}) {
  const e = {
    kind: 'enemy',
    x, y,
    angle: randRange(G.rng, 0, Math.PI * 2),
    hp: opts.hp || 60,
    speed: randRange(G.rng, 70, 95),
    shirt: GANG_COLOR,
    state: 'idle',
    shootCooldown: randRange(G.rng, 0.5, 1.5),
    target: null,
    flashT: 0,
    walkAnim: 0,
    guardX: x, guardY: y,
    deadT: 0,
  };
  G.enemies.push(e);
  return e;
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i -= 1) {
    const e = G.enemies[i];
    if (e.hp <= 0) {
      e.deadT += dt;
      if (e.deadT > 8) G.enemies.splice(i, 1);
      continue;
    }
    e.flashT = Math.max(0, e.flashT - dt);
    e.shootCooldown -= dt;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 420) {
      // Engage: face the player, strafe closer, shoot.
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 180) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
        e.walkAnim += dt * 8;
      } else if (e.shootCooldown <= 0) {
        e.shootCooldown = randRange(G.rng, 0.9, 1.8);
        const spread = randRange(G.rng, -0.12, 0.12);
        const a = e.angle + spread;
        G.bullets.push({
          x: e.x + Math.cos(a) * 22, y: e.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          damage: 9, fromPlayer: false, life: 1.0,
        });
        G.audio.gunshot();
      }
    } else {
      // Guard post: drift back toward the guard point.
      const gd = dist(e.x, e.y, e.guardX, e.guardY);
      if (gd > 40) {
        const a = Math.atan2(e.guardY - e.y, e.guardX - e.x);
        e.angle = a;
        e.x += Math.cos(a) * e.speed * 0.5 * dt;
        e.y += Math.sin(a) * e.speed * 0.5 * dt;
        e.walkAnim += dt * 6;
      }
    }
    resolveBuildingCollision(G.world, e, 12);
  }
}

// --- Pickups ----------------------------------------------------------------

export function spawnPickup(G, x, y, kind, value) {
  G.pickups.push({
    kind, x, y,
    value: value ?? (kind === 'cash' ? randInt(G.rng, 20, 80) : kind === 'ammo' ? 12 : 25),
    bob: randRange(G.rng, 0, Math.PI * 2),
    life: 30,
  });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.pickups[i];
    pk.bob += dt * 3;
    pk.life -= dt;
    if (pk.life <= 0) {
      G.pickups.splice(i, 1);
      continue;
    }
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      if (pk.kind === 'cash') {
        p.money += pk.value;
        G.audio.cash();
        addMessage(G, `+$${pk.value}`, '#7dff8a');
      } else if (pk.kind === 'ammo') {
        p.ammo = Math.min(120, p.ammo + pk.value);
        if (p.weapon === 'fists') p.weapon = 'pistol';
        G.audio.pickup();
        addMessage(G, `+${pk.value} ammo`, '#ffd75a');
      } else if (pk.kind === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + pk.value);
        G.audio.pickup();
        addMessage(G, `+${pk.value} HP`, '#7dff8a');
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + pk.value);
        G.audio.pickup();
        addMessage(G, `+${pk.value} armor`, '#8ecbff');
      }
      G.pickups.splice(i, 1);
    }
  }
}

// --- Shared helpers (used by police.js and missions.js too) -----------------

export function addMessage(G, text, color) {
  G.messages.push({ text, color: color || '#fff', t: 3 });
  if (G.messages.length > 5) G.messages.shift();
}

// Wanted heat: add points; stars are derived from heat in police.js.
export function addWanted(G, points, reason) {
  if (G.mode !== 'play') return;
  G.heat = clamp((G.heat || 0) + points, 0, 500);
  G.lastCrimeT = G.time;
  void reason;
}
