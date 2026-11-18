// NEON TIDE v6 — vehicles: car mesh factory + arcade driving physics on
// the XZ plane. Cars are a body box + cabin box (+ light bar for cruisers,
// slim frame for the bike), with damage, smoke, tire-burst and NOS boost.
import { CARS, NOS_BOOST, UPGRADES } from './config.js';
import { clamp, lerp } from './rng.js';

export function buildCarMesh(type) {
  const def = CARS[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.08 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x111122 });
  let body;
  if (type === 'bike') {
    body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 4.2), bodyMat);
    body.position.y = 0.7;
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 1.0), new THREE.MeshLambertMaterial({ color: 0xff5a96 })); // pink jacket rider
    rider.position.set(0, 1.5, -0.3); g.add(rider);
  } else if (type === 'truck') {
    body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 7.5), bodyMat);
    body.position.y = 1.4;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.0, 2.2), glassMat);
    cab.position.set(0, 2.6, 2.4); g.add(cab);
  } else {
    body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 5.2), bodyMat);
    body.position.y = 0.8;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.6), glassMat);
    cabin.position.set(0, 1.6, -0.3); g.add(cabin);
  }
  body.castShadow = true;
  g.add(body);
  // Headlight cones (fake light, cheap) + tail lights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.2), hl);
    h.position.set(s * 0.9, 0.7, 2.65); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.2), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    t.position.set(s * 0.9, 0.7, -2.65); g.add(t);
  }
  if (type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.6), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 2.25, -0.3); g.add(bar);
    g.userData.lightBar = bar;
  }
  // NOS flame (hidden unless boosting).
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 6), new THREE.MeshBasicMaterial({ color: 0x33aaff }));
  flame.rotation.x = Math.PI / 2; flame.position.set(0, 0.7, -3.4); flame.visible = false;
  g.add(flame); g.userData.flame = flame;
  return g;
}

export class Car {
  constructor(type, x, z, heading = 0) {
    const def = CARS[type];
    this.type = type;
    this.def = def;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.hp = def.hp;
    this.cond = 100; // condition 0..100
    this.nos = 0;
    this.nosMax = 0;
    this.tireBurstUntil = 0;
    this.upgrades = { engine: 0, grip: 0, armor: 0, nos: 0 };
    this.mesh = buildCarMesh(type);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.smoke = 0;
  }
  get topSpeed() {
    let top = this.def.top * (1 + UPGRADES.engine.topMul[this.upgrades.engine]);
    if (this.tireBurstUntil > (this._now || 0)) top *= 0.45;
    return top;
  }
  get turnRate() { return this.def.turn * (1 + UPGRADES.grip.turnMul[this.upgrades.grip]); }
  get maxHp() { return this.def.hp * (1 + UPGRADES.armor.hpMul[this.upgrades.armor]); }

  drive(input, dt, now, world) {
    this._now = now;
    const fwd = input.up ? 1 : input.dn ? -0.55 : 0;
    const boosting = input.nos && this.nos > 0 && fwd > 0 && this.nosMax > 0;
    const accel = this.def.accel * (boosting ? NOS_BOOST : 1);
    if (fwd !== 0) this.speed += fwd * accel * dt;
    else this.speed = lerp(this.speed, 0, 3 * dt);
    if (input.handbrake) this.speed = lerp(this.speed, 0, 6 * dt);
    this.speed = clamp(this.speed, -this.def.top * 0.4, this.topSpeed);
    const steer = (input.lf ? 1 : 0) - (input.rt ? 1 : 0);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += steer * this.turnRate * dt * dir * clamp(Math.abs(this.speed) / 60, 0, 1);
    if (boosting) this.nos = Math.max(0, this.nos - 34 * dt);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const p = { x: nx, z: nz };
    if (world.collideCircle(p, 3.2)) {
      if (Math.abs(this.speed) > 120) { this.damage(Math.abs(this.speed) * 0.06, now); }
      this.speed *= -0.25; // bounce off the wall
    } else { this.x = p.x; this.z = p.z; }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.userData.flame.visible = boosting;
    if (this.hp < this.maxHp * 0.45) this.smoke = Math.min(1, this.smoke + dt);
    else this.smoke = Math.max(0, this.smoke - dt);
  }

  damage(amount, now) {
    this.hp -= amount;
    this.cond = Math.max(0, this.cond - amount * 0.4);
    if (this.hp <= 0) this.hp = 0;
  }
  repair() { this.hp = this.maxHp; this.cond = 100; this.nos = this.nosMax; }
  burstTires(now, seconds = 5) { this.tireBurstUntil = now + seconds; this.cond = Math.max(0, this.cond - 12); }
}
