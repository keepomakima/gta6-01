// NEON TIDE v7 "Golden Hour" — traffic.js
// v7: 20 traffic cars (was 14) in six types incl. vans, each with a varied
// paint job; 34 pedestrians (was 22) — the living city v6r2 lacked.
import { RNG, randomRoadPoint, roadHeading } from './random.js';
import { SEED, TRAFFIC_PAINTS } from './config.js';
import { makeCar, makePed } from './entities.js';

export function spawnTraffic(S) {
  const rng = new RNG(SEED + 7);
  S.traffic = [];
  const types = ['sedan', 'sedan', 'taxi', 'truck', 'sport', 'van', 'sedan', 'taxi'];
  for (let i = 0; i < 20; i++) {
    const p = randomRoadPoint(rng);
    const type = rng.pick(types);
    const paint = type === 'taxi' ? null : rng.pick(TRAFFIC_PAINTS);
    const car = makeCar(type, p.x, p.z, roadHeading(p.x, p.z), paint);
    car.ai = 'traffic';
    car.speed = rng.range(30, 55);
    S.traffic.push(car);
  }
  S.peds = [];
  for (let i = 0; i < 34; i++) {
    const p = randomRoadPoint(rng);
    const ped = makePed(p.x + rng.range(-20, 20), p.z + rng.range(-20, 20));
    ped.heading = roadHeading(p.x, p.z);
    S.peds.push(ped);
  }
}

export function updateTraffic(S, dt) {
  for (const car of S.traffic) {
    if (car.cond <= 0) continue;
    const aheadX = car.x + Math.sin(car.heading) * 26;
    const aheadZ = car.z + Math.cos(car.heading) * 26;
    let blocked = false;
    for (const o of S.traffic) {
      if (o !== car && Math.abs(o.x - aheadX) < 12 && Math.abs(o.z - aheadZ) < 12) { blocked = true; break; }
    }
    const target = blocked ? 0 : 42;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const gx = Math.abs(car.x - Math.round(car.x / 200) * 200);
    const gz = Math.abs(car.z - Math.round(car.z / 200) * 200);
    if (gx < 4 && gz < 4 && Math.random() < dt * 0.5) {
      car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
    }
    const c = S.world.collideCircle(car.x, car.z, 4);
    car.x = c.x; car.z = c.z;
    car.x = Math.max(-1080, Math.min(1080, car.x));
    car.z = Math.max(-730, Math.min(730, car.z));
  }
  updatePeds(S, dt);
}

// Pedestrian walking: stroll along the sidewalk line, bob through the walk
// cycle; fleeing peds sprint away from the scare point. Kept here with
// traffic because both are ambient city life; pedestrians.js draws them.
export function updatePeds(S, dt) {
  for (const ped of S.peds) {
    ped.walkPhase += dt * (ped.flee > 0 ? 14 : ped.walkSpeed);
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += Math.sin(ped.heading) * 26 * dt;
      ped.z += Math.cos(ped.heading) * 26 * dt;
    } else {
      ped.x += Math.sin(ped.heading) * ped.walkSpeed * dt;
      ped.z += Math.cos(ped.heading) * ped.walkSpeed * dt;
      if (Math.random() < dt * 0.05) ped.heading += (Math.random() - 0.5) * 1.2;
    }
    const c = S.world.collideCircle(ped.x, ped.z, 2);
    ped.x = c.x; ped.z = c.z;
  }
}

export function scarePeds(S, x, z, radius = 90) {
  for (const ped of S.peds) {
    const dx = ped.x - x, dz = ped.z - z;
    if (dx * dx + dz * dz < radius * radius) {
      ped.flee = 3;
      ped.heading = Math.atan2(dx, dz);
    }
  }
}

export function spawnParkedCars(S) {
  const spots = [
    ['sport', 200, 0], ['taxi', -800, 100], ['sedan', 800, 200],
    ['sedan', -200, 400], ['truck', -1000, -100], ['bike', 760, -300],
    ['sedan', 0, -400], ['sport', 600, -200], ['van', -400, 600],
  ];
  S.parked = spots.map(([type, x, z]) => makeCar(type, x, z, Math.PI / 2));
}
