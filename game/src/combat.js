// NEON TIDE v4 — combat: fists, guns, rival gang enemies, drops, bullets.
// One job: everything that hurts someone and everything it leaves behind.
import { WEAPONS } from './config.js';
import { damagePlayer, addWanted } from './police.js';

export function makeEnemy(x, y, opts = {}) {
  return {
    x, y, angle: 0, hp: opts.hp ?? 60, speed: 105,
    weapon: opts.weapon ?? 'pistol', shootCd: 1 + Math.random(),
    state: 'guard', tx: x, ty: y, name: opts.name ?? 'Rival',
    alive: true, dropCash: opts.dropCash ?? 120,
  };
}

export function spawnGang(G, x, y, count, opts = {}) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const e = makeEnemy(x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160, opts);
    G.enemies.push(e);
    out.push(e);
  }
  return out;
}

export function playerPunch(G) {
  const p = G.player;
  if (p.punchCd > 0 || p.inCar) return;
  p.punchCd = 0.45;
  G.audio.sfx('punch');
  const reach = 52;
  const hx = p.x + Math.cos(p.angle) * reach;
  const hy = p.y + Math.sin(p.angle) * reach;
  let hit = false;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - hx, e.y - hy) < 40) {
      e.hp -= WEAPONS.fists.dmg;
      G.particles.blood(e.x, e.y);
      hit = true;
      if (e.hp <= 0) killEnemy(G, e);
    }
  }
  for (const cop of G.cops) {
    if (Math.hypot(cop.x - hx, cop.y - hy) < 40) {
      cop.hp -= WEAPONS.fists.dmg;
      G.particles.blood(cop.x, cop.y);
      hit = true;
      addWanted(G, 1);
      if (cop.hp <= 0) { cop.hp = 0; G.cops.splice(G.cops.indexOf(cop), 1); addWanted(G, 1); }
    }
  }
  if (hit) G.combatNoise = 1.5;
}

export function playerShoot(G, targetX, targetY) {
  const p = G.player;
  if (p.inCar || p.fireCd > 0) return;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 'fists') { playerPunch(G); return; }
  if ((p.ammo[p.weapon] ?? 0) <= 0) {
    p.fireCd = 0.3;
    G.particles.popup(p.x, p.y - 30, 'NO AMMO — BUY AT IRONWORKS', '#ff5d5d');
    return;
  }
  p.fireCd = 1 / w.rate;
  p.ammo[p.weapon] -= 1;
  const spread = p.weapon === 'shotgun' ? 0.16 : 0.03;
  const base = Math.atan2(targetY - p.y, targetX - p.x);
  const pellets = p.weapon === 'shotgun' ? 5 : 1;
  for (let i = 0; i < pellets; i += 1) {
    const a = base + (Math.random() - 0.5) * spread;
    G.bullets.push({
      x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * 900, vy: Math.sin(a) * 900,
      life: w.range / 900, dmg: w.dmg, fromPlayer: true,
    });
  }
  G.particles.muzzle(p.x + Math.cos(base) * 22, p.y + Math.sin(base) * 22, base);
  G.audio.sfx('shot');
  G.combatNoise = 2.5;
  G.shake = Math.max(G.shake, 1.5);
}

export function killEnemy(G, e) {
  e.alive = false;
  G.player.kills += 1;
  G.player.money += e.dropCash;
  G.particles.cashBurst(e.x, e.y);
  G.particles.popup(e.x, e.y - 24, `+$${e.dropCash}`, '#7dff8a');
  // Drops: mostly ammo or cash, sometimes a kevlar scrap (+25 armor).
  const roll = Math.random();
  const kind = roll < 0.4 ? 'ammo' : (roll < 0.9 ? 'cash' : 'armor');
  G.drops.push({ x: e.x, y: e.y, kind, amount: e.dropCash, t: 20 });
  G.audio.sfx('cash');
  addWanted(G, 0);
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.fromPlayer) {
      for (const e of G.enemies) {
        if (e.alive && Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.hp -= b.dmg;
          G.particles.blood(e.x, e.y);
          b.life = 0;
          if (e.hp <= 0) killEnemy(G, e);
          break;
        }
      }
      for (const cop of G.cops) {
        if (b.life > 0 && Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
          cop.hp -= b.dmg;
          G.particles.blood(cop.x, cop.y);
          b.life = 0;
          if (cop.hp <= 0) { G.cops.splice(G.cops.indexOf(cop), 1); addWanted(G, 1); }
          break;
        }
      }
    } else if (Math.hypot(G.player.x - b.x, G.player.y - b.y) < 15) {
      damagePlayer(G, b.dmg * 0.5, 'bullet');
      b.life = 0;
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d < 420) {
      e.state = 'attack';
      if (d > 130) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      }
      e.shootCd -= dt;
      if (d < 360 && e.shootCd <= 0) {
        e.shootCd = 1.4 + Math.random() * 0.8;
        G.bullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(e.angle) * 620, vy: Math.sin(e.angle) * 620,
          life: 0.7, dmg: 12, fromPlayer: false,
        });
        G.particles.muzzle(e.x, e.y, e.angle);
        G.audio.sfx('shot');
      }
    } else {
      e.state = 'guard';
    }
  }
  G.enemies = G.enemies.filter((e) => e.alive || Math.random() < 0.02);
  // Drops: walk over to collect.
  for (const d of G.drops) {
    d.t -= dt;
    if (Math.hypot(p.x - d.x, p.y - d.y) < 26) {
      if (d.kind === 'ammo') {
        p.ammo[p.weapon] = (p.ammo[p.weapon] ?? 0) + 24;
        G.particles.popup(p.x, p.y - 26, '+24 AMMO', '#ffd166');
      } else if (d.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 25);
        G.particles.popup(p.x, p.y - 26, '+25 ARMOR', '#39c6ff');
      } else {
        p.money += 50;
        G.particles.popup(p.x, p.y - 26, '+$50', '#7dff8a');
      }
      G.audio.sfx('pickup');
      d.t = 0;
    }
  }
  G.drops = G.drops.filter((d) => d.t > 0);
}
