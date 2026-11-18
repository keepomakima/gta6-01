// NEON TIDE — entities.js
// Entitas dunia: pemain Deke, mobil (parkir + dikemudikan + curian), pejalan
// kaki, musuh geng, dan pickup (uang / ammo / armor). Fisika mobil memakai
// dua titik as (depan-belakang) supaya tidak menempel gedung seperti v2.
import { CAR_TYPES, WORLD_W, WORLD_H } from './config.js';
import { clamp, dist } from './random.js';
import { hitsBuilding, onRoad } from './world.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++, kind: 'player', x, y, angle: -Math.PI / 2, speed: 0,
    hp: 100, armor: 0, money: 250, respect: 0, alive: true,
    inCar: null, hurtT: 0, fireT: 0, runT: 0, weapon: 'pistol',
    owned: { fists: true, pistol: true, smg: false, shotgun: false },
    ammo: { pistol: 120, smg: 0, shotgun: 0 },
    driftScore: 0, nearMissScore: 0,
  };
}

export function makeCar(type, x, y, angle = 0, opts = {}) {
  const t = CAR_TYPES[type];
  return {
    id: nextId++, kind: 'car', type, x, y, angle, speed: 0,
    cond: opts.cond ?? 100, parked: opts.parked ?? false, driver: opts.driver ?? null,
    color: opts.color ?? t.color, len: t.len, wid: t.wid, smokeT: 0,
    ai: opts.ai ?? null, hornT: 0, skidT: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextId++, kind: 'ped', x, y,
    angle: rng() * Math.PI * 2, speed: 26 + rng() * 22,
    fleeT: 0, color: ['#e8d44d', '#7dd8ff', '#ff9d5c', '#c9a2ff', '#8affc1'][Math.floor(rng() * 5)],
    shirt: rng() < 0.5,
  };
}

export function makeEnemy(x, y, opts = {}) {
  return {
    id: nextId++, kind: 'enemy', x, y, hp: opts.hp ?? 60, alive: true,
    boss: opts.boss ?? false, angle: 0, fireT: 1 + Math.random() * 1.5,
    speed: opts.boss ? 95 : 78, label: opts.label ?? 'Tide Rat',
    shootT: 0, wanderA: Math.random() * Math.PI * 2,
  };
}

export function makePickup(x, y, kind, amount) {
  return { id: nextId++, kind: 'pickup', pkind: kind, x, y, amount, t: 0 };
}

// Gerakkan pemain jalan kaki (WASD, Shift lari). Tabrakan gedung lingkaran.
export function movePlayerOnFoot(G, p, dir, dt) {
  const run = G.input.down('ShiftLeft') || G.input.down('ShiftRight');
  const sp = run ? 235 : 150;
  p.x += dir.x * sp * dt;
  p.y += dir.y * sp * dt;
  p.angle = Math.atan2(dir.y, dir.x);
  p.x = clamp(p.x, 16, WORLD_W - 16);
  p.y = clamp(p.y, 16, WORLD_H - 16);
  if (hitsBuilding(G.world, p.x, p.y, 14)) {
    // Mundur setengah langkah dan geser sepanjang dinding (slide, bukan macet).
    p.x -= dir.x * sp * dt;
    p.y -= dir.y * sp * dt;
    const tryX = hitsBuilding(G.world, p.x + dir.x * sp * dt, p.y, 14);
    if (!tryX) p.x += dir.x * sp * dt;
    else if (!hitsBuilding(G.world, p.x, p.y + dir.y * sp * dt, 14)) p.y += dir.y * sp * dt;
  }
}

