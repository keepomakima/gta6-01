// NEON TIDE v7 "Golden Hour" — combat.js
import { WEAPONS } from './config.js';
import { scarePeds } from './traffic.js';

export function fireWeapon(S) {
  const P = S.player;
  const w = WEAPONS[P.weapon];
  if (S.time - P.lastShotAt < w.cooldown) return false;
  if (P.ammo[P.weapon] !== undefined && P.ammo[P.weapon] <= 0) return false;
  P.lastShotAt = S.time;
  if (P.ammo[P.weapon] !== undefined) P.ammo[P.weapon] -= 1;
  scarePeds(S, P.x, P.z, 120);
  const aim = S.aimHeading ?? P.heading;
  let best = null, bestD = w.range;
  for (const e of S.enemies) {
    const dx = e.x - P.x, dz = e.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const ang = Math.atan2(dx, dz);
    let diff = Math.abs(ang - aim);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.35 && d < bestD) { best = e; bestD = d; }
  }
  if (best) {
    hurtEnemy(S, best, w.dmg);
    S.muzzle = { x: P.x, z: P.z, until: S.time + 0.08 };
  }
  S.shotsFired = (S.shotsFired || 0) + 1;
  return true;
}

export function hurtEnemy(S, enemy, dmg) {
  enemy.hp -= dmg;
  enemy.lastHitAt = S.time;
  if (enemy.hp <= 0 && enemy.kind === 'boss') {
    S.flash = `${enemy.name} is down!`;
  }
}

export function updateEnemies(S, dt) {
  const P = S.player;
  for (const e of S.enemies) {
    if (e.hp <= 0) continue;
    const dx = P.x - e.x, dz = P.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    const hold = e.kind !== 'boss' && d > 320 && !e.aggro;
    if (d < 320) e.aggro = true;
    if (e.kind === 'sentry') {
      e.shootTimer -= dt;
      if (d < 55 && e.shootTimer <= 0) {
        e.shootTimer = e.shootEvery;
        P.health -= e.dmg;
        P.lastDamageAt = S.time;
      }
      continue;
    }
    if (hold) continue;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - e.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    e.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
    const speed = d > 12 ? e.speed : 0;
    e.x += Math.sin(e.heading) * speed * dt;
    e.z += Math.cos(e.heading) * speed * dt;
    const c = S.world.collideCircle(e.x, e.z, 2);
    e.x = c.x; e.z = c.z;
    e.shootTimer -= dt;
    if (d < 95 && e.shootTimer <= 0) {
      e.shootTimer = e.shootEvery;
      const dmg = e.dmg;
      if (P.armor > 0) { P.armor = Math.max(0, P.armor - dmg); }
      else P.health -= dmg;
      P.lastDamageAt = S.time;
    }
  }
  S.enemies = S.enemies.filter((e) => e.hp > 0);
}

export function inVisionCone(e, x, z) {
  const dx = x - e.x, dz = z - e.z;
  const d = Math.hypot(dx, dz);
  if (d > e.coneLen) return false;
  const ang = Math.atan2(dx, dz);
  let diff = Math.abs(ang - e.coneDir);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff < e.coneHalf;
}

export function punch(S) {
  const P = S.player;
  if (S.time - P.lastShotAt < 0.45) return false;
  P.lastShotAt = S.time;
  for (const e of S.enemies) {
    if (Math.hypot(e.x - P.x, e.z - P.z) < 7) hurtEnemy(S, e, 12);
  }
  return true;
}
