// NEON TIDE v6-rebuild-2 — combat.js
// Player shooting (mouse aim, weapon cooldown + ammo), enemy AI and damage.
// KILL COUNTING: hurtEnemy never increments any kill counter. The kill hook
// lives in main.js updateWorld: it counts enemies at the start of the frame
// versus the end, so a kill is only counted when an enemy actually leaves
// the world (an earlier build counted in hurtEnemy's splice path and the
// counter never moved because updateEnemies owned the removal).
import { WEAPONS } from './config.js';
import { scarePeds } from './traffic.js';
import { addWanted } from './police.js';

export function fireWeapon(S) {
  const P = S.player;
  const w = WEAPONS[P.weapon];
  if (S.time - P.lastShotAt < w.cooldown) return false;
  if (P.ammo[P.weapon] !== undefined && P.ammo[P.weapon] <= 0) return false;
  P.lastShotAt = S.time;
  if (P.ammo[P.weapon] !== undefined) P.ammo[P.weapon] -= 1;
  scarePeds(S, P.x, P.z, 120);
  // Aim: mouse direction on screen maps to a world heading from the camera.
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

// Damage an enemy. Removal happens in updateEnemies (hp <= 0 -> splice);
// the kill hook in main.js counts the removal.
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
    // Non-boss enemies hold their post when the player is far away (>320).
    const hold = e.kind !== 'boss' && d > 320 && !e.aggro;
    if (d < 320) e.aggro = true;
    if (e.kind === 'sentry') {
      // Sentries stand still and watch their cone; they shoot only when
      // the player is inside the cone and close.
      e.shootTimer -= dt;
      if (d < 55 && e.shootTimer <= 0) {
        e.shootTimer = e.shootEvery;
        P.health -= e.dmg;
        P.lastDamageAt = S.time;
      }
      continue;
    }
    if (hold) continue;
    // Chase the player, keep a little distance, shoot on a timer.
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
      const dmg = e.kind === 'boss' ? e.dmg : e.dmg;
      if (P.armor > 0) { P.armor = Math.max(0, P.armor - dmg); }
      else P.health -= dmg;
      P.lastDamageAt = S.time;
    }
  }
  // Removal (and only removal) is where kills are realised.
  S.enemies = S.enemies.filter((e) => e.hp > 0);
}

// Vision cone test for stealth (M14): is the player inside a sentry's cone?
export function inVisionCone(e, x, z) {
  const dx = x - e.x, dz = z - e.z;
  const d = Math.hypot(dx, dz);
  if (d > e.coneLen) return false;
  const ang = Math.atan2(dx, dz);
  let diff = Math.abs(ang - e.coneDir);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff < e.coneHalf;
}

// Melee punch: short range, no ammo, used when the player has no weapon out.
export function punch(S) {
  const P = S.player;
  if (S.time - P.lastShotAt < 0.45) return false;
  P.lastShotAt = S.time;
  for (const e of S.enemies) {
    if (Math.hypot(e.x - P.x, e.z - P.z) < 7) hurtEnemy(S, e, 12);
  }
  return true;
}
