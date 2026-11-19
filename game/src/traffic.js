// NEON TIDE v7-coverfix — traffic.js (structural pass)
// 20 traffic cars in six types incl. vans, each with a varied paint job;
// 34 pedestrians — the living city v6r2 lacked. Traffic drives the road
// lines, stops for the car ahead, and turns at intersections at random.
import { RNG, randomRoadPoint, roadHeading } from './random.js';
import { SEED, TRAFFIC_PAINTS } from './config.js';
import { makeCar, makePed } from './entities.js';

export function spawnTraffic(S) {
  const rng = new RNG(SEED + 7);
  S.traffic = [];
  const types = ['sedan', 'sedan', 'taxi', 'truck', 'sport', 'van', 'sedan', 'taxi'];
  let i = 0;
  while (i < 20) {
    const p = randomRoadPoint(rng);
    const type = rng.pick(types);
    let paint = null;
    if (type !== 'taxi') paint = rng.pick(TRAFFIC_PAINTS);
    const car = makeCar(type, p.x, p.z, roadHeading(p.x, p.z), paint);
    car.ai = 'traffic';
    car.speed = rng.range(30, 55);
    S.traffic.push(car);
    i += 1;
  }
  S.peds = [];
  i = 0;
  while (i < 34) {
    const p = randomRoadPoint(rng);
    const ped = makePed(p.x + rng.range(-20, 20), p.z + rng.range(-20, 20));
    ped.heading = roadHeading(p.x, p.z);
    S.peds.push(ped);
    i += 1;
  }
}

export function spawnParkedCars(S) {
  const spots = [
    ['sport', 200, 0], ['taxi', -800, 100], ['sedan', 800, 200],
    ['sedan', -200, 400], ['truck', -1000, -100], ['bike', 760, -300],
    ['sedan', 0, -400], ['sport', 600, -200], ['van', -400, 600],
  ];
  S.parked = [];
  spots.forEach(([type, x, z]) => { S.parked.push(makeCar(type, x, z, Math.PI / 2)); });
}

// Is another traffic car in the 26-unit look-ahead box? Then stop.
function carBlocked(S, car, aheadX, aheadZ) {
  return S.traffic.some((o) => o !== car && Math.abs(o.x - aheadX) < 12 && Math.abs(o.z - aheadZ) < 12);
}

export function updateTraffic(S, dt) {
  S.traffic.forEach((car) => {
    if (car.cond <= 0) return;
    const aheadX = car.x + Math.sin(car.heading) * 26;
    const aheadZ = car.z + Math.cos(car.heading) * 26;
    let target = 42;
    if (carBlocked(S, car, aheadX, aheadZ)) target = 0;
    let k = dt * 1.5;
    if (k > 1) k = 1;
    car.speed += (target - car.speed) * k;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const gx = Math.abs(car.x - Math.round(car.x / 200) * 200);
    const gz = Math.abs(car.z - Math.round(car.z / 200) * 200);
    if (gx < 4 && gz < 4 && Math.random() < dt * 0.5) {
      if (Math.random() < 0.5) car.heading += Math.PI / 2;
      else car.heading -= Math.PI / 2;
    }
    const c = S.world.collideCircle(car.x, car.z, 4);
    car.x = c.x;
    car.z = c.z;
    if (car.x > 1080) car.x = 1080;
    if (car.x < -1080) car.x = -1080;
    if (car.z > 730) car.z = 730;
    if (car.z < -730) car.z = -730;
  });
  updatePeds(S, dt);
}

// Pedestrian walking: stroll along the sidewalk line, bob through the
// walk cycle; fleeing peds sprint away from the scare point.
export function updatePeds(S, dt) {
  S.peds.forEach((ped) => {
    if (ped.flee > 0) ped.walkPhase += dt * 14;
    else ped.walkPhase += dt * ped.walkSpeed;
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
    ped.x = c.x;
    ped.z = c.z;
  });
}

export function scarePeds(S, x, z, radius = 90) {
  S.peds.forEach((ped) => {
    const dx = ped.x - x, dz = ped.z - z;
    if (Math.hypot(dx, dz) < radius) {
      ped.flee = 3;
      ped.heading = Math.atan2(dx, dz);
    }
  });
}
