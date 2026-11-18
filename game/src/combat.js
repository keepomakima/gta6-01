// NEON TIDE v5 — combat.js
// Combat: tinju jarak dekat, pistol / SMG / shotgun dengan aim mouse, ammo,
// musuh menembak balik, musuh mati menjatuhkan uang / ammo / armor, dan
// tembakan musuh ke mobil pemain. Sentry stealth (misi 14) tidak mengejar —
// mereka patroli dan mendeteksi lewat cone penglihatan. Damage ke pemain
// tinggal di police.js. Ditulis fresh untuk v5.
// Revisi v5.2: sentrySees diekspor untuk missions.js (meter deteksi) dan render.js (cone).
import { WEAPONS } from './config.js';
import { dist } from './random.js';
import { makePickup } from './entities.js';
import { damagePlayer, raiseWanted } from './police.js';

export function makeCombat() {
  return { bullets: [], shotsFiredT: 0, muzzleT: 0 };
}

// Tembak dari pemain ke arah aim mouse. Dipanggil saat klik / tahan.
export function playerShoot(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (!w || p.fireT > 0) return;
  if (p.inCar) return; // tidak bisa menembak dari dalam mobil
  if (p.weapon !== 'fists') {
    if ((p.ammo[p.weapon] || 0) <= 0) {
      G.audio.sfx('empty');
      p.fireT = 0.3;
      return;
    }
    p.ammo[p.weapon] -= 1;
  }
  p.fireT = 1 / w.rate;
  const aim = G.input.aimAngle(G.cam, p.x, p.y);
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = pellets > 1 ? (Math.random() - 0.5) * 0.22 : (Math.random() - 0.5) * 0.03;
    G.combat.bullets.push({
      x: p.x + Math.cos(aim) * 22, y: p.y + Math.sin(aim) * 22,
      vx: Math.cos(aim + spread) * 950, vy: Math.sin(aim + spread) * 950,
      dmg: w.dmg, from: 'player', life: w.range / 950,
    });
  }
  G.combat.muzzleT = 0.06;
  G.combat.shotsFiredT = 1.2;
  G.audio.sfx('shot');
  G.shake = Math.min(8, G.shake + 1.5);
}

// Pukulan tinju: musuh dalam 42px kena damage. Pukulan ke polisi juga
// menaikkan wanted — memukul aparat selalu ada konsekuensinya.
export function playerPunch(G) {
  const p = G.player;
  if (p.fireT > 0 || p.inCar) return;
  p.fireT = 1 / WEAPONS.fists.rate;
  const aim = G.input.aimAngle(G.cam, p.x, p.y);
  const hx = p.x + Math.cos(aim) * 34;
  const hy = p.y + Math.sin(aim) * 34;
  for (const e of G.enemies) {
    if (e.alive && dist(hx, hy, e.x, e.y) < 40) hurtEnemy(G, e, WEAPONS.fists.dmg);
  }
  for (const cop of G.police) {
    if (cop.kind === 'cop' && dist(hx, hy, cop.x, cop.y) < 40) {
      raiseWanted(G, 1, 'memukul polisi');
      cop.x += Math.cos(aim) * 30; cop.y += Math.sin(aim) * 30;
    }
  }
  G.audio.sfx('punch');
}

// Musuh menembak target (pemain jalan kaki atau mobilnya).
export function enemyShoot(G, enemy, target) {
  const isCar = !!target.type;
  const tx = target.x, ty = target.y;
  const aim = Math.atan2(ty - enemy.y, tx - enemy.x) + (Math.random() - 0.5) * 0.3;
  G.combat.bullets.push({
    x: enemy.x + Math.cos(aim) * 20, y: enemy.y + Math.sin(aim) * 20,
    vx: Math.cos(aim) * 700, vy: Math.sin(aim) * 700,
    dmg: 5, from: 'enemy', life: 0.9,
  });
  G.audio.sfx('shotFar');
}

