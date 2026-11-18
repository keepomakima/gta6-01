// NEON TIDE v5 — renderer: the city, the cars, the people, and the full
// HUD (health, money, wanted, weapon, clock, mission card, police panel,
// speedometer, NOS gauge, minimap, dialog). One canvas, 1280x720.
import { WORLD_W, WORLD_H, MISSIONS, WEAPONS, UPGRADES, SHOP_ITEMS, NOS_TANK } from './config.js';
import { ROAD_X, ROAD_Y, ROAD_W, BUILDINGS, CONTAINERS, LANDMARKS, districtAt } from './world.js';
import { drawParticles } from './particles.js';
import { drawRain } from './weather.js';
import { dist } from './random.js';

const VW = 1280, VH = 720;

function nightAlpha(g) {
  // Clock runs 0..24; night is 19..6. Returns 0 (day) .. 0.55 (deep night).
  const h = g.clock;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 20) return (h - 18) * 0.22;
  if (h >= 6 && h < 7) return (7 - h) * 0.22;
  return 0.45;
}

export function draw(g) {
  const ctx = g.ctx;
  const cam = g.cam;
  ctx.clearRect(0, 0, VW, VH);
  if (g.mode === 'title') { drawTitle(g); return; }
  drawGround(g);
  drawRoads(g);
  drawLandmarks(g);
  drawPickups(g);
  drawSpikesRoadblocks(g);
  drawCars(g);
  drawPeds(g);
  drawEnemies(g);
  drawCops(g);
  drawHeli(g);
  drawPlayer(g);
  drawParticles(ctx, g.particles, cam);
  drawMissionMarker(g);
  // Night overlay + rain on top of the world, under the HUD.
  const na = nightAlpha(g);
  if (na > 0) {
    ctx.fillStyle = `rgba(8,12,40,${na})`;
    ctx.fillRect(0, 0, VW, VH);
    drawHeadlights(g);
  }
  drawRain(ctx, g.weather, VW, VH);
  drawHUD(g);
  if (g.garageOpen) drawGarageMenu(g);
  if (g.shopOpen) drawShopMenu(g);
  drawDialog(g);
  drawPopups(g);
  if (g.mode === 'pause' && !g.garageOpen && !g.shopOpen) drawPause(g);
  if (g.mode === 'busted') drawEndCard(g, 'BUSTED', 'The Port Solano PD has you. $100 fine. Press Enter to walk free.');
  if (g.mode === 'wasted') drawEndCard(g, 'WASTED', 'Deke is down. The tide takes its cut. Press Enter to get up.');
  if (g.mode === 'complete') drawEndCard(g, 'NEON TIDE — COMPLETE', 'All 15 missions done. The port is yours, Deke. Press Enter to keep cruising.');
}

function drawGround(g) {
  const { ctx, cam } = g;
  ctx.fillStyle = '#2e4a2f';
  ctx.fillRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
  // Beach sand along the south shore, water below it.
  ctx.fillStyle = '#c8b078';
  ctx.fillRect(-cam.x, 1500 - cam.y, WORLD_W, 60);
  ctx.fillStyle = '#1d5a7a';
  ctx.fillRect(-cam.x, 1568 - cam.y, WORLD_W, 32);
  // Parks.
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(650 - cam.x, 1150 - cam.y, 180, 130);
  ctx.fillRect(1650 - cam.x, 250 - cam.y, 150, 110);
  // Airfield apron + Runway 27.
  ctx.fillStyle = '#55585e';
  ctx.fillRect(1850 - cam.x, 940 - cam.y, 520, 120);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('27', 2050 - cam.x, 1015 - cam.y);
  ctx.fillStyle = '#e8e8e8';
  for (let x = 1900; x < 2340; x += 90) ctx.fillRect(x - cam.x, 996 - cam.y, 46, 6);
}

