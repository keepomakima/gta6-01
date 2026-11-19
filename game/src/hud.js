// NEON TIDE v7-coverfix — hud.js (structural pass)
// DOM HUD: vitals, wanted stars, objective, minimap, dialog and the
// cutscene portrait panel. In shot mode the four v7 layers (chatter,
// trophy toast, stunt banner, career strip) are hidden so staged
// frames stay clean — the classic HUD still shows.
import { MISSIONS } from './missions.js';
import { WEAPONS, districtAt } from './config.js';
import { clockString } from './weather.js';
import { interactPrompt } from './shops.js';
import { CHARACTERS } from './cutscene.js';
import { currentToast } from './achievements.js';
import { stuntPopup } from './stunts.js';
import { statSummary } from './stats.js';

function $(id) { return document.getElementById(id); }

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

export function updateHUD(S) {
  const pl = S.player;
  const shot = !!S.shotMode;
  // Staged frames hide the four v7 layers outright; an empty toast div
  // would otherwise render as a small gold-bordered pill at the top.
  ['hud-chatter', 'hud-toast', 'hud-stunt', 'hud-stats'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = shot ? 'none' : '';
  });
  let hp = `HP ${Math.max(0, Math.ceil(pl.health))}`;
  if (pl.armor > 0) hp += ` +${Math.ceil(pl.armor)} armor`;
  setText('hud-health', hp);
  setText('hud-money', `$${pl.money.toLocaleString()}`);
  setText('hud-debt', `Debt $${S.debt.toLocaleString()}`);
  setText('hud-clock', clockString(S));
  setText('hud-district', districtAt(pl.x, pl.z));
  let station = '';
  if (S.audio) station = `♪ ${['Tide FM', 'Neon Nights', 'Harbor Rock'][S.audio.station]}`;
  setText('hud-station', station);
  const stars = $('hud-wanted');
  if (stars) {
    stars.textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
    if (S.wanted >= 4) stars.style.color = '#ff3333';
    else stars.style.color = '#ffd21a';
  }
  const w = WEAPONS[pl.weapon];
  const a = pl.ammo[pl.weapon];
  let ammoText = a;
  if (a === undefined || a === Infinity) ammoText = '∞';
  setText('hud-weapon', `${w.name} ${ammoText}`);
  const v = pl.car ? Math.abs(pl.car.speed) * 2.2 : Math.abs(pl.speed) * 2.2;
  if (pl.car) setText('hud-speed', `${Math.round(v)} km/h ${pl.car.type.toUpperCase()}`);
  else setText('hud-speed', 'On foot');
  const nosEl = $('hud-nos');
  if (nosEl) {
    nosEl.style.width = `${(S.garage.nos > 0 ? (pl.car ? pl.car.nos : S.garage.nosTank) / [0, 100, 160, 240][S.garage.nos] * 100 : 0)}%`;
    nosEl.parentElement.style.display = S.garage.nos > 0 ? 'block' : 'none';
  }
  const ms = S.missions;
  let line = 'Free roam — press Enter for the next mission';
  if (ms.mode === 'playing' && MISSIONS[ms.index]) {
    const def = MISSIONS[ms.index];
    const st = def.steps[ms.step];
    line = `M${ms.index + 1} ${def.name}: ${st ? st.label : ''}`;
    if (st && st.timer) line += ` — ${Math.max(0, Math.ceil(ms.timer))}s`;
    if (st) {
      switch (st.type) {
        case 'kill': line += ` (${S.killsTotal - ms.killsAtStart}/${st.n})`; break;
        case 'collect': line += ` (${ms.crates.filter((c) => c.taken).length}/${st.n})`; break;
        case 'race': line += ` (gate ${ms.gateIndex + 1}/${ms.gates.length})`; break;
        case 'tail': line += ` (${Math.floor(ms.tailTime)}/${st.need}s)`; break;
        default: break;
      }
    }
  } else if (ms.mode === 'complete') line = 'Mission complete — press Enter for the next';
  else if (ms.mode === 'failed') line = 'Mission failed — press Enter to retry';
  else if (ms.mode === 'won') line = 'King of Port Solano — you own the city!';
  setText('hud-objective', line);
  const heat = S.heatwave;
  let heatText = '';
  if (heat.active) heatText = `HEAT WAVE ${Math.floor(heat.elapsed)}s — score ${heat.score}`;
  setText('hud-heatwave', heatText);
  if (!shot) {
    setText('hud-chatter', S.chatter && S.chatter.line ? S.chatter.line : '');
    const t = currentToast(S);
    if (t) setText('hud-toast', `★ ${t.name} — ${t.blurb}`);
    else setText('hud-toast', '');
    setText('hud-stunt', stuntPopup(S));
    setText('hud-stats', statSummary(S));
  }
  const detEl = $('hud-detection');
  if (detEl) {
    const on = ms.mode === 'playing' && ms.index === 13;
    if (on) detEl.style.display = 'block';
    else detEl.style.display = 'none';
    if (on) {
      detEl.querySelector('.det-fill').style.width = `${ms.detection}%`;
      detEl.querySelector('.det-label').textContent = `DETECTED ${Math.floor(ms.detection)}%`;
    }
  }
  drawDialog(S);
  const flashEl = $('hud-flash');
  if (flashEl) flashEl.textContent = S.flash || '';
  setText('hud-prompt', S.ui.screen === 'playing' ? interactPrompt(S) : '');
  drawMinimap(S);
}

