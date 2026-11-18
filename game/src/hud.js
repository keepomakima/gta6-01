// NEON TIDE v6 — HUD (DOM) + minimap (2D canvas). Shows money, debt to
// Madame Kestrel, health/armor, wanted stars, weapon/ammo, clock, current
// objective, NOS gauge, speed and the district name; the minimap draws the
// road grid with blips for the player, mission target, police and cars.
import { fmtMoney } from './rng.js';
import { districtAt as districtAtCfg } from './config.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.map = this.el('minimap');
    this.mctx = this.map ? this.map.getContext('2d') : null;
    this.popupTimer = 0;
  }

  showPopup(text, ms = 2600) {
    const p = this.el('popup');
    if (!p) return;
    p.textContent = text;
    p.style.display = 'block';
    this.popupTimer = ms;
  }

  update(dt, g) {
    const s = g.state;
    const set = (id, v) => { const e = this.el(id); if (e) e.textContent = v; };
    set('money', fmtMoney(s.money));
    set('debt', 'Debt: ' + fmtMoney(s.debt));
    set('clock', g.weather.clockString());
    set('objective', g.missions.objective());
    const det = this.el('detection');
    if (det) {
      const show = g.missions.index === 13; // M14 Silent Pier
      det.style.display = show ? 'block' : 'none';
      const df = this.el('detection-fill');
      if (df) df.style.width = Math.max(0, Math.min(100, g.missions.detection)) + '%';
    }
    set('weapon', g.combat.weapon.toUpperCase());
    set('ammo', g.combat.weapon === 'fists' ? '—' : String(g.combat.ammo[g.combat.weapon]));
    set('district', districtAtCfg(g.player.x, g.player.z));
    const stars = '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
    const wEl = this.el('wanted');
    if (wEl) { wEl.textContent = stars; wEl.style.color = g.police.wanted >= 4 ? '#ff3344' : '#ffd34a'; }
    const hp = this.el('health-fill');
    if (hp) hp.style.width = Math.max(0, g.player.hp) + '%';
    const ar = this.el('armor-fill');
    if (ar) ar.style.width = Math.max(0, g.player.armor) + '%';
    const nos = this.el('nos-fill');
    const car = g.player.car;
    if (nos) nos.style.width = (car && car.nosMax > 0 ? (car.nos / car.nosMax) * 100 : 0) + '%';
    set('speed', car ? Math.round(Math.abs(car.speed) * 0.36) + ' km/h' : Math.round(g.player.speed * 0.36) + ' km/h');
    set('heat-score', g.heat.active ? `HEAT WAVE ${g.heat.score} — ${g.heat.time}s` : '');
    if (this.popupTimer > 0) {
      this.popupTimer -= dt * 1000;
      if (this.popupTimer <= 0) { const p = this.el('popup'); if (p) p.style.display = 'none'; }
    }
    this._drawMinimap(g);
  }

  _drawMinimap(g) {
    if (!this.mctx) return;
    const c = this.mctx, W = this.map.width, H = this.map.height;
    const sx = (x) => ((x + 1100) / 2200) * W;
    const sz = (z) => ((z + 750) / 1500) * H;
    c.fillStyle = '#101018'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#3a3a48'; c.lineWidth = 1;
    for (const x of [-1000, -800, -600, -400, -200, 0, 200, 400, 600, 800, 1000]) {
      c.beginPath(); c.moveTo(sx(x), 0); c.lineTo(sx(x), H); c.stroke();
    }
    for (const z of [-600, -400, -200, 0, 200, 400, 600]) {
      c.beginPath(); c.moveTo(0, sz(z)); c.lineTo(W, sz(z)); c.stroke();
    }
    // Beach + water tint at the south edge.
    c.fillStyle = '#8a7448'; c.fillRect(0, sz(600), W, H - sz(600));
    c.fillStyle = '#0a3a5a'; c.fillRect(sx(-800), sz(600), sx(-400) - sx(-800), H - sz(600));
    const dot = (x, z, color, r = 3) => { c.fillStyle = color; c.beginPath(); c.arc(sx(x), sz(z), r, 0, Math.PI * 2); c.fill(); };
    // Mission target.
    const m = g.missions.current();
    if (m) {
      const st = g.missions.step();
      if (st && (st.x !== undefined)) dot(st.x, st.z, '#ffd34a', 4);
      if (g.missions.tail) dot(g.missions.tail.x, g.missions.tail.z, '#ffd34a', 4);
    }
    for (const car of g.traffic.cars) dot(car.x, car.z, '#888888', 2);
    for (const cop of g.police.cops) dot(cop.x, cop.z, '#5577ff', 2);
    for (const cr of g.police.cruisers) dot(cr.x, cr.z, '#2244ff', 3);
    if (g.police.heli) dot(g.police.heli.x, g.police.heli.z, '#ff3344', 4);
    // Player: white triangle pointing along heading.
    const p = g.player;
    c.fillStyle = '#ffffff';
    c.save();
    c.translate(sx(p.x), sz(p.z));
    c.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) * 0 + 0);
    c.beginPath(); c.moveTo(0, -5); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill();
    c.restore();
  }
}
