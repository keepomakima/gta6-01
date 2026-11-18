// NEON TIDE v6 — combat: player weapons (fists / pistol / SMG), hitscan
// shooting aimed with the mouse (raycast to the ground plane), enemy gang
// members who shoot back, tracers, muzzle flashes and pickups. Enemies are
// simple low-poly figures with a health bar sprite above them.
import { WEAPONS } from './config.js';
import { clamp, dist2d } from './rng.js';

export class Combat {
  constructor(scene, world, player, police, traffic) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.police = police;
    this.traffic = traffic;
    this.enemies = [];
    this.bullets = []; // tracers {mesh, ttl}
    this.ammo = { pistol: 24, smg: 0 };
    this.weapon = 'pistol';
    this.cooldown = 0;
    this.aimX = 0; this.aimZ = 0;
    this._ray = null;
  }

  spawnEnemy(x, z, opts = {}) {
    const g = new THREE.Group();
    const shirt = opts.boss ? 0x111111 : opts.color || 0x5a1a6a;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 1.0), new THREE.MeshLambertMaterial({ color: shirt }));
    body.position.y = 2.5; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.0), new THREE.MeshLambertMaterial({ color: 0xd8b090 }));
    head.position.y = 4.2; g.add(head);
    if (opts.boss) {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), new THREE.MeshBasicMaterial({ color: 0xffb300 }));
      crown.position.y = 4.9; g.add(crown);
    }
    // Health bar: green quad floating above, scaled by hp fraction.
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.3), new THREE.MeshBasicMaterial({ color: 0x330000 }));
    barBg.position.y = 5.6; g.add(barBg);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.2), new THREE.MeshBasicMaterial({ color: 0x33ff55 }));
    bar.position.set(0, 5.6, 0.01); g.add(bar);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const e = {
      mesh: g, bar, x, z, heading: 0,
      hp: opts.hp || 60, maxHp: opts.hp || 60,
      damage: opts.damage || 2, interval: opts.interval || 1.6, timer: Math.random(),
      speed: opts.speed || 16, boss: !!opts.boss, name: opts.name || 'Rival',
      target: opts.target || null, // {x,z} guard post; null = chase player
    };
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  setAimFromMouse(camera, mouseX, mouseY) {
    // Unproject the mouse ray onto the y=0 plane.
    const nx = (mouseX / window.innerWidth) * 2 - 1;
    const ny = -(mouseY / window.innerHeight) * 2 + 1;
    const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    if (Math.abs(dir.y) < 0.001) return;
    const t = -camera.position.y / dir.y;
    if (t <= 0) return;
    this.aimX = camera.position.x + dir.x * t;
    this.aimZ = camera.position.z + dir.z * t;
  }

  _tracer(from, to, color = 0xffe9a8) {
    const len = Math.hypot(to.x - from.x, to.z - from.z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, Math.max(1, len)),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set((from.x + to.x) / 2, 1.6, (from.z + to.z) / 2);
    m.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    this.scene.add(m);
    this.bullets.push({ mesh: m, ttl: 0.09 });
  }

  _blocked(ax, az, bx, bz) {
    // Step along the shot; a building in the way blocks it.
    const d = dist2d(ax, az, bx, bz);
    const steps = Math.max(1, Math.floor(d / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.world.pointInBuilding(ax + (bx - ax) * t, az + (bz - az) * t)) return true;
    }
    return false;
  }

  shoot() {
    if (this.cooldown > 0) return false;
    const w = WEAPONS[this.weapon];
    const p = this.player.pos;
    if (this.weapon === 'fists') {
      this.cooldown = w.rate;
      let hitAny = false;
      for (const e of this.enemies) {
        if (dist2d(p.x, p.z, e.x, e.z) < w.range) { this._damageEnemy(e, w.damage); hitAny = true; }
      }
      return hitAny;
    }
    if (this.ammo[this.weapon] <= 0) { this.cooldown = 0.3; return false; }
    this.ammo[this.weapon]--;
    this.cooldown = w.rate;
    const tx = this.aimX, tz = this.aimZ;
    this._tracer({ x: p.x, z: p.z }, { x: tx, z: tz });
    if (this.traffic) this.traffic.scare(p.x, p.z, 110);
    // Nearest enemy within a cone of the aim point takes the hit.
    let best = null, bestD = 1e9;
    for (const e of this.enemies) {
      const dAim = dist2d(e.x, e.z, tx, tz);
      const dShot = dist2d(e.x, e.z, p.x, p.z);
      if (dAim < 14 && dShot < w.range && !this._blocked(p.x, p.z, e.x, e.z) && dShot < bestD) { best = e; bestD = dShot; }
    }
    if (best) { this._damageEnemy(best, w.damage); return true; }
    return false;
  }

  _damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.bar.scale.x = Math.max(0.01, e.hp / e.maxHp);
    e.bar.position.x = -(1 - e.hp / e.maxHp);
    if (e.hp <= 0) {
      this.scene.remove(e.mesh);
      this.enemies.splice(this.enemies.indexOf(e), 1);
      this.onKill && this.onKill(e);
    }
  }

  // Test helper: kill every live enemy instantly.
  shootAll() {
    for (const e of [...this.enemies]) this._damageEnemy(e, 99999);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.ttl -= dt;
      if (b.ttl <= 0) { this.scene.remove(b.mesh); this.bullets.splice(i, 1); }
    }
    const p = this.player.pos;
    for (const e of this.enemies) {
      const d = dist2d(e.x, e.z, p.x, p.z);
      const gx = e.target ? e.target.x : p.x;
      const gz = e.target ? e.target.z : p.z;
      const gd = dist2d(e.x, e.z, gx, gz);
      // Gang members hold their post until the player comes close (320);
      // bosses hunt relentlessly. This also stops a mission's leftover
      // enemies from marching across the whole map after the player.
      const hunting = e.boss || d < 320;
      if (hunting && gd > 26 && !e.target) {
        e.heading = Math.atan2(p.x - e.x, p.z - e.z);
        e.x += Math.sin(e.heading) * e.speed * dt;
        e.z += Math.cos(e.heading) * e.speed * dt;
      } else if (e.target && gd > 10) {
        e.heading = Math.atan2(gx - e.x, gz - e.z);
        e.x += Math.sin(e.heading) * e.speed * 0.6 * dt;
        e.z += Math.cos(e.heading) * e.speed * 0.6 * dt;
      } else {
        e.heading = Math.atan2(p.x - e.x, p.z - e.z);
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.heading;
      // Return fire.
      e.timer -= dt;
      if (e.timer <= 0 && d < 190 && !this._blocked(e.x, e.z, p.x, p.z)) {
        e.timer = e.interval;
        this._tracer({ x: e.x, z: e.z }, { x: p.x, z: p.z }, 0xff6644);
        this.player.damage(e.damage);
        if (this.police && e.boss) this.police.addHeat(2);
      }
    }
  }
}