// Dialog: a cutscene line (portrait panel + letterbox) wins over the plain
// dialog bar; a briefing line shows the speaker's portrait too.
export function drawDialog(S) {
  const csPanel = $('cutscene');
  const bar = $('hud-dialog');
  const cut = S.cutscene;
  if (cut && cut.active) {
    const who = CHARACTERS[cut.who] ? CHARACTERS[cut.who] : CHARACTERS.deke;
    if (csPanel) {
      csPanel.style.display = 'flex';
      const f = csPanel.querySelector('.cs-face');
      const n = csPanel.querySelector('.cs-name');
      const t = csPanel.querySelector('.cs-text');
      if (f) { f.textContent = who.short; f.style.background = who.color; }
      if (n) { n.textContent = who.name; n.style.color = who.color; }
      if (t) t.textContent = cut.text;
      csPanel.querySelector('.cs-hint').textContent = 'Enter / Space — continue · Esc — skip';
    }
    if (bar) bar.textContent = '';
    return;
  }
  if (csPanel) csPanel.style.display = 'none';
  if (bar) {
    const d = S.dialog;
    if (d && S.time < d.until) {
      // Briefing lines carry a speaker: show their portrait inline.
      if (d.who && CHARACTERS[d.who]) {
        const who = CHARACTERS[d.who];
        bar.innerHTML = '';
        const face = document.createElement('span');
        face.className = 'dlg-face';
        face.textContent = who.short;
        face.style.background = who.color;
        bar.appendChild(face);
        const span = document.createElement('span');
        span.textContent = ' '.concat(d.text);
        bar.appendChild(span);
      } else {
        bar.textContent = d.text;
      }
    } else bar.textContent = '';
  }
}

// Minimap: roads (grey), police (blue/red), mission marker (yellow),
// enemies (red), heli, and pedestrians (pale dots).
export function drawMinimap(S) {
  const c = $('minimap');
  if (!c) return;
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  function px(x) { return (x + 1100) / 2200 * w; }
  function pz(z) { return (z + 750) / 1500 * h; }
  g.fillStyle = '#101018';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#333344';
  g.lineWidth = 1;
  let x = -1000;
  while (x <= 1000) {
    g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), h); g.stroke();
    x += 200;
  }
  let z = -700;
  while (z <= 700) {
    g.beginPath(); g.moveTo(0, pz(z)); g.lineTo(w, pz(z)); g.stroke();
    z += 200;
  }
  function mark(x, z, color, r) {
    if (r === undefined) r = 3;
    g.fillStyle = color;
    g.beginPath(); g.arc(px(x), pz(z), r, 0, Math.PI * 2); g.fill();
  }
  S.traffic.forEach((car) => mark(car.x, car.z, '#888888', 2));
  S.parked.forEach((car) => mark(car.x, car.z, '#aaaaaa', 2));
  S.cruisers.forEach((car) => mark(car.x, car.z, '#3355ff', 3));
  S.enemies.forEach((foe) => mark(foe.x, foe.z, '#ff3333', 3));
  S.peds.forEach((p) => mark(p.x, p.z, '#c2c2d8', 1.5));
  if (S.heli.active) mark(S.heli.x, S.heli.z, '#ff8800', 4);
  if (S.missions.marker) {
    g.fillStyle = '#ffd21a';
    const x0 = px(S.missions.marker.x), y0 = pz(S.missions.marker.z);
    g.beginPath(); g.moveTo(x0, y0 - 7); g.lineTo(x0 + 6, y0); g.lineTo(x0, y0 + 7); g.lineTo(x0 - 6, y0); g.closePath(); g.fill();
  }
  mark(S.player.x, S.player.z, '#33ff66', 4);
  g.strokeStyle = '#33ff66';
  g.beginPath();
  g.moveTo(px(S.player.x), pz(S.player.z));
  g.lineTo(px(S.player.x) + Math.sin(S.player.heading) * 10, pz(S.player.z) + Math.cos(S.player.heading) * 10);
  g.stroke();
}

export function showScreen(S, which) {
  ['title-screen', 'pause-screen', 'shop-screen', 'end-screen'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
  if (which) {
    const el = $(which);
    if (el) el.style.display = 'flex';
  }
}
