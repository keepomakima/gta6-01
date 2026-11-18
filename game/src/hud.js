// NEON TIDE v6-rebuild-2 — hud.js
// DOM HUD + canvas minimap. The HUD root is pinned with `bottom: 0` in
// index.html — an earlier build left it unpositioned and the whole bottom
// bar rendered above the viewport. Detection bar shows only during M14
// (missions.index === 13); `missions.current` is a method, not a property,
// and reading it as a number was the earlier bug.
import { MISSIONS } from './missions.js';
import { districtAt, WEAPONS } from './config.js';
import { clockString } from './weather.js';
import { interactPrompt } from './shops.js';

function $(id) { return document.getElementById(id); }

export function updateHUD(S) {
  const P = S.player;
  const el = (id, text) => { const n = $(id); if (n) n.textContent = text; };
  el('hud-health', `HP ${Math.max(0, Math.ceil(P.health))}${P.armor > 0 ? ` +${Math.ceil(P.armor)} armor` : ''}`);
  el('hud-money', `$${P.money.toLocaleString()}`);
  el('hud-debt', `Debt $${S.debt.toLocaleString()}`);
  el('hud-clock', clockString(S));
  el('hud-district', districtAt(P.x, P.z));
  el('hud-station', S.audio ? `♪ ${['Tide FM', 'Neon Nights', 'Harbor Rock'][S.audio.station]}` : '');
  // Wanted stars: filled ★ red up to the current level.
  const stars = $('hud-wanted');
  if (stars) {
    stars.textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
    stars.style.color = S.wanted >= 4 ? '#ff3333' : '#ffd21a';
  }
  const w = WEAPONS[P.weapon];
  const ammo = P.ammo[P.weapon];
  el('hud-weapon', `${w.name} ${ammo === undefined || ammo === Infinity ? '∞' : ammo}`);
  const speed = P.car ? Math.abs(P.car.speed) * 2.2 : Math.abs(P.speed) * 2.2;
  el('hud-speed', P.car ? `${Math.round(speed)} km/h ${P.car.type.toUpperCase()}` : 'On foot');
  const nos = $('hud-nos');
  if (nos) {
    nos.style.width = `${(S.garage.nos > 0 ? (P.car ? P.car.nos : S.garage.nosTank) / [0, 100, 160, 240][S.garage.nos] * 100 : 0)}%`;
    nos.parentElement.style.display = S.garage.nos > 0 ? 'block' : 'none';
  }
  // Objective tracker.
  const M = S.missions;
  let obj = 'Free roam — press Enter for the next mission';
  if (M.mode === 'playing' && MISSIONS[M.index]) {
    const def = MISSIONS[M.index];
    const step = def.steps[M.step];
    obj = `M${M.index + 1} ${def.name}: ${step ? step.label : ''}`;
    if (step && step.timer) obj += ` — ${Math.max(0, Math.ceil(M.timer))}s`;
    if (step && step.type === 'kill') obj += ` (${S.killsTotal - M.killsAtStart}/${step.n})`;
    if (step && step.type === 'collect') obj += ` (${M.crates.filter((c) => c.taken).length}/${step.n})`;
    if (step && step.type === 'race') obj += ` (gate ${M.gateIndex + 1}/${M.gates.length})`;
    if (step && step.type === 'tail') obj += ` (${Math.floor(M.tailTime)}/${step.need}s)`;
  } else if (M.mode === 'complete') obj = 'Mission complete — press Enter for the next';
  else if (M.mode === 'failed') obj = 'Mission failed — press Enter to retry';
  else if (M.mode === 'won') obj = 'King of Port Solano — you own the city!';
  el('hud-objective', obj);
  // Heat Wave score.
  const hw = S.heatwave;
  el('hud-heatwave', hw.active ? `HEAT WAVE ${Math.floor(hw.elapsed)}s — score ${hw.score}` : '');
  // Detection bar: only M14 (index 13).
  const det = $('hud-detection');
  if (det) {
    const show = M.mode === 'playing' && M.index === 13;
    det.style.display = show ? 'block' : 'none';
    if (show) {
      det.querySelector('.det-fill').style.width = `${M.detection}%`;
      det.querySelector('.det-label').textContent = `DETECTED ${Math.floor(M.detection)}%`;
    }
  }
  // Dialog line.
  const dlg = $('hud-dialog');
  if (dlg) {
    dlg.textContent = S.dialog && S.time < S.dialog.until ? S.dialog.text : '';
  }
  const flash = $('hud-flash');
  if (flash) flash.textContent = S.flash || '';
  // Interact prompt (E).
  el('hud-prompt', S.ui.screen === 'playing' ? interactPrompt(S) : '');
  drawMinimap(S);
}

// Minimap: north-up canvas, 220x150. Dots for the player (green), cars
// (grey), police (blue/red), mission marker (yellow), enemies (red), heli.
export function drawMinimap(S) {
  const cv = $('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = (x) => (x + 1100) / 2200 * W;
  const sz = (z) => (z + 750) / 1500 * H;
  ctx.fillStyle = '#101018';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#333344';
  ctx.lineWidth = 1;
  for (let x = -1000; x <= 1000; x += 200) {
    ctx.beginPath(); ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), H); ctx.stroke();
  }
  for (let z = -700; z <= 700; z += 200) {
    ctx.beginPath(); ctx.moveTo(0, sz(z)); ctx.lineTo(W, sz(z)); ctx.stroke();
  }
  const dot = (x, z, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx(x), sz(z), r, 0, Math.PI * 2); ctx.fill();
  };
  for (const c of S.traffic) dot(c.x, c.z, '#888888', 2);
  for (const c of S.parked) dot(c.x, c.z, '#aaaaaa', 2);
  for (const c of S.cruisers) dot(c.x, c.z, '#3355ff', 3);
  for (const e of S.enemies) dot(e.x, e.z, '#ff3333', 3);
  if (S.heli.active) dot(S.heli.x, S.heli.z, '#ff8800', 4);
  if (S.missions.marker) {
    ctx.fillStyle = '#ffd21a';
    const mx = sx(S.missions.marker.x), my = sz(S.missions.marker.z);
    ctx.beginPath(); ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my); ctx.closePath(); ctx.fill();
  }
  dot(S.player.x, S.player.z, '#33ff66', 4);
  // View direction tick.
  ctx.strokeStyle = '#33ff66';
  ctx.beginPath();
  ctx.moveTo(sx(S.player.x), sz(S.player.z));
  ctx.lineTo(sx(S.player.x) + Math.sin(S.player.heading) * 10, sz(S.player.z) + Math.cos(S.player.heading) * 10);
  ctx.stroke();
}

// Screen overlays: title / pause / busted / wasted / won / shop.
export function showScreen(S, name) {
  for (const id of ['title-screen', 'pause-screen', 'shop-screen', 'end-screen']) {
    const n = $(id);
    if (n) n.style.display = 'none';
  }
  if (name) {
    const n = $(name);
    if (n) n.style.display = 'flex';
  }
}
