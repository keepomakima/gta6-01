// NEON TIDE v7 "Golden Hour" — hud.js
// (missions.index === 13). v7: the cutscene panel (portrait + speaker +
// line + letterbox) is drawn here from S.cutscene / S.dialog.who.
import { MISSIONS } from './missions.js';
import { districtAt, WEAPONS } from './config.js';
import { clockString } from './weather.js';
import { interactPrompt } from './shops.js';
import { CHARACTERS } from './cutscene.js';
import { currentToast } from './achievements.js';
import { stuntPopup } from './stunts.js';
import { statSummary } from './stats.js';

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
  const hw = S.heatwave;
  el('hud-heatwave', hw.active ? `HEAT WAVE ${Math.floor(hw.elapsed)}s — score ${hw.score}` : '');
  // Screenshot mode: hide the new v7 HUD layers (chatter, trophy toast,
  // stunt banner, career strip) so the staged frames stay clean — the
  // classic HUD (objective, wanted, minimap, dialog) still shows. The
  // toast div has a gold border, so an empty one would render as a small
  // pill at the top of the frame; display:none removes it entirely.
  const shotMode = !!S.shotMode;
  for (const id of ['hud-chatter', 'hud-toast', 'hud-stunt', 'hud-stats']) {
    const n = $(id);
    if (n) n.style.display = shotMode ? 'none' : '';
  }
  if (!shotMode) {
    // Chatter ticker: dispatch, DJ, or street gossip under the objective.
    el('hud-chatter', S.chatter && S.chatter.line ? S.chatter.line : '');
    // Trophy banner: a gold toast for a few seconds when one unlocks.
    const toast = currentToast(S);
    el('hud-toast', toast ? `★ ${toast.name} — ${toast.blurb}` : '');
    // Stunt payout banner: near misses and drifts, big and brief.
    el('hud-stunt', stuntPopup(S));
    // Career strip: style, top speed, distance, earnings — once playing.
    el('hud-stats', statSummary(S));
  }
  const det = $('hud-detection');
  if (det) {
    const show = M.mode === 'playing' && M.index === 13;
    det.style.display = show ? 'block' : 'none';
    if (show) {
      det.querySelector('.det-fill').style.width = `${M.detection}%`;
      det.querySelector('.det-label').textContent = `DETECTED ${Math.floor(M.detection)}%`;
    }
  }
  // Dialog line + cutscene portrait panel (v7).
  drawDialog(S);
  const flash = $('hud-flash');
  if (flash) flash.textContent = S.flash || '';
  el('hud-prompt', S.ui.screen === 'playing' ? interactPrompt(S) : '');
  drawMinimap(S);
}

// Dialog: a cutscene line (portrait panel + letterbox) wins over the plain
// dialog bar; a briefing line shows the speaker's portrait too.
export function drawDialog(S) {
  const panel = $('cutscene');
  const dlg = $('hud-dialog');
  const C = S.cutscene;
  if (C && C.active) {
    const ch = CHARACTERS[C.who] || CHARACTERS.deke;
    if (panel) {
      panel.style.display = 'flex';
      const face = panel.querySelector('.cs-face');
      const name = panel.querySelector('.cs-name');
      const text = panel.querySelector('.cs-text');
      if (face) { face.textContent = ch.short; face.style.background = ch.color; }
      if (name) { name.textContent = ch.name; name.style.color = ch.color; }
      if (text) text.textContent = C.text;
      panel.querySelector('.cs-hint').textContent = 'Enter / Space — continue · Esc — skip';
    }
    if (dlg) dlg.textContent = '';
    return;
  }
  if (panel) panel.style.display = 'none';
  if (dlg) {
    const d = S.dialog;
    if (d && S.time < d.until) {
      // Briefing lines carry a speaker: show their portrait inline.
      if (d.who && CHARACTERS[d.who]) {
        const ch = CHARACTERS[d.who];
        dlg.innerHTML = '';
        const face = document.createElement('span');
        face.className = 'dlg-face';
        face.textContent = ch.short;
        face.style.background = ch.color;
        dlg.appendChild(face);
        const span = document.createElement('span');
        span.textContent = ' ' + d.text;
        dlg.appendChild(span);
      } else {
        dlg.textContent = d.text;
      }
    } else dlg.textContent = '';
  }
}

// (grey), police (blue/red), mission marker (yellow), enemies (red), heli,
// and pedestrians (pale dots — the living city shows on the map too).
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
  for (const p of S.peds) dot(p.x, p.z, '#c2c2d8', 1.5);
  if (S.heli.active) dot(S.heli.x, S.heli.z, '#ff8800', 4);
  if (S.missions.marker) {
    ctx.fillStyle = '#ffd21a';
    const mx = sx(S.missions.marker.x), my = sz(S.missions.marker.z);
    ctx.beginPath(); ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my); ctx.closePath(); ctx.fill();
  }
  dot(S.player.x, S.player.z, '#33ff66', 4);
  ctx.strokeStyle = '#33ff66';
  ctx.beginPath();
  ctx.moveTo(sx(S.player.x), sz(S.player.z));
  ctx.lineTo(sx(S.player.x) + Math.sin(S.player.heading) * 10, sz(S.player.z) + Math.cos(S.player.heading) * 10);
  ctx.stroke();
}

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
