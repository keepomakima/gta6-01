// NEON TIDE — combat.js
// Bullets: flight, building and car hits, and damage to whoever they touch.
// Fists and the pistol trigger live in entities.js; this file moves the lead.

import { dist } from './random.js';
import { hitBuilding } from './world.js';
import { damageTarget, explodeCar } from './entities.js';
import { damagePlayer } from './police.js';
import { burst } from './particles.js';

// Step every bullet. Returns nothing; bullets mutate the world as they fly.
export function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // Buildings stop bullets.
    if (!dead && hitBuilding(G.world, b.x, b.y, 2)) {
      burst(G, b.x, b.y, { count: 3, speedMin: 30, speedMax: 90, life: 0.2, size: 2, color: '#cfcfcf' });
      dead = true;
    }
    // Cars take bullet damage and can be blown up.
    if (!dead) {
      for (const car of G.cars) {
        if (car.hp <= 0) continue;
        if (Math.abs(b.x - car.x) < car.len / 2 && Math.abs(b.y - car.y) < car.wid / 2) {
          car.hp -= b.damage;
          burst(G, b.x, b.y, { count: 4, speedMin: 40, speedMax: 120, life: 0.25, size: 2, color: '#ffb347' });
          if (car.hp <= 0 && car.driver === 'player') {
            explodeCar(G, car);
            p.inCar = null;
          } else if (car.hp <= 0) {
            explodeCar(G, car);
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.fromPlayer) {
      // Player bullets hit enemies, cops and peds.
      const targets = [...G.enemies, ...G.cops, ...G.peds];
      for (const t of targets) {
        if (t.hp <= 0) continue;
        if (dist(b.x, b.y, t.x, t.y) < 14) {
          damageTarget(G, t, b.damage, 'bullet');
          dead = true;
          break;
        }
      }
    } else if (!dead && !b.fromPlayer) {
      // Enemy bullets hit the player (or the player's car).
      if (p.inCar) {
        const car = G.cars.find((c) => c.id === p.inCar);
        if (car && Math.abs(b.x - car.x) < car.len / 2 && Math.abs(b.y - car.y) < car.wid / 2) {
          car.hp -= b.damage;
          if (car.hp <= 0) {
            explodeCar(G, car);
            p.inCar = null;
          }
          dead = true;
        }
      } else if (dist(b.x, b.y, p.x, p.y) < 13) {
        damagePlayer(G, b.damage, 'shot');
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  // A gunshot recently fired makes nearby peds nervous.
  G.recentShot = G.bullets.some((b) => b.fromPlayer);
}

// Is the player aiming at something shootable? Used for the crosshair.
export function aimTarget(G) {
  const p = G.player;
  if (p.weapon !== 'pistol') return null;
  const a = p.aimAngle ?? p.angle;
  let best = null;
  let bestD = 520;
  const targets = [...G.enemies, ...G.cops, ...G.peds];
  for (const t of targets) {
    if (t.hp <= 0) continue;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > bestD) continue;
    const ang = Math.atan2(dy, dx);
    let diff = ang - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.12) {
      best = t;
      bestD = d;
    }
  }
  return best;
}
