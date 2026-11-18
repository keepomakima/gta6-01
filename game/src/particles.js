// NEON TIDE v4 — particles: sparks, smoke, muzzle flashes, tire marks, popups.
// One job: every transient visual effect the game spawns and draws.
export class Particles {
  constructor() {
    this.list = [];
    this.tireMarks = [];
    this.popups = [];
  }

  spawn(x, y, opts = {}) {
    const n = opts.n ?? 10;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 120) * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp + (opts.vx ?? 0),
        vy: Math.sin(a) * sp + (opts.vy ?? 0),
        life: opts.life ?? 0.6,
        maxLife: opts.life ?? 0.6,
        size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: opts.color ?? '#ffcc66',
        gravity: opts.gravity ?? 0,
        shrink: opts.shrink ?? true,
      });
    }
  }

  exhaust(x, y, angle) {
    this.list.push({
      x, y,
      vx: Math.cos(angle + Math.PI) * 40 + (Math.random() - 0.5) * 20,
      vy: Math.sin(angle + Math.PI) * 40 + (Math.random() - 0.5) * 20,
      life: 0.7, maxLife: 0.7, size: 5, color: '#9aa0a6', gravity: -12, shrink: true,
    });
  }

  smoke(x, y) { this.spawn(x, y, { n: 14, speed: 60, life: 1.4, size: 7, color: '#555a60' }); }
  sparks(x, y) { this.spawn(x, y, { n: 12, speed: 260, life: 0.35, size: 2.5, color: '#ffd166' }); }
  muzzle(x, y, angle) { this.spawn(x, y, { n: 6, speed: 200, life: 0.12, size: 4, color: '#ffe066' }); }
  blood(x, y) { this.spawn(x, y, { n: 8, speed: 90, life: 0.5, size: 3, color: '#c1121f' }); }
  cashBurst(x, y) { this.spawn(x, y, { n: 10, speed: 140, life: 0.8, size: 3.5, color: '#7dff8a' }); }
  confetti(x, y) {
    const colors = ['#ffd166', '#ff5d8f', '#39c6ff', '#7dff8a', '#ff7ad9'];
    for (let i = 0; i < 24; i += 1) {
      this.spawn(x, y, { n: 1, speed: 220, life: 1.1, size: 4, color: colors[i % colors.length], gravity: 160 });
    }
  }

  addTireMark(x, y, angle) {
    this.tireMarks.push({ x, y, angle, life: 6 });
    if (this.tireMarks.length > 220) this.tireMarks.shift();
  }

  popup(x, y, text, color = '#ffd166', big = false) {
    this.popups.push({ x, y, text, color, life: 1.6, maxLife: 1.6, big });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const m of this.tireMarks) m.life -= dt;
    this.tireMarks = this.tireMarks.filter((m) => m.life > 0);
    for (const p of this.popups) { p.life -= dt; p.y -= 34 * dt; }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  drawWorld(ctx, cam) {
    for (const m of this.tireMarks) {
      ctx.save();
      ctx.translate(m.x - cam.x, m.y - cam.y);
      ctx.rotate(m.angle);
      ctx.globalAlpha = Math.min(0.55, m.life * 0.2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.restore();
    }
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.shrink ? p.size * (0.4 + 0.6 * a) : p.size;
      ctx.fillRect(p.x - cam.x - s / 2, p.y - cam.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.font = p.big ? 'bold 22px Arial' : 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.strokeText(p.text, p.x - cam.x, p.y - cam.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x - cam.x, p.y - cam.y);
    }
    ctx.globalAlpha = 1;
  }
}
