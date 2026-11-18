// NEON TIDE v5 — particles: exhaust, muzzle flash, impacts, tyre smoke,
// skid marks and NOS blue flames. All cosmetic; the game never depends on
// them, so they can never break a mission.
export function makeParticles() {
  return { list: [], marks: [] };
}

export function spawn(p, x, y, opts = {}) {
  const q = {
    x, y,
    vx: opts.vx ?? 0, vy: opts.vy ?? 0,
    life: opts.life ?? 0.5, max: opts.life ?? 0.5,
    size: opts.size ?? 3, color: opts.color ?? '#ffcc66',
    grav: opts.grav ?? 0, drag: opts.drag ?? 0.98,
  };
  p.list.push(q);
  if (p.list.length > 400) p.list.splice(0, p.list.length - 400);
  return q;
}

export function burst(p, x, y, n, color, speed = 160, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    spawn(p, x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random()), color, size: 2 + Math.random() * 3 });
  }
}

export function addSkid(p, x, y, angle) {
  p.marks.push({ x, y, angle, life: 6 });
  if (p.marks.length > 220) p.marks.shift();
}

export function updateParticles(p, dt) {
  for (const q of p.list) {
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += q.grav * dt;
    q.vx *= q.drag; q.vy *= q.drag;
  }
  p.list = p.list.filter((q) => q.life > 0);
  for (const m of p.marks) m.life -= dt;
  p.marks = p.marks.filter((m) => m.life > 0);
}

export function drawParticles(ctx, p, cam) {
  for (const m of p.marks) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, m.life * 0.15);
    ctx.translate(m.x - cam.x, m.y - cam.y);
    ctx.rotate(m.angle);
    ctx.fillStyle = '#111';
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
  for (const q of p.list) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.beginPath();
    ctx.arc(q.x - cam.x, q.y - cam.y, q.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
