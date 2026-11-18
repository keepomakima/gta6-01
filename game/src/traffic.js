// NEON TIDE v4 — traffic: AI cars that follow the road grid and pedestrians
// who stroll the sidewalks and flee from gunfire and crashes.
// One job: ambient city life that reacts to the player.
import { ROADS_X, ROADS_Y, isOnRoad } from './world.js';
import { makeCar } from './entities.js';

export function spawnTrafficCars(world, rng, count) {
  const cars = [];
  const types = ['sedan', 'taxi', 'truck', 'sedan', 'taxi'];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.chance(0.5);
    let x; let y; let angle;
    if (vertical) {
      const rx = rng.pick(ROADS_X);
      x = rx + (rng.chance(0.5) ? 12 : -12);
      y = rng.range(100, 1700);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = rng.pick(ROADS_Y);
      x = rng.range(100, 2400);
      y = ry + (rng.chance(0.5) ? 12 : -12);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    }
    const car = makeCar(types[i % types.length], x, y, angle, 'ai');
    car.speed = rng.range(90, 150);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.driver !== 'ai') continue;
    // Keep to the road: if it drifted off, steer back to the nearest road line.
    if (!isOnRoad(car.x, car.y)) {
      const target = Math.atan2(900 - car.y, 1300 - car.x);
      car.angle += Math.sin(target - car.angle) * 1.5 * dt;
    }
    // Slow for the car ahead and for the player in the way.
    let slow = false;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      if (d < 70 && ahead > 0) { slow = true; break; }
    }
    const dp = Math.hypot(p.x - car.x, p.y - car.y);
    if (dp < 60 && p.onFoot) {
      slow = true;
      if (Math.random() < dt * 0.4) G.audio.sfx('horn'); // stuck behind a pedestrian
    }
    const targetSpeed = slow ? 0 : 130;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx; car.y = ny;
    // Wrap around the map edges so traffic never runs out.
    if (car.x < 60) { car.x = 2540; }
    if (car.x > 2540) { car.x = 60; }
    if (car.y < 60) { car.y = 1740; }
    if (car.y > 1740) { car.y = 60; }
    // Near miss: player in a fast car passes close to traffic.
    if (p.inCar && Math.abs(p.inCar.speed) > 260 && dp > 24 && dp < 46) {
      if (!car.nearMissCd || car.nearMissCd <= 0) {
        car.nearMissCd = 3;
        p.nearMisses += 1;
        p.money += 250;
        G.particles.popup(p.x, p.y - 40, 'NEAR MISS +$250', '#7dff8a', true);
        G.audio.sfx('cash');
      }
    }
    if (car.nearMissCd > 0) car.nearMissCd -= dt;
  }
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const dp = Math.hypot(p.x - ped.x, p.y - ped.y);
    if (dp < 150 && (G.combatNoise > 0 || (p.inCar && Math.abs(p.inCar.speed) > 200))) {
      ped.panic = 2.5;
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
      ped.angle = away;
    } else {
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = 2 + Math.random() * 3;
        ped.angle = Math.random() * Math.PI * 2;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!isOnRoad(ped.x, ped.y) && Math.random() < dt * 0.5) ped.angle += Math.PI / 2;
    }
    ped.x = Math.max(30, Math.min(2570, ped.x));
    ped.y = Math.max(30, Math.min(1770, ped.y));
  }
}