function drawRoads(g) {
  const { ctx, cam } = g;
  ctx.fillStyle = '#33363c';
  for (const y of ROAD_Y) ctx.fillRect(-cam.x, y - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
  for (const x of ROAD_X) ctx.fillRect(x - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H);
  ctx.strokeStyle = 'rgba(232,232,232,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const y of ROAD_Y) { ctx.moveTo(-cam.x, y - cam.y); ctx.lineTo(WORLD_W - cam.x, y - cam.y); }
  for (const x of ROAD_X) { ctx.moveTo(x - cam.x, -cam.y); ctx.lineTo(x - cam.x, WORLD_H - cam.y); }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLandmarks(g) {
  const { ctx, cam } = g;
  const isNight = nightAlpha(g) > 0.1;
  for (const b of BUILDINGS) {
    const bx = b.x - cam.x, by = b.y - cam.y;
    ctx.fillStyle = b.kind === 'tower' ? '#4a4a58' : b.kind === 'casino' ? '#3a1a4a' : b.kind === 'terminal' ? '#5a5a62' : '#46464f';
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.strokeStyle = '#22222a';
    ctx.strokeRect(bx, by, b.w, b.h);
    if (isNight) {
      ctx.fillStyle = 'rgba(255,214,110,0.85)';
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 26) {
        for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += 26) {
          if ((wx * 7 + wy * 13) % 3 === 0) ctx.fillRect(wx - cam.x, wy - cam.y, 10, 12);
        }
      }
    }
    if (b.kind === 'casino') {
      ctx.fillStyle = ['#ff2a7a', '#22e8ff', '#ffd72a'][(b.x / 110 | 0) % 3];
      ctx.font = 'bold 13px monospace';
      ctx.fillText(b.label.toUpperCase(), bx + 6, by - 6);
    }
  }
  for (const c of CONTAINERS) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - cam.x, c.y - cam.y, c.w, c.h);
    ctx.strokeStyle = '#222';
    ctx.strokeRect(c.x - cam.x, c.y - cam.y, c.w, c.h);
  }
  // Landmark signs.
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#ffd72a';
  ctx.fillText('KESTREL CLUB', LANDMARKS.club.x - 52 - cam.x, LANDMARKS.club.y - 24 - cam.y);
  ctx.fillStyle = '#ff9a3a';
  ctx.fillText("ROSA'S GARAGE", LANDMARKS.garage.x - 56 - cam.x, LANDMARKS.garage.y - 24 - cam.y);
  ctx.fillStyle = '#9ad8ff';
  ctx.fillText('IRONWORKS ARMS', LANDMARKS.gunshop.x - 58 - cam.x, LANDMARKS.gunshop.y - 24 - cam.y);
  ctx.fillStyle = '#7ae8a8';
  ctx.fillText('SAFEHOUSE', LANDMARKS.safehouse1.x - 34 - cam.x, LANDMARKS.safehouse1.y - 24 - cam.y);
  // Parked planes on the apron.
  ctx.fillStyle = '#c8ccd4';
  for (const [px, py] of [[2250, 880], [1900, 880]]) {
    ctx.save();
    ctx.translate(px - cam.x, py - cam.y);
    ctx.fillRect(-34, -5, 68, 10);
    ctx.fillRect(-6, -26, 12, 52);
    ctx.restore();
  }
}

