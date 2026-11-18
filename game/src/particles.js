// NEON TIDE v5 — particles.js
// Partikel: knalpot, muzzle flash, tabrakan (spark), asap kerusakan, darah,
// debu rotor wash, api NOS biru (baru v5), plus bekas ban (skid marks) yang
// memudar pelan. Ditulis fresh untuk v5.
// Revisi v5.2: nosflame hidup singkat (0.28 dtk) supaya api berkedip hidup.
export class Particles {
  constructor() {
    this.list = [];
    this.skids = [];
  }

  burst(x, y, kind, n = 6) {
    // Batas 500 partikel aktif supaya frame tidak tersendat di chase.
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'exhaust' ? 12 + Math.random() * 18 : 40 + Math.random() * 120;
      const life = kind === 'smoke' ? 1.4 : kind === 'dust' ? 0.9 : kind === 'nosflame' ? 0.28 : 0.45;
      this.list.push({
        x, y, kind,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life, maxLife: life,
        size: kind === 'smoke' ? 7 + Math.random() * 8 : kind === 'nosflame' ? 4 + Math.random() * 4 : 2 + Math.random() * 3,
      });
    }
    if (this.list.length > 500) this.list.splice(0, this.list.length - 500);
  }

  skid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 9 });
    if (this.skids.length > 240) this.skids.shift();
  }

  update(dt) {
    for (const pt of this.list) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - 2.2 * dt);
      pt.vy *= Math.max(0, 1 - 2.2 * dt);
      if (pt.kind === 'smoke' || pt.kind === 'dust') pt.vy -= 14 * dt;
      pt.life -= dt;
    }
    this.list = this.list.filter((pt) => pt.life > 0);
    for (const s of this.skids) s.life -= dt;
    this.skids = this.skids.filter((s) => s.life > 0);
  }

  // Gambar semua partikel + bekas ban (dipanggil render.js).
  draw(ctx, cam) {
    for (const s of this.skids) {
      ctx.save();
      ctx.translate(s.x - cam.x, s.y - cam.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = Math.min(0.5, s.life / 9 * 0.5);
      ctx.fillStyle = '#111';
      ctx.fillRect(-14, -3, 28, 6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const pt of this.list) {
      const a = Math.max(0, pt.life / pt.maxLife);
      const sx = pt.x - cam.x, sy = pt.y - cam.y;
      if (pt.kind === 'spark') { ctx.fillStyle = `rgba(255,210,80,${a})`; }
      else if (pt.kind === 'smoke') { ctx.fillStyle = `rgba(90,90,95,${a * 0.6})`; }
      else if (pt.kind === 'exhaust') { ctx.fillStyle = `rgba(180,180,190,${a * 0.5})`; }
      else if (pt.kind === 'blood') { ctx.fillStyle = `rgba(200,30,40,${a})`; }
      else if (pt.kind === 'nosflame') { ctx.fillStyle = `rgba(80,180,255,${a})`; }
      else { ctx.fillStyle = `rgba(210,190,150,${a * 0.5})`; } // dust
      ctx.beginPath();
      ctx.arc(sx, sy, pt.size * (pt.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