// Fisika mobil: gas W, rem/mundur S, belok A/D, handbrake Space.
// Tabrakan memakai dua titik as supaya mobil tidak nyangkut di gedung.
export function driveCar(G, car, dt) {
  const t = CAR_TYPES[car.type];
  const inp = G.input;
  const fwd = (inp.down('KeyW') || inp.down('ArrowUp')) ? 1 : 0;
  const back = (inp.down('KeyS') || inp.down('ArrowDown')) ? 1 : 0;
  const left = (inp.down('KeyA') || inp.down('ArrowLeft')) ? 1 : 0;
  const right = (inp.down('KeyD') || inp.down('ArrowRight')) ? 1 : 0;
  const brake = inp.down('Space');
  if (fwd) car.speed += t.accel * dt;
  if (back) car.speed -= (car.speed > 8 ? t.accel * 1.4 : t.accel * 0.55) * dt;
  if (brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  if (!fwd && !back) car.speed *= Math.max(0, 1 - 0.7 * dt);
  car.speed = clamp(car.speed, -t.top * 0.45, t.top);
  const steer = (right - left) * (car.speed >= 0 ? 1 : -1);
  car.angle += steer * t.turn * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Cek tabrakan di titik as depan & belakang.
  const fx = nx + Math.cos(car.angle) * (car.len / 2 - 4);
  const fy = ny + Math.sin(car.angle) * (car.len / 2 - 4);
  const bx = nx - Math.cos(car.angle) * (car.len / 2 - 4);
  const by = ny - Math.sin(car.angle) * (car.len / 2 - 4);
  const r = car.wid / 2 + 2;
  if (hitsBuilding(G.world, fx, fy, r) || hitsBuilding(G.world, bx, by, r)) {
    car.speed *= -0.25; // pantul pelan + kerusakan kecil
    damageCar(G, car, 3);
    G.particles.burst(fx, fy, 'spark', 6);
    G.audio.sfx('crash');
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 20, WORLD_W - 20);
  car.y = clamp(car.y, 20, WORLD_H - 20);
  // Bekas ban saat handbrake / belok tajam dalam kecepatan tinggi.
  if ((brake || Math.abs(steer) > 0) && Math.abs(car.speed) > 240) {
    car.skidT += dt;
    if (car.skidT > 0.05) {
      car.skidT = 0;
      G.particles.skid(bx, by, car.angle);
      if (Math.abs(car.speed) > 300 && G.player.driftScore < 99999) {
        G.player.driftScore += 1;
        if (G.player.driftScore % 90 === 0) addPopup(G, 'DRIFT +$25', 25);
      }
    }
  }
  // Asap knalpot + asap kerusakan.
  if (Math.abs(car.speed) > 40 && Math.random() < 0.35) {
    G.particles.burst(bx, by, 'exhaust', 1);
  }
  if (car.cond < 45) {
    car.smokeT += dt;
    if (car.smokeT > 0.12) { car.smokeT = 0; G.particles.burst(car.x, car.y - 6, 'smoke', 2); }
  }
}

export function damageCar(G, car, n) {
  car.cond = Math.max(0, car.cond - n);
  if (car.cond <= 0 && car.speed !== 0) car.speed *= 0.5;
}

// Popup skor mengambang (DRIFT / NEAR MISS +$).
export function addPopup(G, text, amount) {
  G.popups.push({ text, amount, t: 0, x: G.player.x, y: G.player.y - 30 });
  if (amount) G.player.money += amount;
}

// Cari mobil terdekat dari titik (x,y) dalam radius r.
export function nearestCar(cars, x, y, r) {
  let best = null, bd = r;
  for (const c of cars) {
    const d = dist(c.x, c.y, x, y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Pemain naik mobil: sopir lari bila ada; wanted naik bila polisi melihat.
export function enterCar(G, car) {
  const p = G.player;
  if (car.driver) {
    const d = car.driver;
    d.fleeT = 3;
    d.x += 30; d.y += 10;
    car.driver = null;
    if (G.wantedLevel < 5 && G.police.some((c) => c.kind === 'cop' && dist(c.x, c.y, p.x, p.y) < 420)) {
      G.raiseWanted(1, 'curi mobil dilihat polisi');
    }
  }
  car.parked = false;
  p.inCar = car;
  p.x = car.x; p.y = car.y;
  G.audio.sfx('door');
}

// Pemain turun dari mobil ke samping jalan.
export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  p.x = clamp(p.x, 16, WORLD_W - 16);
  p.y = clamp(p.y, 16, WORLD_H - 16);
  G.audio.sfx('door');
}

// Semua entitas harus tetap di dalam dunia.
export function clampToWorld(e) {
  e.x = clamp(e.x, 12, WORLD_W - 12);
  e.y = clamp(e.y, 12, WORLD_H - 12);
}