// Update peluru: gerak, tabrak musuh / pemain / gedung.
export function updateBullets(G, dt) {
  const p = G.player;
  for (const b of G.combat.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (b.from === 'player') {
      for (const e of G.enemies) {
        if (e.alive && dist(b.x, b.y, e.x, e.y) < 20) {
          hurtEnemy(G, e, b.dmg);
          b.dead = true;
          G.particles.burst(b.x, b.y, 'spark', 4);
          break;
        }
      }
      if (!b.dead) {
        for (const cop of G.police) {
          if (cop.kind === 'cop' && dist(b.x, b.y, cop.x, cop.y) < 18) {
            raiseWanted(G, 1, 'menembak polisi');
            b.dead = true;
            break;
          }
        }
      }
    } else {
      // Peluru musuh: kena pemain jalan kaki, atau mobil pemain.
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 16) {
        damagePlayer(G, b.dmg, 'enemy');
        b.dead = true;
      } else if (p.inCar && dist(b.x, b.y, p.inCar.x, p.inCar.y) < 26) {
        p.inCar.cond = Math.max(0, p.inCar.cond - 2);
        G.particles.burst(b.x, b.y, 'spark', 3);
        b.dead = true;
      }
    }
  }
  G.combat.bullets = G.combat.bullets.filter((b) => !b.dead);
  G.combat.shotsFiredT = Math.max(0, G.combat.shotsFiredT - dt);
  G.combat.muzzleT = Math.max(0, G.combat.muzzleT - dt);
}

function hurtEnemy(G, e, dmg) {
  e.hp -= dmg;
  G.particles.burst(e.x, e.y, 'blood', 5);
  if (e.hp <= 0 && e.alive) {
    e.alive = false;
    G.player.respect = Math.min(100, G.player.respect + 2);
    // Drop: uang selalu, ammo / armor kadang-kadang.
    const cash = e.boss ? 800 : 40 + Math.floor(Math.random() * 80);
    G.pickups.push(makePickup(e.x, e.y, 'cash', cash));
    if (Math.random() < 0.6) G.pickups.push(makePickup(e.x + 14, e.y, 'ammo', 24));
    if (Math.random() < 0.35) G.pickups.push(makePickup(e.x - 14, e.y, 'armor', 25));
    G.audio.sfx('kill');
    if (e.boss) G.dialog = { name: 'Boss Rook', role: 'Geng Tide Rats', text: 'Tidak... pelabuhan ini... milikku...', t: 0 };
  }
}

// Apakah sentry melihat pemain? Di dalam cone (jarak + sudut pandang).
export function sentrySees(sentry, px, py) {
  const d = dist(sentry.x, sentry.y, px, py);
  if (d > sentry.coneR) return false;
  const want = Math.atan2(py - sentry.y, px - sentry.x);
  let da = want - sentry.faceA;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) < 0.55;
}

// Update musuh: kejar pemain bila dekat, tembak bila dalam jarak.
// Sentry (misi 14) tidak mengejar: patroli memutar arah pandang.
export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    if (e.sentry) {
      e.faceA += dt * 0.5; // patroli: sapu pandangan perlahan
      e.angle = e.faceA;
      continue;
    }
    const d = dist(e.x, e.y, p.x, p.y);
    e.fireT -= dt;
    if (d < 520) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = a;
      if (d > 180) {
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
      }
      if (d < 420 && e.fireT <= 0) {
        e.fireT = e.boss ? 1.1 : 1.6;
        enemyShoot(G, e, p.inCar || p);
      }
    } else {
      // Berkeliaran di sekitar titik spawn.
      e.wanderA += (Math.random() - 0.5) * dt * 2;
      e.x += Math.cos(e.wanderA) * 30 * dt;
      e.y += Math.sin(e.wanderA) * 30 * dt;
    }
    // Musuh menyentuh pemain jalan kaki -> damage jarak dekat.
    if (!p.inCar && d < 26 && p.hurtT <= 0) damagePlayer(G, 10, 'enemy');
    // Musuh selalu di dalam dunia (jangan sampai keluar peta saat mengejar).
    e.x = Math.max(20, Math.min(2380, e.x));
    e.y = Math.max(20, Math.min(1580, e.y));
  }
}

// Pickup: uang / ammo / armor diambil saat pemain dekat.
export function updatePickups(G, dt) {
  const p = G.player;
  for (const pk of G.pickups) {
    pk.t += dt;
    if (dist(pk.x, pk.y, p.x, p.y) < 30) {
      if (pk.pkind === 'cash') { p.money += pk.amount; G.audio.sfx('pickup'); }
      if (pk.pkind === 'ammo') { p.ammo.pistol += pk.amount; p.ammo.smg += pk.amount; G.audio.sfx('pickup'); }
      if (pk.pkind === 'armor') { p.armor = Math.min(100, p.armor + pk.amount); G.audio.sfx('pickup'); }
      pk.dead = true;
    }
  }
  G.pickups = G.pickups.filter((k) => !k.dead && k.t < 45);
}
