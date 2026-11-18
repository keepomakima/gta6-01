// NEON TIDE v4 — entities: the player, cars and pedestrians as data.
// One job: spawn them and move the player on foot / in a car.
import { VEHICLES, PLAYER_SPEED, PLAYER_RUN_MULT, PLAYER_RADIUS } from './config.js';
import { rectBlocked, carBlocked, isOnRoad, ROADS_X, ROADS_Y } from './world.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    hp: 100, armor: 0, money: 250, debt: 50000,
    inCar: null, onFoot: true,
    weapon: 'pistol', ammo: { pistol: 48, smg: 0, shotgun: 0 },
    owned: { fists: true, pistol: true, smg: false, shotgun: false },
    kills: 0, carsStolen: 0, nearMisses: 0, drifts: 0,
    facingX: 0, facingY: -1, punchCd: 0, fireCd: 0, hurtT: 0,
  };
}

export function makeCar(type, x, y, angle, driver) {
  const v = VEHICLES[type];
  return {
    type, x, y, angle, speed: 0, hp: v.hp, maxHp: v.hp,
    color: v.color, w: v.w, h: v.h, top: v.top, accel: v.accel, turn: v.turn,
    driver: driver || null, parked: !driver, smokeT: 0, siren: type === 'cruiser',
    brakeLight: false, driftT: 0,
  };
}

export function spawnParkedCars(world, rng) {
  const cars = [];
  const types = ['sedan', 'taxi', 'sport', 'truck', 'sedan', 'taxi', 'sport'];
  // Park along road edges (outer lane), never on sidewalks or in buildings.
  for (let i = 0; i < 16; i += 1) {
    const vertical = rng.chance(0.5);
    let x; let y; let angle;
    if (vertical) {
      const rx = rng.pick(ROADS_X);
      x = rx + (rng.chance(0.5) ? 24 : -24);
      y = rng.range(120, 1700);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = rng.pick(ROADS_Y);
      x = rng.range(120, 2400);
      y = ry + (rng.chance(0.5) ? 24 : -24);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    const type = types[i % types.length];
    cars.push(makeCar(type, x, y, angle, null));
  }
  return cars;
}

export function spawnPedestrians(world, rng, count) {
  const peds = [];
  const skins = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
  const shirts = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#8338ec', '#ffbe0b'];
  for (let i = 0; i < count; i += 1) {
    let x; let y; let tries = 0;
    do {
      x = rng.range(100, 2300);
      y = rng.range(100, 1700);
      tries += 1;
    } while (!isOnRoad(x, y) && tries < 20);
    peds.push({
      x, y, angle: rng.angle(), speed: rng.range(28, 55),
      skin: rng.pick(skins), shirt: rng.pick(shirts),
      panic: 0, wanderT: rng.range(1, 4), alive: true,
    });
  }
  return peds;
}

export function movePlayerOnFoot(G, dt) {
  const p = G.player;
  const inp = G.input;
  let mx = inp.axis(['a', 'ArrowLeft'], ['d', 'ArrowRight']);
  let my = inp.axis(['w', 'ArrowUp'], ['s', 'ArrowDown']);
  if (mx === 0 && my === 0) { p.speed = 0; return; }
  const len = Math.hypot(mx, my);
  mx /= len; my /= len;
  const run = inp.down('Shift') ? PLAYER_RUN_MULT : 1;
  const sp = PLAYER_SPEED * run;
  p.speed = sp;
  p.facingX = mx; p.facingY = my;
  p.angle = Math.atan2(my, mx);
  const nx = p.x + mx * sp * dt;
  const ny = p.y + my * sp * dt;
  if (!rectBlocked(G.world, nx, p.y, PLAYER_RADIUS)) p.x = nx;
  if (!rectBlocked(G.world, p.x, ny, PLAYER_RADIUS)) p.y = ny;
  p.x = Math.max(24, Math.min(2576, p.x));
  p.y = Math.max(24, Math.min(1776, p.y));
}

export function driveCar(G, car, dt) {
  const inp = G.input;
  const gas = inp.down('w', 'ArrowUp') ? 1 : 0;
  const brake = inp.down('s', 'ArrowDown') ? 1 : 0;
  const steer = inp.axis(['a', 'ArrowLeft'], ['d', 'ArrowRight']);
  const handbrake = inp.down(' ');
  if (gas) car.speed += car.accel * dt;
  if (brake) car.speed -= car.accel * 1.4 * dt;
  if (!gas && !brake) car.speed *= Math.pow(0.4, dt);
  if (handbrake) car.speed *= Math.pow(0.05, dt);
  car.speed = Math.max(-car.top * 0.35, Math.min(car.top, car.speed));
  const dir = car.speed >= 0 ? 1 : -1;
  const turnRate = car.turn * (0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 180));
  car.angle += steer * turnRate * dt * dir * (handbrake ? 1.5 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const wasDrift = Math.abs(steer) > 0.5 && Math.abs(car.speed) > 220 && handbrake;
  if (!carBlocked(G.world, nx, ny, car.angle, car.w / 2, car.h / 2)) {
    car.x = Math.max(40, Math.min(2560, nx));
    car.y = Math.max(40, Math.min(1760, ny));
    if (car.x !== nx || car.y !== ny) car.speed *= 0.5;
    if (wasDrift) {
      car.driftT += dt;
      if (car.driftT > 0.8) {
        car.driftT = 0;
        G.player.drifts += 1;
        G.particles.popup(car.x, car.y - 30, `DRIFT x${1 + Math.min(4, G.player.drifts % 5)}`, '#ffd166', true);
        G.audio.sfx('cash');
      }
      const bx = car.x - Math.cos(car.angle) * car.w / 2;
      const by = car.y - Math.sin(car.angle) * car.h / 2;
      G.particles.addTireMark(bx, by, car.angle);
      if (Math.random() < 0.3) G.particles.smoke(bx, by);
    }
  } else {
    if (Math.abs(car.speed) > 150 && (!car.crashCd || car.crashCd <= 0)) {
      car.crashCd = 0.6;
      car.hp -= Math.abs(car.speed) * 0.08;
      G.particles.sparks(car.x, car.y);
      G.particles.smoke(car.x, car.y);
      G.audio.sfx('crash');
      G.shake = Math.min(10, Math.abs(car.speed) * 0.02);
    }
    car.speed *= -0.25;
  }
  if (car.crashCd > 0) car.crashCd -= dt;
  car.brakeLight = brake || handbrake;
  if (car.hp < car.maxHp * 0.35 && Math.random() < dt * 6) {
    G.particles.smoke(car.x - Math.cos(car.angle) * car.w / 2, car.y - Math.sin(car.angle) * car.h / 2);
  }
  if (Math.random() < dt * 8 && Math.abs(car.speed) > 40) {
    G.particles.exhaust(
      car.x - Math.cos(car.angle) * (car.w / 2 + 4),
      car.y - Math.sin(car.angle) * (car.h / 2 + 4),
      car.angle,
    );
  }
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
  G.audio.engineSet(Math.abs(car.speed) / car.top);
}

export function nearestCar(G, maxDist) {
  const p = G.player;
  let best = null; let bd = maxDist;
  for (const c of G.cars) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