function drawPickups(g) {
  const { ctx, cam } = g;
  for (const pk of g.pickups) {
    ctx.fillStyle = pk.kind === 'cash' ? '#2aff7a' : pk.kind === 'ammo' ? '#ffd72a' : pk.kind === 'health' ? '#ff5a6a' : '#7ab8ff';
    ctx.beginPath();
    ctx.arc(pk.x - cam.x, pk.y - cam.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpikesRoadblocks(g) {
  const { ctx, cam } = g;
  for (const s of g.spikes) {
    ctx.save();
    ctx.translate(s.x - cam.x, s.y - cam.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#c8ccd4';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 12, -8); ctx.lineTo(i * 12 + 5, 0); ctx.lineTo(i * 12, 8);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const rb of g.roadblocks) {
    ctx.save();
    ctx.translate(rb.x - cam.x, rb.y - cam.y);
    ctx.rotate(rb.angle);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(-46, -10, 92, 20);
    ctx.fillStyle = '#ff2a3a';
    ctx.fillRect(-46, -10, 92, 5);
    ctx.restore();
  }
}

function drawCarShape(ctx, x, y, angle, color, w = 44, h = 22) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#101018';
  ctx.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(180,220,255,0.75)';
  ctx.fillRect(w * 0.08, -h / 2 + 3, w * 0.2, h - 6);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
  ctx.restore();
}

function drawCars(g) {
  const { ctx, cam } = g;
  for (const c of [...g.cars, ...g.traffic, ...g.cruisers]) {
    const w = c.type === 'truck' ? 58 : c.type === 'bike' ? 34 : 44;
    const h = c.type === 'truck' ? 26 : c.type === 'bike' ? 12 : 22;
    drawCarShape(ctx, c.x - cam.x, c.y - cam.y, c.angle, c.color, w, h);
    if (c.type === 'cruiser') {
      ctx.fillStyle = '#ff2a3a';
      ctx.fillRect(c.x - cam.x - 6, c.y - cam.y - h / 2 - 5, 12, 4);
    }
    if (c.cond !== undefined && c.cond < 40) {
      ctx.fillStyle = 'rgba(120,120,120,0.8)';
      ctx.beginPath();
      ctx.arc(c.x - cam.x - 10, c.y - cam.y - 8, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // NOS blue flames behind the player's car while boosting.
  if (g.nosBoost) {
    const car = g.player.car;
    if (car) {
      ctx.fillStyle = '#3aa8ff';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 28 - cam.x, car.y - Math.sin(car.angle) * 28 - cam.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 30 - cam.x, car.y - Math.sin(car.angle) * 30 - cam.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPeds(g) {
  const { ctx, cam } = g;
  for (const ped of g.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x - cam.x, ped.y - cam.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath();
    ctx.arc(ped.x - cam.x, ped.y - cam.y - 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies(g) {
  const { ctx, cam } = g;
  // Sentry vision cones (Mission 14).
  if (g.mission.idx === 14 && g.mission.data.sentries) {
    for (const s of g.mission.data.sentries) {
      ctx.save();
      ctx.translate(s.x - cam.x, s.y - cam.y);
      ctx.fillStyle = 'rgba(255,214,42,0.18)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 270, s.angle - 0.61, s.angle + 0.61);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#e8b820';
      ctx.beginPath();
      ctx.arc(s.x - cam.x, s.y - cam.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    // Detection meter.
    const d = g.mission.data.detection || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VW / 2 - 130, 66, 260, 18);
    ctx.fillStyle = d > 70 ? '#ff2a3a' : '#ffd72a';
    ctx.fillRect(VW / 2 - 128, 68, 256 * (d / 100), 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('DETECTION', VW / 2 - 130, 60);
  }
  for (const e of g.enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = e.boss ? '#ff2a3a' : '#b83a2a';
    ctx.beginPath();
    ctx.arc(e.x - cam.x, e.y - cam.y, e.boss ? 14 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(e.x - cam.x, e.y - cam.y - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Health bar.
    const max = e.boss ? 320 : 100;
    ctx.fillStyle = '#222';
    ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 24, 28, 4);
    ctx.fillStyle = '#ff4a3a';
    ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 24, 28 * Math.max(0, e.hp / max), 4);
    if (e.boss) {
      ctx.fillStyle = '#ff2a3a';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('ROOK', e.x - cam.x - 18, e.y - cam.y - 30);
    }
  }
  // Mission 7 target.
  if (g.mission.idx === 7 && g.mission.data.target) {
    const t = g.mission.data.target;
    ctx.fillStyle = '#ffd72a';
    ctx.beginPath();
    ctx.arc(t.x - cam.x, t.y - cam.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

function drawCops(g) {
  const { ctx, cam } = g;
  for (const cop of g.cops) {
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(cop.x - cam.x, cop.y - cam.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a6ad8';
    ctx.fillRect(cop.x - cam.x - 10, cop.y - cam.y - 4, 20, 5);
  }
}

function drawHeli(g) {
  const { ctx, cam } = g;
  const h = g.heli;
  if (!h.active) return;
  if (h.spotOn) {
    ctx.save();
    ctx.translate(h.x - cam.x, h.y - cam.y);
    ctx.rotate(h.spotA);
    const grad = ctx.createLinearGradient(0, 0, 420, 0);
    grad.addColorStop(0, 'rgba(255,244,180,0.35)');
    grad.addColorStop(1, 'rgba(255,244,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(420, -70);
    ctx.lineTo(420, 70);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,244,180,0.25)';
    ctx.beginPath();
    ctx.arc(g.player.x - cam.x, g.player.y - cam.y, 46, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#22262e';
  ctx.beginPath();
  ctx.arc(h.x - cam.x, h.y - cam.y, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff2a3a';
  ctx.beginPath();
  ctx.arc(h.x - cam.x, h.y - cam.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('AIR-1', h.x - cam.x - 16, h.y - cam.y - 22);
}

function drawPlayer(g) {
  const { ctx, cam } = g;
  const p = g.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x - cam.x, p.y - cam.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#1d6a4a';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath();
  ctx.arc(2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -2, 10, 4); // gun / fist direction
  ctx.restore();
}

function drawHeadlights(g) {
  const { ctx, cam } = g;
  const cars = [...g.cars, ...g.traffic, ...g.cruisers];
  for (const c of cars) {
    if (g.player.inCar && g.player.car === c) continue;
    const d = dist(c.x, c.y, g.player.x, g.player.y);
    if (d > 700) continue;
    ctx.fillStyle = 'rgba(255,240,170,0.10)';
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(c.angle) * 60 - cam.x, c.y + Math.sin(c.angle) * 60 - cam.y, 40, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMissionMarker(g) {
  const { ctx, cam } = g;
  const m = g.mission;
  if (!m.target || g.mode === 'complete') return;
  const t = m.target;
  const pulse = 1 + Math.sin(g.time * 4) * 0.15;
  ctx.save();
  ctx.translate(t.x - cam.x, t.y - cam.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd72a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd72a';
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.lineTo(-8, -18); ctx.lineTo(8, -18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Edge arrow when the target is off-screen.
  const sx = t.x - cam.x, sy = t.y - cam.y;
  if (sx < 40 || sx > VW - 40 || sy < 40 || sy > VH - 40) {
    const a = Math.atan2(sy - VH / 2, sx - VW / 2);
    const ax = VW / 2 + Math.cos(a) * (VW / 2 - 60);
    const ay = VH / 2 + Math.sin(a) * (VH / 2 - 60);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd72a';
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- HUD

function bar(ctx, x, y, w, h, frac, color, bg = '#222') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

function drawHUD(g) {
  const { ctx } = g;
  const p = g.player;
  const def = MISSIONS[g.mission.idx - 1];
  // Top-left: mission card.
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  ctx.fillRect(14, 14, 330, 92);
  ctx.fillStyle = '#ffd72a';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`MISSION ${g.mission.idx}/15 — ${def.title}`, 24, 36);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(def.brief.slice(0, 44), 24, 56);
  if (g.mission.data.timer !== undefined) {
    ctx.fillStyle = g.mission.data.timer < 20 ? '#ff4a3a' : '#7ae8a8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`⏱ ${Math.ceil(g.mission.data.timer)}s`, 24, 78);
  }
  if (g.mission.idx === 7) {
    ctx.fillStyle = '#ffd72a';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`FOLLOW ${Math.floor(g.mission.data.followT || 0)}/25s`, 24, 78);
  }
  ctx.fillStyle = '#7ab8ff';
  ctx.font = '12px monospace';
  const tgt = g.mission.target;
  if (tgt) {
    const d = Math.round(dist(p.x, p.y, tgt.x, tgt.y));
    ctx.fillText(`NEXT: ${tgt.label} — ${d}m`, 24, 96);
  }
  // Top-right: police response panel + wanted stars.
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  ctx.fillRect(VW - 260, 14, 246, 86);
  ctx.fillStyle = '#ff4a3a';
  ctx.font = 'bold 20px monospace';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < g.wanted ? '★' : '☆';
  ctx.fillText(stars, VW - 248, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  const resp = g.wanted === 0 ? 'Patrol: calm' : g.wanted <= 2 ? 'Response: foot cops + cruiser' : g.wanted === 3 ? 'Response: roadblocks + PIT' : g.wanted === 4 ? 'Response: AIR-1 + spike strips' : 'Response: full city lockdown';
  ctx.fillText(resp.slice(0, 34), VW - 248, 60);
  ctx.fillText(`AIR-1: ${g.heli.active ? 'ON YOU' : 'standby'}`, VW - 248, 78);
  ctx.fillText(`Spikes: ${g.spikeSeen ? 'deployed' : '—'}`, VW - 248, 94);
  // Bottom-left: health / armor / money / debt.
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  ctx.fillRect(14, VH - 96, 300, 82);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('HP', 24, VH - 74);
  bar(ctx, 54, VH - 84, 150, 12, p.hp / 100, p.hp > 30 ? '#2aff7a' : '#ff4a3a');
  ctx.fillText('ARMOR', 24, VH - 54);
  bar(ctx, 54, VH - 64, 150, 12, p.armor / 100, '#7ab8ff');
  ctx.fillStyle = '#2aff7a';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`$${g.money.toLocaleString()}`, 24, VH - 28);
  ctx.fillStyle = '#ff9a3a';
  ctx.font = '12px monospace';
  ctx.fillText(`Debt: $${(50000 - Math.min(50000, g.money)).toLocaleString()}`, 150, VH - 28);
  // Bottom-right: weapon slots + speedometer + NOS gauge.
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  ctx.fillRect(VW - 320, VH - 96, 306, 82);
  const slots = ['fists', 'pistol', 'smg', 'shotgun'];
  slots.forEach((w, i) => {
    const x = VW - 306 + i * 72;
    const owned = w === 'fists' || w === 'pistol' || g.owned[w];
    ctx.fillStyle = p.weapon === w ? '#ffd72a' : 'rgba(255,255,255,0.14)';
    ctx.fillRect(x, VH - 84, 64, 26);
    ctx.fillStyle = owned ? '#fff' : '#666';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(WEAPONS[w].label.toUpperCase(), x + 5, VH - 67);
    if (owned && w !== 'fists') {
      ctx.font = '11px monospace';
      ctx.fillText(`${p.ammo[w] ?? 0}`, x + 5, VH - 52);
    }
  });
  if (p.inCar && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`${kmh}`, VW - 120, VH - 22);
    ctx.font = '11px monospace';
    ctx.fillText('KM/H', VW - 118, VH - 8);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText(`COND ${Math.max(0, Math.round(p.car.cond))}%`, VW - 306, VH - 22);
    if ((g.upgrades.nos || 0) > 0) {
      ctx.fillText('NOS', VW - 306, VH - 8);
      bar(ctx, VW - 270, VH - 16, 90, 8, g.nos / NOS_TANK, '#3aa8ff');
    }
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(districtAt(p.x, p.y), VW - 306, VH - 22);
  }
  // Bottom-centre: clock, district, radio, upgrades.
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  ctx.fillRect(VW / 2 - 210, VH - 34, 420, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  const hh = Math.floor(g.clock);
  const mm = Math.floor((g.clock - hh) * 60);
  const day = `Day ${g.day}`;
  ctx.fillText(`${day}  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  ${districtAt(p.x, p.y)}  ·  ${g.audio.stationName()}  ·  Rain ${Math.round(g.weather.rain * 100)}%`, VW / 2 - 200, VH - 17);
  // Upgrades strip.
  if ((g.upgrades.engine || g.upgrades.grip || g.upgrades.armor || g.upgrades.nos)) {
    ctx.fillStyle = 'rgba(10,12,20,0.6)';
    ctx.fillRect(14, 112, 330, 20);
    ctx.fillStyle = '#7ae8ff';
    ctx.font = '11px monospace';
    ctx.fillText(UPGRADES.map((u) => `${u.label} ${g.upgrades[u.id] || 0}`).join('  '), 24, 126);
  }
  drawMinimap(g);
}

function drawMinimap(g) {
  const { ctx } = g;
  const mw = 190, mh = 128, mx = VW - mw - 14, my = 122;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,12,20,0.78)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#24351f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#3a3d44';
  for (const y of ROAD_Y) ctx.fillRect(mx, my + y * sy - 2, mw, 4);
  for (const x of ROAD_X) ctx.fillRect(mx + x * sx - 2, my, 4, mh);
  ctx.fillStyle = '#1d5a7a';
  ctx.fillRect(mx, my + 1500 * sy, mw, mh - 1500 * sy);
  const blip = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (g.mission.target) blip(g.mission.target.x, g.mission.target.y, '#ffd72a', 4);
  for (const c of g.cruisers) blip(c.x, c.y, '#3a6ad8');
  for (const e of g.enemies) if (e.alive) blip(e.x, e.y, '#ff4a3a');
  blip(g.player.x, g.player.y, '#2aff7a', 4);
  if (g.heli.active) blip(g.heli.x, g.heli.y, '#ff9a3a', 4);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('N', mx + mw / 2 - 3, my - 8 + 4);
}

function drawDialog(g) {
  if (!g.dialog) return;
  const { ctx } = g;
  ctx.fillStyle = 'rgba(10,12,20,0.85)';
  ctx.fillRect(190, VH - 170, 900, 56);
  ctx.fillStyle = '#ffd72a';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(g.dialog.name, 210, VH - 146);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(g.dialog.text.slice(0, 110), 210, VH - 124);
}

function drawPopups(g) {
  const { ctx } = g;
  ctx.font = 'bold 13px monospace';
  g.popups.forEach((pp, i) => {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, pp.t)})`;
    ctx.fillText(pp.text, 24, 150 + i * 20);
  });
}

function drawGarageMenu(g) {
  const { ctx } = g;
  ctx.fillStyle = 'rgba(5,8,16,0.88)';
  ctx.fillRect(390, 130, 500, 380);
  ctx.fillStyle = '#ff9a3a';
  ctx.font = 'bold 22px monospace';
  ctx.fillText("ROSA'S GARAGE", 420, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(`Cash: $${g.money.toLocaleString()}   (car serviced: repaired + NOS refilled)`, 420, 196);
  UPGRADES.forEach((u, i) => {
    const lvl = g.upgrades[u.id] || 0;
    const y = 230 + i * 62;
    ctx.fillStyle = g.garageSel === i ? '#ffd72a' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(420, y - 18, 440, 50);
    ctx.fillStyle = g.garageSel === i ? '#111' : '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${u.label}  Lv${lvl}/3  — ${u.desc}`, 434, y + 2);
    ctx.font = '13px monospace';
    ctx.fillText(lvl >= 3 ? 'MAXED' : `Next: $${u.costs[lvl] }  (Enter to buy)`, 434, y + 20);
  });
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  ctx.fillText('Up/Down to pick · Enter to buy · Esc to leave', 420, 480);
}

function drawShopMenu(g) {
  const { ctx } = g;
  ctx.fillStyle = 'rgba(5,8,16,0.88)';
  ctx.fillRect(390, 130, 500, 380);
  ctx.fillStyle = '#9ad8ff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('IRONWORKS ARMS', 420, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(`Cash: $${g.money.toLocaleString()}`, 420, 196);
  SHOP_ITEMS.forEach((it, i) => {
    const y = 230 + i * 62;
    ctx.fillStyle = g.shopSel === i ? '#9ad8ff' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(420, y - 18, 440, 50);
    ctx.fillStyle = g.shopSel === i ? '#111' : '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${it.label} — $${it.price}`, 434, y + 2);
    ctx.font = '13px monospace';
    ctx.fillText(it.desc + (g.owned[it.id] ? '  (OWNED)' : ''), 434, y + 20);
  });
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  ctx.fillText('Up/Down to pick · Enter to buy · Esc to leave', 420, 480);
}

function drawPause(g) {
  const { ctx } = g;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('PAUSED', VW / 2 - 70, VH / 2 - 20);
  ctx.font = '14px monospace';
  ctx.fillText('Esc to resume · R radio · 1-4 weapons · M mute', VW / 2 - 170, VH / 2 + 14);
}

function drawEndCard(g, title, sub) {
  const { ctx } = g;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = title === 'WASTED' ? '#ff4a3a' : title === 'BUSTED' ? '#3a6ad8' : '#ffd72a';
  ctx.font = 'bold 44px monospace';
  const w = ctx.measureText(title).width;
  ctx.fillText(title, (VW - w) / 2, VH / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  const sw = ctx.measureText(sub).width;
  ctx.fillText(sub, (VW - sw) / 2, VH / 2 + 16);
}

function drawTitle(g) {
  const { ctx } = g;
  // Dusk city backdrop: gradient + skyline silhouettes.
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, '#2a1a4a');
  grad.addColorStop(0.55, '#c84a6a');
  grad.addColorStop(1, '#1a2a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#14101f';
  const rngBuildings = [60, 140, 90, 200, 120, 170, 100, 220, 130, 90, 180];
  let bx = 0;
  for (const bh of rngBuildings) {
    ctx.fillRect(bx, 520 - bh, 110, bh + 200);
    ctx.fillStyle = 'rgba(255,214,110,0.8)';
    for (let wy = 520 - bh + 14; wy < 500; wy += 26) ctx.fillRect(bx + 14, wy, 12, 14);
    ctx.fillStyle = '#14101f';
    bx += 118;
  }
  ctx.fillStyle = '#ffd72a';
  ctx.font = 'bold 72px monospace';
  ctx.fillText('NEON TIDE', 300, 240);
  ctx.fillStyle = '#22e8ff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('open-world crime in Port Solano', 330, 290);
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('Deke Marlowe owes Madame Kestrel $50,000. Fifteen missions to pay it back.', 240, 340);
  ctx.fillText('WASD drive & walk · E enter car / interact · Mouse aim · Shift run / NOS', 240, 370);
  ctx.fillText('R radio · 1-4 weapons · Esc pause', 240, 400);
  const blink = Math.sin(g.time * 3) > 0 ? 1 : 0.25;
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#2aff7a';
  ctx.font = 'bold 22px monospace';
  const cont = g.hasSave ? 'ENTER — CONTINUE  (save found)' : 'ENTER — NEW GAME';
  ctx.fillText(cont, 430, 480);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#aaa';
  ctx.font = '13px monospace';
  ctx.fillText('15 missions · 7 districts · garage upgrades + NOS · rain · AIR-1 helicopter', 330, 540);
  ctx.fillText('A 2D top-down crime game. All characters, places and music are original.', 330, 566);
  ctx.fillStyle = '#ffd72a';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('NEON TIDE v5 — rebuilt fresh for make.fun gta6-01', 330, 596);
}
