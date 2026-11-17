// NEON TIDE — traffic.js
// Ambient traffic cars and parked cars. Traffic follows the road grid, keeps
// a lane, slows for the car ahead and turns at intersections; parked cars sit
// at the kerb waiting to be stolen.

import { CAR_TYPE_KEYS, CAR_TYPES, ROADS_V, ROADS_H, ROAD_W } from './config.js';
import { clamp, dist, randInt, randPick, randRange } from './random.js';
import { createCar, stepCar } from './entities.js';
import { resolveBuildingCollision, nearestRoadPoint } from './world.js';
import { shake } from './particles.js';

const TRAFFIC_TYPES = ['sedan', 'taxi', 'sedan', 'taxi', 'sport', 'truck'];

export function spawnParkedCars(G, n) {
  const rng = G.rng;
  let placed = 0;
  let tries = 0;
  while (placed < n && tries < n * 12) {
    tries += 1;
    const vertical = rng() < 0.5;
    const road = vertical ? randPick(rng, ROADS_V) : randPick(rng, ROADS_H);
    const along = randRange(rng, 120, vertical ? 1480 : 2280);
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? road + side * (ROAD_W / 2 - 16) : along;
    const y = vertical ? along : road + side * (ROAD_W / 2 - 16);
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    // Don't park on top of another car.
    if (G.cars.some((c) => dist(c.x, c.y, x, y) < 70)) continue;
    const type = randPick(rng, ['sedan', 'taxi', 'sport', 'sedan']);
    const car = createCar(G, type, x, y, angle, { driver: null, parked: true });
    car.color = randPick(rng, ['#4a7fb5', '#e8b73a', '#c62f4e', '#5a8a5a', '#8a7a5a', '#6b6b8a', '#b5b5b5']);
    G.cars.push(car);
    placed += 1;
  }
}

export function spawnTrafficCar(G, nearX, nearY) {
  const rng = G.rng;
  const spot = nearestRoadPoint(nearX + randRange(rng, -500, 500), nearY + randRange(rng, -500, 500));
  const type = randPick(rng, TRAFFIC_TYPES);
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = (ROAD_W / 2 - 16) * (rng() < 0.5 ? -1 : 1);
  const x = spot.vertical ? spot.x + lane : spot.x;
  const y = spot.vertical ? spot.y : spot.y + lane;
  const angle = spot.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = createCar(G, type, x, y, angle, {
    driver: 'traffic',
    ai: {
      vertical: spot.vertical,
      dir,
      cruise: randRange(rng, 0.45, 0.7) * CAR_TYPES[type].top,
      turnCooldown: randRange(rng, 4, 10),
    },
  });
  // Some traffic cars carry a driver ped who bails when the car is stolen.
  if (rng() < 0.6) {
    const driver = {
      id: 90000 + car.id,
      kind: 'ped',
      x: car.x, y: car.y,
      angle: car.angle, hp: 50, speed: 60,
      shirt: randPick(rng, ['#d97b4f', '#5f8f5a', '#7a6fb0', '#b0567a']),
      state: 'drive', walkT: 0, carId: car.id, flashT: 0, walkAnim: 0,
    };
    G.peds.push(driver);
  }
  G.cars.push(car);
  return car;
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i += 1) {
    spawnTrafficCar(G, G.player.x + randRange(G.rng, -700, 700), G.player.y + randRange(G.rng, -500, 500));
  }
}

// Traffic AI: cruise along the road, slow for the car ahead, turn at
// intersections, despawn far away and respawn near the player.
export function updateTraffic(G, dt) {
  const p = G.player;
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.driver !== 'traffic' || !car.ai) continue;
    const ai = car.ai;
    // Despawn when far from the player; the spawner tops the count up.
    if (dist(car.x, car.y, p.x, p.y) > 1100) {
      G.cars.splice(i, 1);
      continue;
    }
    // Car ahead in the same lane? Slow down.
    let blocked = false;
    for (const other of G.cars) {
      if (other === car || other.hp <= 0) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 26) { blocked = true; break; }
    }
    // Turn at intersections sometimes.
    ai.turnCooldown -= dt;
    const nearCross = ROADS_V.some((rx) => Math.abs(car.x - rx) < 30)
      || ROADS_H.some((ry) => Math.abs(car.y - ry) < 30);
    if (ai.turnCooldown <= 0 && nearCross && G.rng() < 0.5) {
      ai.turnCooldown = randRange(G.rng, 5, 12);
      ai.vertical = !ai.vertical;
      ai.dir = G.rng() < 0.5 ? 1 : -1;
      car.angle = ai.vertical
        ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (ai.dir > 0 ? 0 : Math.PI);
    }
    // Keep the car centred on its lane.
    const target = ai.vertical
      ? nearestRoadPoint(car.x, car.y).x + (ai.dir > 0 ? 14 : -14)
      : nearestRoadPoint(car.x, car.y).y + (ai.dir > 0 ? 14 : -14);
    const want = ai.vertical ? target - car.x : target - car.y;
    const steer = clamp(want * 0.02, -0.5, 0.5);
    const targetSpeed = blocked ? 0 : ai.cruise;
    const throttle = car.speed < targetSpeed ? 0.6 : 0;
    const brake = car.speed > targetSpeed ? 0.8 : 0;
    stepCar(G, car, steer, throttle, brake, false, dt);
    // Stay on the road: nudge back if pushed off.
    resolveBuildingCollision(G.world, car, car.wid / 2 + 2);
  }
  // Keep the streets busy near the player.
  const trafficCount = G.cars.filter((c) => c.driver === 'traffic').length;
  if (trafficCount < 10 && G.frame % 90 === 0) {
    spawnTrafficCar(G, p.x, p.y);
  }
}

// Car-vs-car collision: push apart and trade speed, with a thud on hard hits.
export function resolveCarCollisions(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const min = (a.len + b.len) / 2 - 8;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 120) {
          a.hp -= 4;
          b.hp -= 4;
          if (a.driver === 'player' || b.driver === 'player') {
            G.audio.crash();
            shake(G, 4);
          }
        }
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.8;
        b.speed = avg * 0.8;
      }
    }
  }
}
