// Particles and tire marks for NEON TIDE: exhaust puffs, muzzle flashes,
// crash sparks, blood-free impact bursts and skid marks that fade on the road.
export function createParticles() {
  const parts = [];
  const marks = [];

  function spawn(x, y, vx, vy, life, size, color) {
    parts.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }

  function burst(x, y, count, color, speed, life = 0.5, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.7), size * (0.7 + Math.random() * 0.6), color);
    }
  }

  function exhaust(x, y, angle) {
    spawn(x - Math.cos(angle) * 20, y - Math.sin(angle) * 20,
      -Math.cos(angle) * 30 + (Math.random() - 0.5) * 20,
      -Math.sin(angle) * 30 + (Math.random() - 0.5) * 20,
      0.7, 4, 'rgba(160,160,160,0.5)');
  }

  function muzzle(x, y, angle) {
    spawn(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, 0, 0, 0.08, 9, '#ffd94d');
    burst(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, 3, '#ff9a3d', 120, 0.15, 2);
  }

  function crash(x, y) {
    burst(x, y, 14, '#ffcf4d', 260, 0.5, 3);
    burst(x, y, 8, '#8a8f98', 140, 0.8, 4);
  }

  function smoke(x, y) {
    spawn(x, y, (Math.random() - 0.5) * 16, -30 - Math.random() * 20, 1.1, 7, 'rgba(60,60,60,0.45)');
  }

  function skid(x, y, angle) {
    marks.push({ x, y, angle, life: 6 });
    if (marks.length > 240) marks.shift();
  }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (let i = marks.length - 1; i >= 0; i -= 1) {
      marks[i].life -= dt;
      if (marks[i].life <= 0) marks.splice(i, 1);
    }
  }

  return { parts, marks, spawn, burst, exhaust, muzzle, crash, smoke, skid, update };
}
