// NEON TIDE v7 "Golden Hour" — particles.js
export function createParticles() {
  return { list: [], marks: [], shake: 0 };
}

export function spawnParticle(S, x, z, opts = {}) {
  const P = S.particles;
  if (P.list.length > 400) P.list.shift();
  P.list.push({
    x, z, y: opts.y ?? 0.6,
    vx: opts.vx ?? (Math.random() - 0.5) * 8,
    vy: opts.vy ?? Math.random() * 6,
    vz: opts.vz ?? (Math.random() - 0.5) * 8,
    life: opts.life ?? 0.6, maxLife: opts.life ?? 0.6,
    color: opts.color ?? 0xffaa33, size: opts.size ?? 1,
  });
}

export function spawnCrash(S, x, z) {
  for (let i = 0; i < 14; i++) spawnParticle(S, x, z, { color: 0xffcc44, life: 0.5 });
  S.particles.shake = Math.max(S.particles.shake, 0.4);
}

export function spawnMuzzle(S, x, z) {
  spawnParticle(S, x, z, { color: 0xffe066, life: 0.12, size: 2 });
}

export function addTireMark(S, x, z) {
  const M = S.particles.marks;
  if (M.length > 240) M.shift();
  M.push({ x, z, until: S.time + 6 });
}

export function updateParticles(S, dt) {
  const P = S.particles;
  for (const p of P.list) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 9 * dt;
  }
  P.list = P.list.filter((p) => p.life > 0);
  P.marks = P.marks.filter((m) => S.time < m.until);
  P.shake = Math.max(0, P.shake - dt * 1.4);
  S.shake = P.shake;
}

export function exhaustTick(S, dt) {
  const P = S.player;
  if (P.car && Math.abs(P.car.speed) > 30 && Math.random() < dt * 20) {
    const bx = P.car.x - Math.sin(P.car.heading) * 2.4;
    const bz = P.car.z - Math.cos(P.car.heading) * 2.4;
    spawnParticle(S, bx, bz, { color: 0x888888, life: 0.5, size: 0.8, vy: 2 });
  }
  if (S.nosFlame && P.car) {
    const bx = P.car.x - Math.sin(P.car.heading) * 2.6;
    const bz = P.car.z - Math.cos(P.car.heading) * 2.6;
    spawnParticle(S, bx, bz, { color: 0x3399ff, life: 0.3, size: 1.4, vy: 1 });
  }
}
