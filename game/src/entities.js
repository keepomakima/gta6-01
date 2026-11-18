// NEON TIDE v5 — entities: the player, parked/driven cars, pedestrians
// and armed enemies. Movement and collisions live here; missions, police
// and combat decide what the entities do.
import { CAR_TYPES, WALK_SPEED, RUN_SPEED, PLAYER_HP, NOS_MULT, NOS_DRAIN } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { resolveSolid, hitsSolid } from './world.js';
import { spawn } from './particles.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER_HP, armor: 0,
    inCar: false, car: null, weapon: 'pistol',
    ammo: { pistol: 120, smg: 0, shotgun: 0 },
    speed: 0, hurtT: 0, fireT: 0, dead: false,
  };
}

export function makeCar(type, x, y, angle = 0, parked = true) {
  const t = CAR_TYPES[type];
  return {
    type, x, y, angle, speed: 0,
    cond: 100, maxHp: t.hp, parked, driver: !parked,
    color: t.color, smokeT: 0, spinT: 0, flatT: 0,
  };
}

export function carStats(car, upgrades) {
  const t = CAR_TYPES[car.type];
  const eng = upgrades.engine || 0;
  const grip = upgrades.grip || 0;
  const arm = upgrades.armor || 0;
  return {
    top: t.top * (1 + eng * 0.09),
    accel: t.accel * (1 + eng * 0.08),
    turn: t.turn * (1 + grip * 0.08),
    maxHp: t.hp + arm * 25,
  };
}

// Drive the car the player is in. Returns true while NOS is boosting.
export function driveCar(g, dt) {
  const p = g.player;
  const car = p.car;
  if (!car) return false;
  const st = carStats(car, g.upgrades);
  const inp = g.input;
  const nosReady = (g.upgrades.nos || 0) > 0 && g.nos > 0 && inp.nos && inp.up;
  const top = st.top * (nosReady ? NOS_MULT : 1) * (car.flatT > 0 ? 0.45 : 1);
  if (car.spinT > 0) {
    car.spinT -= dt;
    car.angle += dt * 1.4;
    car.speed *= (1 - dt * 0.8);
  } else {
    if (inp.up) car.speed += st.accel * dt * (nosReady ? 1.25 : 1);
    else if (inp.dn) car.speed -= st.accel * 0.9 * dt;
    else car.speed *= Math.max(0, 1 - dt * 1.4);
    if (inp.handbrake) car.speed *= Math.max(0, 1 - dt * 4);
    car.speed = clamp(car.speed, -top * 0.45, top);
    const dir = car.speed >= 0 ? 1 : -1;
    const steer = (inp.lf ? -1 : 0) + (inp.rt ? 1 : 0);
    car.angle += steer * st.turn * dt * Math.min(1, Math.abs(car.speed) / 140) * dir;
  }
  const px = car.x, py = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (hitsSolid(car.x, car.y, 20)) {
    // Bounce off buildings instead of sticking inside them.
    car.x = px; car.y = py;
    if (Math.abs(car.speed) > 180) {
      car.cond -= 6;
      g.shake = Math.min(9, g.shake + 4);
      g.audio.crash();
    }
    car.speed *= -0.25;
  }
  if (car.flatT > 0) car.flatT -= dt;
  if (car.cond < 35 && Math.random() < dt * 6) {
    spawn(g.particles, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18,
      { vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, life: 0.7, size: 5, color: '#888' });
  }
  // Skid marks + smoke when sliding or damaged.
  if (inp.handbrake && Math.abs(car.speed) > 200 && Math.random() < dt * 20) {
    g.addSkid(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, car.angle);
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (nosReady) g.nos = Math.max(0, g.nos - NOS_DRAIN * dt);
  return nosReady;
}

export function walkPlayer(g, dt) {
  const p = g.player;
  const inp = g.input;
  let mx = (inp.rt ? 1 : 0) - (inp.lf ? 1 : 0);
  let my = (inp.dn ? 1 : 0) - (inp.up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const sp = inp.run ? RUN_SPEED : WALK_SPEED;
    p.x += (mx / len) * sp * dt;
    p.y += (my / len) * sp * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = sp;
  } else {
    p.speed = 0;
  }
  resolveSolid(p, 14);
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.fireT > 0) p.fireT -= dt;
}

export function makePed(x, y, rng) {
  return {
    x, y, angle: rng() * Math.PI * 2, speed: 40 + rng() * 40,
    tx: x, ty: y, fleeT: 0, color: ['#d8a05a', '#7ab8d8', '#c87a9a', '#8ad87a'][Math.floor(rng() * 4)],
  };
}

export function updatePeds(g, dt) {
  for (const ped of g.peds) {
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const a = Math.atan2(ped.y - g.player.y, ped.x - g.player.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
    } else {
      if (dist(ped.x, ped.y, ped.tx, ped.ty) < 24) {
        ped.tx = Math.max(40, Math.min(2360, ped.x + (Math.random() - 0.5) * 500));
        ped.ty = Math.max(40, Math.min(1560, ped.y + (Math.random() - 0.5) * 500));
      }
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
    }
    resolveSolid(ped, 10);
  }
}

export function makeEnemy(x, y, opts = {}) {
  return {
    x, y, hp: opts.hp ?? 100, alive: true,
    guard: !!opts.guard, boss: !!opts.boss, sentry: !!opts.sentry,
    angle: opts.angle ?? 0, fireT: 1 + Math.random(),
    speed: opts.boss ? 95 : 70, homeX: x, homeY: y,
  };
}

// Enemies walk toward the player and shoot when in range. Damage is low
// on purpose (see config ENEMY_DMG): a fair fight, not a firing squad.
export function updateEnemies(g, dt) {
  const p = g.player;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    if (e.sentry) continue; // sentries hold their post; missions.js watches them
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 460 && g.mode === 'play') {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = a;
      if (d > 130) {
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
        resolveSolid(e, 12);
      }
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 430) {
        e.fireT = 1.6;
        g.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, from: 'enemy', life: 1.4 });
        g.audio.blip(140, 0.08, 'sawtooth', 0.04);
      }
    } else if (d >= 460) {
      // Drift back toward the post they guard.
      const a = Math.atan2(e.homeY - e.y, e.homeX - e.x);
      if (dist(e.x, e.y, e.homeX, e.homeY) > 30) {
        e.x += Math.cos(a) * e.speed * 0.5 * dt;
        e.y += Math.sin(a) * e.speed * 0.5 * dt;
      }
    }
  }
}

// Hurt the player (armor absorbs first). Returns true if the player died.
export function hurtPlayer(g, dmg) {
  const p = g.player;
  if (p.hurtT > 0 || g.mode !== 'play') return false;
  p.hurtT = 0.45;
  let rest = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.hp -= rest;
  g.shake = Math.min(10, g.shake + 3);
  if (p.hp <= 0) {
    p.hp = 0;
    g.mode = 'wasted';
    g.audio.siren(false);
    return true;
  }
  return false;
}
