// NEON TIDE v7-coverfix — particles.js (structural pass)
// Lightweight particles: crash sparks, muzzle flashes, exhaust smoke and
// the blue NOS flame, plus fading tire marks. Capped lists so a long
// chase never grows the arrays without bound.
export function createParticles() {
  return { list: [], marks: [], shake: 0 };
}

export function spawnParticle(S, x, z, opts = {}) {
  const P = S.particles;
  while (P.list.length > 400) P.list.shift();
  P.list.push({
    x: x, z: z,
    y: opts.y !== undefined && opts.y !== null ? opts.y : 0.6,
    vx: opts.vx ?? (Math.random() - 0.5) * 8,
    vy: opts.vy ?? Math.random() * 6,
    vz: opts.vz ?? (Math.random() - 0.5) * 8,
    life: opts.life ?? 0.6,
    maxLife: opts.life ?? 0.6,
    color: opts.color ?? 0xffaa33,
    size: opts.size ?? 1,
  });
}

export function updateParticles(S, dt) {
  const P = S.particles;
  P.list.forEach((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 9 * dt;
  });
  P.list = P.list.filter((p) => p.life > 0);
  P.marks = P.marks.filter((m) => S.time < m.until);
  P.shake -= dt * 1.4;
  if (P.shake < 0) P.shake = 0;
  S.shake = P.shake;
}

export function spawnCrash(S, x, z) {
  let i = 0;
  while (i < 14) { spawnParticle(S, x, z, { color: 0xffcc44, life: 0.5 }); i += 1; }
  if (S.particles.shake < 0.4) S.particles.shake = 0.4;
}

export function spawnMuzzle(S, x, z) {
  spawnParticle(S, x, z, { color: 0xffe066, life: 0.12, size: 2 });
}

export function addTireMark(S, x, z) {
  const M = S.particles.marks;
  while (M.length > 240) M.shift();
  M.push({ x: x, z: z, until: S.time + 6 });
}

// One exhaust puff behind the car, at the given distance from its centre.
function tailPuff(S, car, back, color, life, size, vy) {
  const bx = car.x - Math.sin(car.heading) * back;
  const bz = car.z - Math.cos(car.heading) * back;
  spawnParticle(S, bx, bz, { color: color, life: life, size: size, vy: vy });
}

export function exhaustTick(S, dt) {
  const P = S.player;
  if (P.car) {
    if (Math.abs(P.car.speed) > 30 && Math.random() < dt * 20) {
      tailPuff(S, P.car, 2.4, 0x888888, 0.5, 0.8, 2);
    }
  }
  if (S.nosFlame && P.car) {
    tailPuff(S, P.car, 2.6, 0x3399ff, 0.3, 1.4, 1);
  }
}
