// NEON TIDE v5 — traffic: AI cars that follow the road grid and stop at
// junctions, plus parked cars the player can steal. Traffic cars slow for
// the car ahead so they never pile up.
import { makeCar, carStats } from './entities.js';
import { ROAD_X, ROAD_Y } from './world.js';
import { dist, pick } from './random.js';
import { WORLD_W, WORLD_H } from './config.js';

export function spawnTraffic(g, rng, n = 10) {
  g.traffic = [];
  const types = ['sedan', 'taxi', 'sport', 'truck', 'sedan', 'taxi'];
  for (let i = 0; i < n; i++) {
    const horiz = rng() < 0.5;
    const car = makeCar(pick(rng, types),
      horiz ? 100 + rng() * (WORLD_W - 200) : pick(rng, ROAD_X),
      horiz ? pick(rng, ROAD_Y) : 100 + rng() * (WORLD_H - 200),
      0, false);
    car.axis = horiz ? 'h' : 'v';
    car.lane = horiz ? car.y : car.x;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.speed = 130 + rng() * 90;
    car.driver = true;
    g.traffic.push(car);
  }
}

export function spawnParked(g, rng) {
  // Parked, stealable cars around Old Town and the garage district.
  // Nothing parks within 75px of the spots the player walks up to, so E
  // always grabs the car the player was just given, never a bystander.
  const spots = [
    ['taxi', 760, 880], ['sedan', 580, 780],
    ['sport', 1520, 820], ['truck', 900, 500], ['sedan', 1200, 800],
    ['taxi', 1500, 1100], ['sedan', 300, 1100], ['sport', 1800, 500],
    ['sedan', 900, 1400],
  ];
  for (const [type, x, y] of spots) {
    const c = makeCar(type, x, y, (rng() - 0.5) * 0.6, true);
    g.cars.push(c);
  }
  // The Tide Runner 900 motorcycle waits by Rosa's Garage.
  const bike = makeCar('bike', 1520, 860, 0.3, true);
  g.cars.push(bike);
}

export function updateTraffic(g, dt) {
  for (const car of g.traffic) {
    let blocked = false;
    for (const other of [...g.traffic, ...g.cars]) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const ahead = car.axis === 'h'
          ? Math.sign(other.x - car.x) === car.dir
          : Math.sign(other.y - car.y) === car.dir;
        if (ahead) { blocked = true; break; }
      }
    }
    const p = g.player;
    if (p.inCar && p.car && dist(car.x, car.y, p.car.x, p.car.y) < 70) blocked = true;
    const target = blocked ? 0 : 150;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    if (car.axis === 'h') {
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 60) { car.dir = 1; }
      if (car.x > WORLD_W - 60) { car.dir = -1; }
      // Sometimes turn at a junction.
      if (Math.abs(car.x - 1200) < 8 && Math.random() < 0.002) {
        car.axis = 'v'; car.lane = 1200; car.dir = Math.random() < 0.5 ? 1 : -1;
      }
    } else {
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 60) { car.dir = 1; }
      if (car.y > WORLD_H - 60) { car.dir = -1; }
      if (Math.abs(car.y - 800) < 8 && Math.random() < 0.002) {
        car.axis = 'h'; car.lane = 800; car.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }
}

export function nearestCar(g, x, y, maxD, exclude = null) {
  let best = null, bd = maxD;
  for (const c of g.cars) {
    if (c === exclude) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
