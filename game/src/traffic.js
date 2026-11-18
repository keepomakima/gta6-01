// NEON TIDE v6 — traffic AI cars + pedestrians. Traffic cars follow the
// road grid (nearest road axis, turn at intersections, stop briefly when a
// car is ahead); pedestrians stroll the sidewalks and flee from gunfire or
// near-miss cars. All deterministic from the seeded RNG.
import { ROADS_X, ROADS_Z, WORLD } from './config.js';
import { makeRng, clamp } from './rng.js';
import { SEED } from './config.js';
import { Car } from './vehicles.js';

const PED_COLORS = [0xd8c8a8, 0x8a5a3a, 0x3a6a8a, 0x9a3a5a, 0x4a8a3a, 0xd8d8d8];

export class Traffic {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.rng = makeRng(SEED + 7);
    this.cars = [];
    this.peds = [];
    this.fleeing = 0;
    for (let i = 0; i < 14; i++) this.spawnCar();
    for (let i = 0; i < 18; i++) this.spawnPed();
  }

  _onRoad(v) {
    // Snap to the nearest road line on one axis.
    let best = ROADS_X[0], bd = 1e9;
    for (const x of ROADS_X) { const d = Math.abs(v - x); if (d < bd) { bd = d; best = x; } }
    return best;
  }
  _onRoadZ(v) {
    let best = ROADS_Z[0], bd = 1e9;
    for (const z of ROADS_Z) { const d = Math.abs(v - z); if (d < bd) { bd = d; best = z; } }
    return best;
  }

  spawnCar() {
    const rng = this.rng;
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sport']);
    const vertical = rng.chance(0.5);
    const x = vertical ? this._onRoad(rng.range(-1000, 1000)) : rng.range(-1000, 1000);
    const z = vertical ? rng.range(-600, 600) : this._onRoadZ(rng.range(-600, 600));
    const car = new Car(type, x, z, vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2));
    car.speed = rng.range(60, 140);
    car.ai = { vertical, wait: 0, targetSpeed: car.speed };
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  spawnPed() {
    const rng = this.rng;
    const x = rng.range(-1000, 1000), z = rng.range(-650, 650);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 1.0), new THREE.MeshLambertMaterial({ color: rng.pick(PED_COLORS) }));
    body.position.y = 1.6; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xd8b090 }));
    head.position.y = 3.6; g.add(head);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const ped = { mesh: g, x, z, heading: rng.range(0, Math.PI * 2), speed: rng.range(4, 9), flee: 0, fx: 0, fz: 0 };
    this.peds.push(ped);
    return ped;
  }

  scare(x, z, radius = 90) {
    this.fleeing = 0;
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) { p.flee = 3; p.fx = (p.x - x) / (d || 1); p.fz = (p.z - z) / (d || 1); }
    }
  }

  update(dt, playerX, playerZ) {
    for (const car of this.cars) {
      const ai = car.ai;
      // Slow down if a car is close ahead.
      let ahead = false;
      for (const o of this.cars) {
        if (o === car) continue;
        const dx = o.x - car.x, dz = o.z - car.z;
        const fwd = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
        if (fwd > 0 && fwd < 26 && Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz) < 6) { ahead = true; break; }
      }
      if (ahead) { car.speed = Math.max(0, car.speed - 200 * dt); continue; }
      car.speed += (ai.targetSpeed - car.speed) * dt * 0.5;
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      // Turn at intersections: snap heading when crossing the next road line.
      if (ai.vertical) {
        const nextZ = this._onRoadZ(nz + Math.sign(Math.cos(car.heading)) * 20);
        if (Math.abs(nz - nextZ) < 4 && this.rng.chance(0.012)) {
          car.heading = this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          ai.vertical = false; car.x = this._onRoad(car.x);
        }
      } else {
        const nextX = this._onRoad(nx + Math.sign(Math.sin(car.heading)) * 20);
        if (Math.abs(nx - nextX) < 4 && this.rng.chance(0.012)) {
          car.heading = this.rng.chance(0.5) ? 0 : Math.PI;
          ai.vertical = true; car.z = this._onRoadZ(car.z);
        }
      }
      const p = { x: nx, z: nz };
      if (!this.world.collideCircle(p, 3)) { car.x = p.x; car.z = p.z; }
      else { car.heading += Math.PI / 2; car.speed = 40; }
      if (car.x < WORLD.minX + 20 || car.x > WORLD.maxX - 20 || car.z < WORLD.minZ + 20 || car.z > WORLD.maxZ - 20) {
        car.heading += Math.PI; // turn around at the city edge
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    for (const p of this.peds) {
      let sp = p.speed;
      if (p.flee > 0) {
        p.flee -= dt; sp = 26;
        p.heading = Math.atan2(p.fx, p.fz);
      } else if (this.rng.chance(0.002)) p.heading += this.rng.range(-1.5, 1.5);
      p.x += Math.sin(p.heading) * sp * dt;
      p.z += Math.cos(p.heading) * sp * dt;
      const q = { x: p.x, z: p.z };
      if (this.world.collideCircle(q, 1.5)) { p.x = q.x; p.z = q.z; p.heading += Math.PI / 2; }
      p.x = clamp(p.x, WORLD.minX, WORLD.maxX);
      p.z = clamp(p.z, WORLD.minZ, WORLD.maxZ);
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      if (p.flee > 0) this.fleeing++;
    }
  }
}
