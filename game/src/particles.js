// NEON TIDE — particles.js
// Exhaust puffs, muzzle flashes, crash sparks, pickup sparkles, skid marks
// and screen shake. Particles are pooled in plain arrays on the game state.

import { randRange } from './random.js';

// Spawn a burst of particles at (x, y).
export function burst(G, x, y, opts) {
  const n = opts.count || 10;
  for (let i = 0; i < n; i += 1) {
    const a = randRange(G.rng, 0, Math.PI * 2);
    const sp = randRange(G.rng, opts.speedMin ?? 40, opts.speedMax ?? 160);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: randRange(G.rng, 0.25, opts.life ?? 0.6),
      maxLife: opts.life ?? 0.6,
      size: randRange(G.rng, 2, opts.size ?? 4),
      color: opts.color || '#ffcf5a',
      gravity: opts.gravity || 0,
      fade: true,
    });
  }
}

export function exhaust(G, x, y, angle) {
  G.particles.push({
    x: x - Math.cos(angle) * 22,
    y: y - Math.sin(angle) * 22,
    vx: -Math.cos(angle) * 30 + randRange(G.rng, -8, 8),
    vy: -Math.sin(angle) * 30 + randRange(G.rng, -8, 8),
    life: 0.5, maxLife: 0.5,
    size: randRange(G.rng, 3, 6),
    color: 'rgba(120,120,120,0.5)',
    gravity: 0, fade: true,
  });
}

export function smoke(G, x, y) {
  G.particles.push({
    x: x + randRange(G.rng, -6, 6),
    y: y + randRange(G.rng, -6, 6),
    vx: randRange(G.rng, -10, 10),
    vy: randRange(G.rng, -30, -14),
    life: 0.9, maxLife: 0.9,
    size: randRange(G.rng, 5, 9),
    color: 'rgba(60,60,60,0.55)',
    gravity: 0, fade: true,
  });
}

export function muzzle(G, x, y, angle) {
  burst(G, x, y, { count: 6, speedMin: 120, speedMax: 260, life: 0.12, size: 3, color: '#ffe27a' });
  G.flash = { x, y, angle, t: 0.06 };
}

// An expanding shockwave ring, for explosions and mission completions.
export function ring(G, x, y, color) {
  G.particles.push({
    x, y, vx: 0, vy: 0,
    life: 0.5, maxLife: 0.5,
    size: 8, color: color || '#ffd75a',
    gravity: 0, fade: true, ring: true,
  });
}

// Leave a skid mark segment behind a drifting car.
export function addSkid(G, x, y, angle) {
  G.marks.push({ x, y, angle, life: 6 });
  if (G.marks.length > 400) G.marks.splice(0, G.marks.length - 400);
}

export function shake(G, amount) {
  G.shake = Math.min(14, (G.shake || 0) + amount);
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      G.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
  }
  for (let i = G.marks.length - 1; i >= 0; i -= 1) {
    G.marks[i].life -= dt;
    if (G.marks[i].life <= 0) G.marks.splice(i, 1);
  }
  if (G.flash) {
    G.flash.t -= dt;
    if (G.flash.t <= 0) G.flash = null;
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
}

export function drawParticles(ctx, G) {
  for (const p of G.particles) {
    const a = p.fade ? Math.max(0, p.life / p.maxLife) : 1;
    if (p.ring) {
      // Shockwave ring: grows as it fades.
      const progress = 1 - p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 + progress * 90, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
