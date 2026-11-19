// NEON TIDE v7-coverfix — combat.js (structural pass)
// Shooting, melee and the enemies that shoot back. Fire picks the nearest
// enemy inside a narrow cone around the aim heading; enemies hold their
// ground until Deke comes close, then close in and shoot.
import { WEAPONS } from './config.js';
import { scarePeds } from './traffic.js';

// Smallest absolute angle between two headings, 0..PI.
function angleDiff(a, b) {
  const raw = Math.abs(a - b);
  return raw > Math.PI ? Math.PI * 2 - raw : raw;
}

export function hurtEnemy(S, enemy, dmg) {
  enemy.hp -= dmg;
  enemy.lastHitAt = S.time;
  if (enemy.hp <= 0) {
    if (enemy.kind === 'boss') S.flash = `${enemy.name} is down!`;
  }
}

export function fireWeapon(S) {
  const P = S.player;
  const w = WEAPONS[P.weapon];
  if (S.time - P.lastShotAt < w.cooldown) return false;
  if (P.ammo[P.weapon] !== undefined) {
    if (P.ammo[P.weapon] <= 0) return false;
  }
  P.lastShotAt = S.time;
  if (P.ammo[P.weapon] !== undefined) P.ammo[P.weapon] -= 1;
  scarePeds(S, P.x, P.z, 120);
  const aim = S.aimHeading !== undefined && S.aimHeading !== null ? S.aimHeading : P.heading;
  let best = null, bestD = w.range;
  S.enemies.forEach((e) => {
    const dx = e.x - P.x, dz = e.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range) return;
    const ang = Math.atan2(dx, dz);
    if (angleDiff(ang, aim) < 0.35 && d < bestD) { best = e; bestD = d; }
  });
  if (best) {
    hurtEnemy(S, best, w.dmg);
    S.muzzle = { until: S.time + 0.08, x: P.x, z: P.z };
  }
  S.shotsFired = S.shotsFired ? S.shotsFired + 1 : 1;
  return true;
}

export function punch(S) {
  const P = S.player;
  if (S.time - P.lastShotAt < 0.45) return false;
  P.lastShotAt = S.time;
  S.enemies.forEach((e) => {
    if (Math.hypot(e.x - P.x, e.z - P.z) < 7) hurtEnemy(S, e, 12);
  });
  return true;
}

export function updateEnemies(S, dt) {
  const P = S.player;
  S.enemies.forEach((e) => {
    if (e.hp <= 0) return;
    const dx = P.x - e.x, dz = P.z - e.z;
    let d = Math.hypot(dx, dz);
    if (!d) d = 1;
    const hold = e.kind !== 'boss' && d > 320 && !e.aggro;
    if (d < 320) e.aggro = true;
    if (e.kind === 'sentry') {
      e.shootTimer -= dt;
      if (d < 55 && e.shootTimer <= 0) {
        e.shootTimer = e.shootEvery;
        P.health -= e.dmg;
        P.lastDamageAt = S.time;
      }
      return;
    }
    if (hold) return;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - e.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    let turn = dh;
    if (turn > 3 * dt) turn = 3 * dt;
    if (turn < -3 * dt) turn = -3 * dt;
    e.heading += turn;
    let speed = 0;
    if (d > 12) speed = e.speed;
    e.x += Math.sin(e.heading) * speed * dt;
    e.z += Math.cos(e.heading) * speed * dt;
    const c = S.world.collideCircle(e.x, e.z, 2);
    e.x = c.x;
    e.z = c.z;
    e.shootTimer -= dt;
    if (d < 95 && e.shootTimer <= 0) {
      e.shootTimer = e.shootEvery;
      const dmg = e.dmg;
      if (P.armor > 0) {
        P.armor -= dmg;
        if (P.armor < 0) P.armor = 0;
      } else P.health -= dmg;
      P.lastDamageAt = S.time;
    }
  });
  S.enemies = S.enemies.filter((e) => e.hp > 0);
}

export function inVisionCone(e, x, z) {
  const dx = x - e.x, dz = z - e.z;
  const d = Math.hypot(dx, dz);
  return d <= e.coneLen && angleDiff(Math.atan2(dx, dz), e.coneDir) < e.coneHalf;
}
