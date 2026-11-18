// NEON TIDE v6 — wanted level + police. Foot cops chase and can bust the
// player on foot; cruisers chase cars, PIT at wanted >= 3, spike strips at
// wanted >= 4, roadblocks at wanted >= 3, and the AIR-1 helicopter with a
// spotlight at wanted 4-5. Wanted decays when no police can see the player.
import { clamp, dist2d } from './rng.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.wanted = 0;
    this.heat = 0; // 0..100, drives wanted up
    this.cops = []; // on-foot officers {mesh,x,z,heading}
    this.cruisers = [];
    this.roadblocks = [];
    this.spikes = [];
    this.heli = null; // {group, x, z, y, angle}
    this.holdHeli = false; // shots park the heli in frame
    this.heliSpot = null;
    this.bustTimer = 0;
    this.busted = false;
    this.loseTimer = 0;
    this.spawnTimer = 0;
    this.pitTimer = 0;
    this.spikeTimer = 0;
    this._copMat = new THREE.MeshLambertMaterial({ color: 0x1a2a6a });
  }

  addHeat(n) {
    this.heat = clamp(this.heat + n, 0, 100);
    const w = this.heat >= 85 ? 5 : this.heat >= 65 ? 4 : this.heat >= 45 ? 3 : this.heat >= 25 ? 2 : this.heat >= 8 ? 1 : 0;
    if (w > this.wanted) this.wanted = w;
  }
  setWanted(n) { this.wanted = clamp(n, 0, 5); this.heat = n * 18; }

  _spawnCop(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.9), this._copMat);
    body.position.y = 2.4; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xd8b090 }));
    head.position.y = 4.0; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), new THREE.MeshLambertMaterial({ color: 0x0a0a18 }));
    cap.position.y = 4.6; g.add(cap);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const cop = { mesh: g, x, z, heading: 0, speed: 30 };
    this.cops.push(cop);
    return cop;
  }

  _spawnCruiser(x, z) {
    const car = new Car('cruiser', x, z, 0);
    car.ai = { pit: 0 };
    this.scene.add(car.mesh);
    this.cruisers.push(car);
    return car;
  }

  _spawnRoadblock(x, z, heading) {
    const g = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 1.2), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
      b.position.set(i * 2.6, 0.8, 0); b.castShadow = true; g.add(b);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.25), new THREE.MeshBasicMaterial({ color: 0xff5500 }));
      stripe.position.set(i * 2.6, 1.5, 0); g.add(stripe);
    }
    g.position.set(x, 0, z); g.rotation.y = heading;
    this.scene.add(g);
    const rb = { mesh: g, x, z, ttl: 40 };
    this.roadblocks.push(rb);
    this.world.colliders.push({ x0: x - 5, z0: z - 2, x1: x + 5, z1: z + 2 });
    return rb;
  }

  _spawnSpike(x, z, heading) {
    const g = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 2.2), new THREE.MeshLambertMaterial({ color: 0x333338 }));
    strip.position.y = 0.2; g.add(strip);
    for (let i = -4; i <= 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.0, 4), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
      spike.position.set(i * 1.1, 0.8, 0); g.add(spike);
    }
    g.position.set(x, 0, z); g.rotation.y = heading;
    this.scene.add(g);
    const s = { mesh: g, x, z, ttl: 25, hit: false };
    this.spikes.push(s);
    return s;
  }

  _spawnHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 8), new THREE.MeshLambertMaterial({ color: 0x3a3a48 }));
    body.position.y = 0; body.castShadow = true; g.add(body);
    const strobe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(0, -1.3, 0); g.add(strobe); // belly light, reads at night
    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    tailLight.position.set(0, 0.4, -9.2); g.add(tailLight);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 1.2), new THREE.MeshLambertMaterial({ color: 0x333338 }));
    rotor.position.y = 1.6; g.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
    tail.position.set(0, 0.4, -6); g.add(tail);
    const spot = new THREE.Mesh(new THREE.ConeGeometry(6, 28, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.10, side: THREE.DoubleSide }));
    spot.position.y = -14; g.add(spot); // apex at the heli, base on the ground
    g.position.set(this.player.x, 90, this.player.z - 40);
    this.scene.add(g);
    this.heli = { group: g, rotor, x: this.player.x, z: this.player.z - 40, y: 90, angle: 0 };
  }

  _despawnHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
  }

  _nearestSpawn(px, pz, minDist) {
    // Spawn off-screen but inside the city, at least minDist from the player.
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = minDist + Math.random() * 160;
      const x = clamp(px + Math.sin(a) * d, -1050, 1050);
      const z = clamp(pz + Math.cos(a) * d, -700, 700);
      if (!this.world.pointInBuilding(x, z)) return { x, z };
    }
    return { x: clamp(px + minDist, -1050, 1050), z: pz };
  }

  update(dt, now) {
    const p = this.player.pos;
    const w = this.wanted;
    // Spawn pressure scales with wanted.
    this.spawnTimer -= dt;
    if (w > 0 && this.spawnTimer <= 0) {
      this.spawnTimer = w >= 4 ? 1.6 : 2.6;
      if (this.cops.length < w * 2) {
        const s = this._nearestSpawn(p.x, p.z, 200);
        this._spawnCop(s.x, s.z);
      }
      if (w >= 2 && this.cruisers.length < Math.min(4, w)) {
        const s = this._nearestSpawn(p.x, p.z, 300);
        this._spawnCruiser(s.x, s.z);
      }
      if (w >= 3 && this.roadblocks.length < 2 && Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        this._spawnRoadblock(clamp(p.x + Math.sin(a) * 260, -1000, 1000), clamp(p.z + Math.cos(a) * 260, -700, 700), a);
      }
      if (w >= 4 && this.spikes.length < 2) {
        const s = this._nearestSpawn(p.x, p.z, 180);
        this._spawnSpike(s.x, s.z, Math.random() * Math.PI);
      }
    }
    if (w >= 4 && !this.heli) this._spawnHeli();
    if (w < 4 && this.heli) this._despawnHeli();

    // Foot cops chase; bust only on foot and at close range.
    let seen = false;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = dist2d(c.x, c.z, p.x, p.z);
      if (d < 420) seen = true;
      if (d > 700) { this.scene.remove(c.mesh); this.cops.splice(i, 1); continue; }
      const sp = w >= 3 ? 38 : 30;
      c.heading = Math.atan2(p.x - c.x, p.z - c.z);
      c.x += Math.sin(c.heading) * sp * dt;
      c.z += Math.cos(c.heading) * sp * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      if (d < 7 && !this.player.car) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.2) { this.busted = true; this.bustTimer = 0; }
      }
    }
    if (this.cops.length === 0) this.bustTimer = 0;

    // Cruisers chase the player (car or foot), PIT at wanted >= 3.
    this.pitTimer -= dt;
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const c = this.cruisers[i];
      const d = dist2d(c.x, c.z, p.x, p.z);
      if (d > 800) { this.scene.remove(c.mesh); this.cruisers.splice(i, 1); continue; }
      const target = Math.atan2(p.x - c.x, p.z - c.z);
      let dh = target - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
      c.speed = Math.min(c.topSpeed * 0.96, c.speed + 200 * dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const q = { x: nx, z: nz };
      if (!this.world.collideCircle(q, 3.2)) { c.x = q.x; c.z = q.z; } else c.speed *= 0.4;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // PIT: ram the player's flank, spin them out.
      if (w >= 3 && this.player.car && d < 12 && this.pitTimer <= 0) {
        this.pitTimer = 6;
        this.player.car.heading += 0.7;
        this.player.car.speed *= 0.55;
        this.player.car.damage(8, now);
      }
      // Ram the player on foot.
      if (!this.player.car && d < 6) this.player.damage(18 * dt * 10 * 0.1);
    }

    // Spike strips burst the player's tires.
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i];
      s.ttl -= dt;
      if (s.ttl <= 0) { this.scene.remove(s.mesh); this.spikes.splice(i, 1); continue; }
      if (!s.hit && this.player.car && dist2d(s.x, s.z, p.x, p.z) < 6) {
        s.hit = true;
        this.player.car.burstTires(now, 5);
        this.scene.remove(s.mesh); this.spikes.splice(i, 1);
      }
    }
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.ttl -= dt;
      if (rb.ttl <= 0) { this.scene.remove(rb.mesh); this.roadblocks.splice(i, 1); }
    }

    // Helicopter circles overhead, spotlight on the player.
    if (this.heli) {
      const h = this.heli;
      // Circle the player — unless a shot parked the heli in frame.
      if (!this.holdHeli) {
        h.angle += dt * 0.5;
        h.x = p.x + Math.sin(h.angle) * 46;
        h.z = p.z + Math.cos(h.angle) * 46;
      }
      h.group.position.set(h.x, h.y, h.z);
      h.group.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
      h.rotor.rotation.y += dt * 22;
    }

    // Wanted decay: out of sight long enough and the heat cools off.
    if (w > 0) {
      if (!seen && this.cruisers.length === 0) {
        this.loseTimer += dt;
        if (this.loseTimer > 6) {
          this.wanted = Math.max(0, w - 1);
          this.heat = Math.max(0, this.heat - 20);
          this.loseTimer = 0;
        }
      } else this.loseTimer = 0;
    }
  }
}
