// NEON TIDE v6 — Deke Marlowe on foot and behind the wheel. On foot: WASD
// walk/run with building collision; in a car: the car's own physics. E
// enters the nearest car (empty cars are free; occupied ones make the
// driver flee and add wanted if police see it). Busted/Wasted respawn here.
import { clamp } from './rng.js';
import { Car } from './vehicles.js';

export class Player {
  constructor(scene, world, x, z) {
    this.scene = scene;
    this.world = world;
    this.x = x; this.z = z;
    this.heading = 0;
    this.speed = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.armor = 0;
    this.car = null; // Car instance or null
    this.walkSpeed = 26;
    this.runSpeed = 52;
    this.mesh = this._buildMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  _buildMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2a3a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x22242e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8b090 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.9), jacket);
    torso.position.y = 2.6; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), skin);
    head.position.y = 4.2; g.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 1.05), new THREE.MeshLambertMaterial({ color: 0x14100c }));
    hair.position.y = 4.8; g.add(hair);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.7), pants);
      leg.position.set(s * 0.4, 0.8, 0); g.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.6), jacket);
      arm.position.set(s * 1.05, 2.7, 0); g.add(arm);
    }
    return g;
  }

  get pos() { return this.car ? { x: this.car.x, z: this.car.z } : { x: this.x, z: this.z }; }

  update(dt, input, now) {
    if (this.car) {
      this.car.drive(input, dt, now, this.world);
      this.x = this.car.x; this.z = this.car.z; this.heading = this.car.heading;
      this.mesh.visible = false;
      this.mesh.position.set(this.x, 0, this.z);
      return;
    }
    this.mesh.visible = true;
    const run = input.run;
    const sp = run ? this.runSpeed : this.walkSpeed;
    // main.js sets moveOverride to a camera-relative vector {mx, mz} when
    // the player is on foot; the car always uses raw input.
    let mx, mz;
    if (this.moveOverride) { mx = this.moveOverride.mx; mz = this.moveOverride.mz; }
    else {
      mx = (input.rt ? 1 : 0) - (input.lf ? 1 : 0);
      mz = (input.up ? 1 : 0) - (input.dn ? 1 : 0);
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len; mz /= len;
      this.heading = Math.atan2(mx, mz);
      const p = { x: this.x + mx * sp * dt, z: this.z + mz * sp * dt };
      this.world.collideCircle(p, 1.6);
      this.x = p.x; this.z = p.z;
      this.speed = sp;
    } else this.speed = 0;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  enterCar(car) {
    this.car = car;
    this.x = car.x; this.z = car.z; this.heading = car.heading;
    this.mesh.visible = false;
  }
  exitCar() {
    if (!this.car) return;
    const car = this.car;
    this.car = null;
    // Step out to the side of the car.
    this.x = car.x + Math.cos(car.heading) * 5;
    this.z = car.z - Math.sin(car.heading) * 5;
    const p = { x: this.x, z: this.z };
    this.world.collideCircle(p, 1.6);
    this.x = p.x; this.z = p.z;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }

  damage(amount) {
    let rest = amount;
    if (this.armor > 0) { const absorbed = Math.min(this.armor, rest); this.armor -= absorbed; rest -= absorbed; }
    this.hp = Math.max(0, this.hp - rest);
  }
  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  get alive() { return this.hp > 0; }
  respawn(x, z) {
    if (this.car) { this.car = null; this.mesh.visible = true; }
    this.x = x; this.z = z; this.hp = this.maxHp; this.speed = 0;
    this.mesh.position.set(x, 0, z);
  }
}
