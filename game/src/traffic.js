// NEON TIDE — traffic.js
// Lalu lintas Port Solano: mobil AI mengikuti jalan (lajur kanan, belok di
// persimpangan, berhenti bila ada mobil di depan), pejalan kaki di trotoar
// yang lari ketakutan saat ada tembakan atau tabrakan di dekatnya. Klakson
// saat pemain menghalangi jalan.
import { ROADS_V, ROADS_H, WORLD_W, WORLD_H, CAR_TYPES } from './config.js';
import { clamp, dist, pick } from './random.js';
import { makeCar, makePed, clampToWorld } from './entities.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'truck', 'sport'];

export function spawnTraffic(G, n = 14) {
  const rng = G.rng;
  for (let i = 0; i < n; i += 1) {
    const vertical = rng() < 0.5;
    const type = pick(rng, TRAFFIC_TYPES);
    let x, y, angle;
    if (vertical) {
      const vx = pick(rng, ROADS_V);
      const lane = rng() < 0.5 ? -22 : 22;
      x = vx + lane; y = rng() * WORLD_H;
      angle = lane < 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const hy = pick(rng, ROADS_H);
      const lane = rng() < 0.5 ? -22 : 22;
      x = rng() * WORLD_W; y = hy + lane;
      angle = lane < 0 ? 0 : Math.PI;
    }
    const car = makeCar(type, x, y, angle, { ai: { vertical, road: vertical ? x : y, speed: CAR_TYPES[type].top * 0.55 } });
    G.cars.push(car);
  }
}

export function spawnPeds(G, n = 22) {
  const rng = G.rng;
  for (let i = 0; i < n; i += 1) {
    const vertical = rng() < 0.5;
    let x, y;
    if (vertical) {
      x = pick(rng, ROADS_V) + (rng() < 0.5 ? -58 : 58);
      y = rng() * WORLD_H;
    } else {
      x = rng() * WORLD_W;
      y = pick(rng, ROADS_H) + (rng() < 0.5 ? -58 : 58);
    }
    G.peds.push(makePed(clamp(x, 20, WORLD_W - 20), clamp(y, 20, WORLD_H - 20), rng));
  }
}

// Mobil AI: jalan lurus di lajurnya, belok acak di persimpangan, rem bila
// ada kendaraan di depan, klakson bila pemain menghalangi. Revisi: belok
// hanya di persimpangan (onCross) supaya tidak keluar jalur di tengah jalan.
export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (!car.ai || car === p.inCar) continue;
    const ai = car.ai;
    // Belok di persimpangan (peluang kecil per detik).
    const onCrossV = ROADS_V.some((vx) => Math.abs(car.x - vx) < 6);
    const onCrossH = ROADS_H.some((hy) => Math.abs(car.y - hy) < 6);
    if ((onCrossV || onCrossH) && G.rng() < dt * 0.25) {
      const turn = G.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.angle += turn;
      ai.vertical = Math.abs(Math.sin(car.angle)) > 0.5;
    }
    // Rem bila ada mobil / pemain di depan dalam 70px.
    const fx = car.x + Math.cos(car.angle) * 60;
    const fy = car.y + Math.sin(car.angle) * 60;
    let blocked = false;
    for (const other of G.cars) {
      if (other !== car && dist(fx, fy, other.x, other.y) < 42) { blocked = true; break; }
    }
    if (dist(fx, fy, p.x, p.y) < 36) {
      blocked = true;
      car.hornT -= dt;
      if (car.hornT <= 0) { car.hornT = 2.5; G.audio.sfx('horn'); }
    }
    const target = blocked ? 0 : ai.speed;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Keluar ujung dunia -> muncul lagi di ujung berlawanan (lalu lintas abadi).
    if (car.x < -60) car.x = WORLD_W + 50;
    if (car.x > WORLD_W + 60) car.x = -50;
    if (car.y < -60) car.y = WORLD_H + 50;
    if (car.y > WORLD_H + 60) car.y = -50;
    // Near miss: pemain ngebut melewati traffic dengan jarak dekat.
    if (p.inCar && Math.abs(p.inCar.speed) > 300) {
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 55 && !car.nearMissed) {
        car.nearMissed = true;
        p.nearMissScore += 1;
        if (p.nearMissScore % 2 === 1) {
          G.popups.push({ text: 'NEAR MISS +$40', amount: 40, t: 0, x: p.x, y: p.y - 30 });
          p.money += 40;
        }
      } else if (d > 120) car.nearMissed = false;
    }
  }
}

// Pejalan kaki: jalan santai di trotoar, lari bila ada tembakan/tabrak dekat.
export function updatePeds(G, dt) {
  const p = G.player;
  const gunshot = G.combat.shotsFiredT > 0;
  for (const ped of G.peds) {
    const dPlayer = dist(ped.x, ped.y, p.x, p.y);
    if (gunshot && dPlayer < 380) ped.fleeT = 2.5;
    if (p.inCar && Math.abs(p.inCar.speed) > 200 && dPlayer < 90) ped.fleeT = 2;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
    } else {
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (G.rng() < dt * 0.1) ped.angle += (G.rng() - 0.5) * 1.6;
    }
    // Tetap di trotoar: bila masuk jalan, belok kembali.
    if (ped.x < 20 || ped.x > WORLD_W - 20 || ped.y < 20 || ped.y > WORLD_H - 20) {
      ped.angle += Math.PI;
    }
    clampToWorld(ped);
  }
}

// Mobil parkir di pinggir jalan (bisa dicuri): lajur luar, bukan trotoar.
export function spawnParkedCars(G) {
  const spots = [
    ['sedan', 668, 220], ['taxi', 620, 868], ['sport', 668, 420],
    ['sedan', 968, 620], ['truck', 1520, 868], ['sedan', 1820, 668],
    ['sport', 2120, 868], ['taxi', 920, 1068], ['sedan', 1220, 1468],
    ['sport', 620, 1068], ['sedan', 1820, 220], ['truck', 320, 1220],
  ];
  for (const [type, x, y] of spots) {
    const vertical = x % 2 === 0;
    const car = makeCar(type, x, y, vertical ? Math.PI / 2 : 0, { parked: true });
    G.cars.push(car);
  }
}
