// NEON TIDE v5 — combat: fists, pistol, SMG, shotgun. Mouse aims, hold
// to fire. Enemy bullets and player bullets share one list; dead enemies
// drop cash and ammo.
import { WEAPONS, ENEMY_DMG } from './config.js';
import { dist, angleDiff } from './random.js';
import { burst } from './particles.js';
import { hurtPlayer } from './entities.js';
import { hitsSolid } from './world.js';

export function fireWeapon(g) {
  const p = g.player;
  if (p.inCar || g.mode !== 'play') return;
  const w = WEAPONS[p.weapon];
  if (p.fireT > 0) return;
  const cam = g.cam;
  const mx = g.input.mouse.x + cam.x;
  const my = g.input.mouse.y + cam.y;
  const a = Math.atan2(my - p.y, mx - p.x);
  p.angle = a;
  p.fireT = 1 / w.rate;
  if (p.weapon === 'fists') {
    for (const e of g.enemies) {
      if (e.alive && dist(p.x, p.y, e.x, e.y) < w.range) damageEnemy(g, e, w.dmg);
    }
    return;
  }
  if ((p.ammo[p.weapon] ?? 0) <= 0) {
    g.popup('NO AMMO — buy more at Ironworks Arms');
    p.fireT = 0.4;
    return;
  }
  p.ammo[p.weapon] -= 1;
  const n = w.pellets ?? 1;
  for (let i = 0; i < n; i++) {
    const spread = (Math.random() - 0.5) * (n > 1 ? 0.24 : 0.05);
    g.playerBullets.push({
      x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a + spread) * w.speed, vy: Math.sin(a + spread) * w.speed,
      dmg: w.dmg, life: w.range / w.speed,
    });
  }
  burst(g.particles, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, 3, '#ffd76a', 120, 0.15);
  g.audio.shot();
}

export function damageEnemy(g, e, dmg) {
  if (!e.alive) return;
  e.hp -= dmg;
  burst(g.particles, e.x, e.y, 5, '#ff5a4a', 140, 0.35);
  if (e.hp <= 0) {
    e.alive = false;
    g.money += e.boss ? 400 : 60 + Math.floor(Math.random() * 60);
    g.kills = (g.kills || 0) + 1;
    g.pickups.push({ x: e.x, y: e.y, kind: Math.random() < 0.5 ? 'cash' : 'ammo', t: 20 });
    if (e.boss) g.popup('ROOK IS DOWN');
  }
}

export function updateBullets(g, dt) {
  for (const b of [...g.playerBullets, ...g.enemyBullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Targets first: a foe standing at a wall's edge is still hittable.
    if (b.from === 'enemy') {
      const p = g.player;
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 16) {
        b.life = 0;
        hurtPlayer(g, ENEMY_DMG);
        burst(g.particles, p.x, p.y, 4, '#ff5a4a', 120, 0.3);
      }
      if (b.life <= 0) continue;
    } else {
      let hit = false;
      for (const e of g.enemies) {
        if (e.alive && dist(b.x, b.y, e.x, e.y) < 18) {
          b.life = 0;
          damageEnemy(g, e, b.dmg);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const c of g.cruisers) {
          if (dist(b.x, b.y, c.x, c.y) < 24) {
            b.life = 0;
            c.cond -= b.dmg;
            burst(g.particles, c.x, c.y, 4, '#ffb84a', 120, 0.3);
            hit = true;
            break;
          }
        }
      }
      if (hit) continue;
    }
    // Bullets stop at walls.
    if (hitsSolid(b.x, b.y, 2)) { b.life = 0; burst(g.particles, b.x, b.y, 3, '#c8c8c8', 90, 0.2); continue; }
  }
  g.playerBullets = g.playerBullets.filter((b) => b.life > 0);
  g.enemyBullets = g.enemyBullets.filter((b) => b.life > 0);
}

export function updatePickups(g, dt) {
  const p = g.player;
  for (const pk of g.pickups) {
    pk.t -= dt;
    if (dist(p.x, p.y, pk.x, pk.y) < 26) {
      pk.t = 0;
      if (pk.kind === 'cash') { g.money += 50; g.popup('+$50'); }
      else if (pk.kind === 'ammo') { p.ammo.pistol += 30; p.ammo.smg += 30; g.popup('+AMMO'); }
      else if (pk.kind === 'health') { p.hp = Math.min(100, p.hp + 40); g.popup('+40 HP'); }
      else if (pk.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); g.popup('+ARMOR'); }
      g.audio.pickup();
    }
  }
  g.pickups = g.pickups.filter((pk) => pk.t > 0);
}

export function cycleWeapon(g, dir = 1) {
  const owned = ['fists', 'pistol'];
  if (g.owned.smg) owned.push('smg');
  if (g.owned.shotgun) owned.push('shotgun');
  const i = owned.indexOf(g.player.weapon);
  g.player.weapon = owned[(i + dir + owned.length) % owned.length];
}
