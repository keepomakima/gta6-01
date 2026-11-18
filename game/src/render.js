// NEON TIDE — render.js
// Semua gambar canvas: kota (jalan, gedung berjendela menyala, neon, palem,
// kontainer, pantai), mobil + lampu depan malam, heli + spotlight cone,
// pejalan kaki, musuh, pickup, marker misi — dan HUD overhaul v4:
// mission card, panel police response, slot senjata, bar HP/armor/respect,
// speedometer besar, radio, distrik + jam, uang + utang, bintang wanted,
// dialog karakter berpotret, popup skor, dan minimap.
import { WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_HALF, CAR_TYPES, WEAPONS, SHOP_ITEMS, MISSION_DEFS, PLACES, DEBT_TOTAL } from './config.js';
import { dist } from './random.js';
import { districtAt } from './world.js';
import { missionStageText } from './missions.js';
import { policePanelUnits } from './police.js';

const NEON_SIGNS = [
  { x: 765, y: 262, text: 'KESTREL', color: '#ff2e88' },
  { x: 1065, y: 657, text: 'IRONWORKS', color: '#ffc233' },
  { x: 1365, y: 657, text: "ROSA'S", color: '#22e6ff' },
  { x: 2230, y: 1072, text: 'NEON TIDE MOTEL', color: '#ff2e88' },
  { x: 755, y: 932, text: 'PSPD', color: '#4d8dff' },
];

export function isNight(hour) { return hour < 6 || hour >= 19; }
export function isDusk(hour) { return hour >= 17.5 && hour < 19; }

export function drawWorld(ctx, G) {
  const cam = G.cam;
  const hour = G.clockHour;
  const night = isNight(hour);
  const dusk = isDusk(hour);
  // Langit / tanah dasar (warna distrik).
  ctx.fillStyle = night ? '#1c1a2e' : dusk ? '#5a3a52' : '#6b7c5e';
  ctx.fillRect(0, 0, 1280, 720);
  // Tanah per distrik (kotak besar, murah).
  ctx.fillStyle = night ? '#232030' : '#3d4a35';
  ctx.fillRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
  // Pantai timur (pasir) + laut.
  ctx.fillStyle = night ? '#6b5b3e' : '#c2a878';
  ctx.fillRect(2165 - cam.x, -cam.y, WORLD_W - 2165, WORLD_H);
  ctx.fillStyle = night ? '#0d2a44' : '#2e7fae';
  ctx.fillRect(2360 - cam.x, -cam.y, 40, WORLD_H);
  // Pelabuhan selatan (beton dok).
  ctx.fillStyle = night ? '#2a2724' : '#4a4640';
  ctx.fillRect(-cam.x, 1465 - cam.y, WORLD_W, WORLD_H - 1465);
  // Taman Palm Court.
  ctx.fillStyle = night ? '#1e3320' : '#4d7a3a';
  ctx.fillRect(365 - cam.x, 1065 - cam.y, 210, 110);

  drawRoads(ctx, cam);
  drawContainers(ctx, G);
  drawBuildings(ctx, G, night);
  drawPalms(ctx, G);
  drawNeonSigns(ctx, G, night);
  G.particles.draw(ctx, cam);
  drawPickups(ctx, G);
  drawMissionMarker(ctx, G);
  drawPeds(ctx, G);
  drawEnemies(ctx, G);
  drawCars(ctx, G, night);
  drawPlayer(ctx, G, night);
  drawCops(ctx, G);
  drawHeli(ctx, G);
  drawBullets(ctx, G);
  if (night) drawNightOverlay(ctx, G);
}

function drawRoads(ctx, cam) {
  ctx.fillStyle = '#2b2b33';
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_HALF - cam.x, -cam.y, ROAD_HALF * 2, WORLD_H);
  for (const hy of ROADS_H) ctx.fillRect(-cam.x, hy - ROAD_HALF - cam.y, WORLD_W, ROAD_HALF * 2);
  // Trotoar.
  ctx.fillStyle = '#4a4552';
  for (const vx of ROADS_V) {
    ctx.fillRect(vx - ROAD_HALF - 10 - cam.x, -cam.y, 10, WORLD_H);
    ctx.fillRect(vx + ROAD_HALF - cam.x, -cam.y, 10, WORLD_H);
  }
  for (const hy of ROADS_H) {
    ctx.fillRect(-cam.x, hy - ROAD_HALF - 10 - cam.y, WORLD_W, 10);
    ctx.fillRect(-cam.x, hy + ROAD_HALF - cam.y, WORLD_W, 10);
  }
  // Garis tengah putus-putus.
  ctx.strokeStyle = '#c9c25a';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  for (const vx of ROADS_V) { ctx.moveTo(vx - cam.x, -cam.y); ctx.lineTo(vx - cam.x, WORLD_H - cam.y); }
  for (const hy of ROADS_H) { ctx.moveTo(-cam.x, hy - cam.y); ctx.lineTo(WORLD_W - cam.x, hy - cam.y); }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawContainers(ctx, G) {
  const cam = G.cam;
  for (const c of G.world.containers) {
    ctx.save();
    ctx.translate(c.x - cam.x, c.y - cam.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.restore();
  }
}

const BUILDING_COLORS = ['#5a5468', '#6b5a52', '#4d5a6b', '#5e4d5e', '#57614e', '#6b4d4d'];

function drawBuildings(ctx, G, night) {
  const cam = G.cam;
  for (const b of G.world.buildings) {
    const sx = b.x - cam.x, sy = b.y - cam.y;
    if (sx > 1280 || sy > 720 || sx + b.w < 0 || sy + b.h < 0) continue;
    ctx.fillStyle = BUILDING_COLORS[b.hue % BUILDING_COLORS.length];
    ctx.fillRect(sx, sy, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, b.w, b.h);
    // Atap gedung tinggi lebih gelap.
    if (b.tall) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx + 6, sy + 6, b.w - 12, b.h - 12); }
    // Jendela menyala (malam) / gelap (siang).
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 24));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const lit = ((b.litSeed + i * 7 + j * 13) % 10) < (night ? 6 : 2);
        ctx.fillStyle = lit ? (night ? '#ffd76a' : '#8a94a8') : 'rgba(0,0,0,0.35)';
        ctx.fillRect(sx + 8 + i * ((b.w - 16) / cols), sy + 8 + j * ((b.h - 16) / rows), 10, 8);
      }
    }
    // Bayangan gedung ke tenggara.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(sx + 8, sy + b.h, b.w, 8);
    // Label landmark.
    if (b.label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, sx + b.w / 2, sy + b.h / 2 + 4);
    }
  }
}

function drawPalms(ctx, G) {
  const cam = G.cam;
  for (const pl of G.world.palms) {
    const sx = pl.x - cam.x, sy = pl.y - cam.y;
    if (sx < -30 || sx > 1310 || sy < -30 || sy > 750) continue;
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = 4 * pl.s;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 4 * pl.s, sy - 16 * pl.s); ctx.stroke();
    ctx.strokeStyle = '#3f9e4d';
    ctx.lineWidth = 3 * pl.s;
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      ctx.beginPath();
      ctx.moveTo(sx + 4 * pl.s, sy - 16 * pl.s);
      ctx.lineTo(sx + 4 * pl.s + Math.cos(a) * 18 * pl.s, sy - 16 * pl.s + Math.sin(a) * 12 * pl.s);
      ctx.stroke();
    }
  }
}

function drawNeonSigns(ctx, G, night) {
  const cam = G.cam;
  ctx.textAlign = 'center';
  for (const s of NEON_SIGNS) {
    const sx = s.x - cam.x, sy = s.y - cam.y;
    if (sx < -80 || sx > 1360 || sy < -20 || sy > 740) continue;
    ctx.font = 'bold 15px sans-serif';
    if (night) {
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, sx, sy);
    ctx.shadowBlur = 0;
  }
}

function drawPickups(ctx, G) {
  const cam = G.cam;
  for (const pk of G.pickups) {
    const sx = pk.x - cam.x, sy = pk.y - cam.y;
    const bob = Math.sin(pk.t * 4) * 2;
    if (pk.pkind === 'cash') { ctx.fillStyle = '#3fae5a'; ctx.fillRect(sx - 8, sy - 5 + bob, 16, 10); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', sx, sy + 3 + bob); }
    else if (pk.pkind === 'ammo') { ctx.fillStyle = '#ffc233'; ctx.fillRect(sx - 6, sy - 6 + bob, 12, 12); }
    else { ctx.fillStyle = '#4d8dff'; ctx.fillRect(sx - 8, sy - 6 + bob, 16, 12); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('A', sx, sy + 3 + bob); }
  }
  // Crate misi 10.
  if (G.mission && G.mission.id === 10) {
    for (let i = 0; i < 3; i += 1) {
      if (G.mission.data.crates[i]) continue;
      const c = PLACES.crateSpots[i];
      const sx = c.x - cam.x, sy = c.y - cam.y;
      ctx.fillStyle = '#c9a52e';
      ctx.fillRect(sx - 14, sy - 14, 28, 28);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(sx - 14, sy - 14, 28, 28);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CRATE', sx, sy + 4);
    }
  }
}

function drawMissionMarker(ctx, G) {
  const mk = G.missionMarker;
  if (!mk) return;
  const cam = G.cam;
  const sx = mk.x - cam.x, sy = mk.y - cam.y;
  const pulse = 1 + Math.sin(G.time * 5) * 0.15;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-9, -14); ctx.lineTo(9, -14); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mk.label, sx, sy - 44);
  // Garis penunjuk ke tepi layar bila marker di luar viewport.
  if (sx < 0 || sx > 1280 || sy < 0 || sy > 720) {
    const cx = Math.max(40, Math.min(1240, sx));
    const cy = Math.max(40, Math.min(680, sy));
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(Math.round(dist(G.player.x, G.player.y, mk.x, mk.y) / 4) + 'm', cx, cy - 14);
  }
}

function drawPeds(ctx, G) {
  const cam = G.cam;
  for (const ped of G.peds) {
    const sx = ped.x - cam.x, sy = ped.y - cam.y;
    if (sx < -20 || sx > 1300 || sy < -20 || sy > 740) continue;
    ctx.fillStyle = ped.fleeT > 0 ? '#ff5a3c' : ped.color;
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(sx, sy - 3, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawEnemies(ctx, G) {
  const cam = G.cam;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const sx = e.x - cam.x, sy = e.y - cam.y;
    if (sx < -40 || sx > 1320 || sy < -40 || sy > 760) continue;
    ctx.fillStyle = e.boss ? '#8a1a2e' : '#a33c2e';
    ctx.beginPath(); ctx.arc(sx, sy, e.boss ? 16 : 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(sx, sy - 4, 5, 0, Math.PI * 2); ctx.fill();
    // Bar HP musuh.
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 16, sy - (e.boss ? 28 : 24), 32, 4);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(sx - 16, sy - (e.boss ? 28 : 24), 32 * Math.max(0, e.hp / (e.boss ? 300 : 60)), 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.boss ? 'BOSS ROOK' : e.label, sx, sy + (e.boss ? 30 : 24));
  }
}

function drawCarShape(ctx, car, sx, sy, night) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-4, -car.wid / 2 + 3, 14, car.wid - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(car.len / 2 - 8, -car.wid / 2 + 3, 4, car.wid - 6);
  if (car.type === 'cruiser') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PSPD', 0, 3);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-car.len / 2 + 6, -car.wid / 2 - 2, 8, 4);
    ctx.fillStyle = '#4d8dff';
    ctx.fillRect(-car.len / 2 + 16, -car.wid / 2 - 2, 8, 4);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  // Lampu depan (malam): glow kuning di depan mobil.
  if (night) {
    ctx.fillStyle = 'rgba(255,240,170,0.9)';
    ctx.beginPath(); ctx.arc(car.len / 2 + 2, -6, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(car.len / 2 + 2, 6, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Sorot lampu depan malam (cone).
  if (night) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(car.len / 2, 0, car.len / 2 + 150, 0);
    grad.addColorStop(0, 'rgba(255,240,170,0.20)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.len / 2, -8);
    ctx.lineTo(car.len / 2 + 150, -42);
    ctx.lineTo(car.len / 2 + 150, 42);
    ctx.lineTo(car.len / 2, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Asap kerusakan.
  if (car.cond < 45) {
    ctx.fillStyle = 'rgba(120,120,125,0.5)';
    ctx.beginPath(); ctx.arc(sx - Math.cos(car.angle) * 10, sy - Math.sin(car.angle) * 10, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCars(ctx, G, night) {
  const cam = G.cam;
  for (const car of G.cars) {
    const sx = car.x - cam.x, sy = car.y - cam.y;
    if (sx < -90 || sx > 1370 || sy < -90 || sy > 810) continue;
    drawCarShape(ctx, car, sx, sy, night);
  }
  // Cruiser polisi (unit G.police) digambar juga sebagai mobil.
  for (const u of G.police) {
    if (u.kind !== 'cruiser' && u.kind !== 'roadblock') continue;
    const sx = u.x - cam.x, sy = u.y - cam.y;
    if (sx < -90 || sx > 1370 || sy < -90 || sy > 810) continue;
    drawCarShape(ctx, u, sx, sy, night);
  }
}

function drawPlayer(ctx, G, night) {
  const p = G.player;
  const cam = G.cam;
  if (p.inCar) {
    drawCarShape(ctx, p.inCar, p.inCar.x - cam.x, p.inCar.y - cam.y, night);
    return;
  }
  const sx = p.x - cam.x, sy = p.y - cam.y;
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(sx + 3, sy + 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1e5fa8';
  ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(sx, sy - 3, 5, 0, Math.PI * 2); ctx.fill();
  // Arah hadap + pistol.
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(p.angle) * 18, sy + Math.sin(p.angle) * 18); ctx.stroke();
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222';
    ctx.fillRect(sx + Math.cos(p.angle) * 14 - 3, sy + Math.sin(p.angle) * 14 - 2, 8, 4);
  }
  // Muzzle flash.
  if (G.combat.muzzleT > 0) {
    ctx.fillStyle = 'rgba(255,220,90,0.9)';
    ctx.beginPath();
    ctx.arc(sx + Math.cos(p.angle) * 26, sy + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCops(ctx, G) {
  const cam = G.cam;
  for (const u of G.police) {
    if (u.kind !== 'cop') continue;
    const sx = u.x - cam.x, sy = u.y - cam.y;
    if (sx < -20 || sx > 1300 || sy < -20 || sy > 740) continue;
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4d8dff';
    ctx.beginPath(); ctx.arc(sx, sy - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(u.name || 'Officer', sx, sy + 22);
  }
}

function drawHeli(ctx, G) {
  const heli = G.heli;
  if (!heli || !heli.active) return;
  const cam = G.cam;
  const sx = heli.x - cam.x, sy = heli.y - cam.y;
  // Spotlight cone ke pemain.
  const p = G.player;
  const px = p.x - cam.x, py = p.y - cam.y;
  const a = Math.atan2(py - sy, px - sx);
  const d = Math.hypot(px - sx, py - sy);
  const grad = ctx.createLinearGradient(sx, sy, px, py);
  grad.addColorStop(0, 'rgba(255,250,200,0.28)');
  grad.addColorStop(1, 'rgba(255,250,200,0.10)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(px + Math.cos(a + 0.28) * 55, py + Math.sin(a + 0.28) * 55);
  ctx.lineTo(px + Math.cos(a - 0.28) * 55, py + Math.sin(a - 0.28) * 55);
  ctx.closePath(); ctx.fill();
  // Lingkaran sorotan di tanah.
  ctx.strokeStyle = 'rgba(255,250,200,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px, py, 46, 0, Math.PI * 2); ctx.stroke();
  // Badan heli + rotor.
  ctx.fillStyle = '#22262e';
  ctx.beginPath(); ctx.ellipse(sx, sy, 20, 10, heli.angle, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(sx - 4, sy - 3, 8, 6);
  const rot = heli.rotorT * 22;
  ctx.strokeStyle = 'rgba(200,200,210,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx + Math.cos(rot) * 30, sy + Math.sin(rot) * 30);
  ctx.lineTo(sx - Math.cos(rot) * 30, sy - Math.sin(rot) * 30);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('AIR-1', sx, sy - 24);
}

function drawBullets(ctx, G) {
  const cam = G.cam;
  for (const b of G.combat.bullets) {
    ctx.strokeStyle = b.from === 'player' ? '#ffd76a' : '#ff8a7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - cam.x, b.y - cam.y);
    ctx.lineTo(b.x - b.vx * 0.02 - cam.x, b.y - b.vy * 0.02 - cam.y);
    ctx.stroke();
  }
}

function drawNightOverlay(ctx, G) {
  // Vignette malam tipis supaya lampu menonjol.
  const grad = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
  grad.addColorStop(0, 'rgba(10,8,25,0)');
  grad.addColorStop(1, 'rgba(10,8,25,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);
}

// ============================ HUD (overhaul v4) ============================

export function drawHUD(ctx, G) {
  const p = G.player;
  const hour = G.clockHour;
  ctx.textAlign = 'left';
  // --- Mission card kiri atas ---
  ctx.fillStyle = 'rgba(10,10,18,0.78)';
  ctx.fillRect(14, 12, 330, 96);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 12, 330, 96);
  ctx.fillStyle = '#ff2e88';
  ctx.font = 'bold 13px sans-serif';
  const mTitle = G.mission ? `MISSION ${G.mission.id}/12 — ${G.mission.title}` : 'FREE ROAM — PORT SOLANO';
  ctx.fillText(mTitle, 24, 32);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(missionStageText(G).slice(0, 44), 24, 52);
  // Progress bar stage.
  ctx.fillStyle = '#333';
  ctx.fillRect(24, 60, 310, 10);
  ctx.fillStyle = '#22e6ff';
  ctx.fillRect(24, 60, 310 * (G.mission ? G.mission.progress : 1), 10);
  ctx.fillStyle = '#bbb';
  ctx.font = '11px sans-serif';
  const next = G.missionMarker ? 'NEXT: ' + G.missionMarker.label : 'NEXT: —';
  ctx.fillText(next.slice(0, 48), 24, 88);
  // --- Panel police response (kiri, bawah mission card) ---
  const units = policePanelUnits(G);
  ctx.fillStyle = 'rgba(10,10,18,0.72)';
  ctx.fillRect(14, 116, 330, 34 + units.length * 20);
  ctx.fillStyle = G.wantedLevel > 0 ? '#ff3b30' : '#8affc1';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('PSPD RESPONSE' + (G.wantedLevel > 0 ? ` — ${G.wantedLevel}★` : ' — CLEAR'), 24, 136);
  ctx.font = '11px monospace';
  units.forEach((u, i) => {
    ctx.fillStyle = u.status === 'SPOTLIGHT' ? '#ffd76a' : '#fff';
    ctx.fillText(`${u.name.padEnd(12, ' ')} ${String(u.meters).padStart(4, ' ')}m  ${u.status}`, 24, 156 + i * 20);
  });
  if (units.length === 0) {
    ctx.fillStyle = '#bbb';
    ctx.fillText('Tidak ada unit mengejar.', 24, 156);
  }
  // Indikator spotlight.
  if (G.heli && G.heli.active && G.spotlightOn) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('⚠ SPOTLIGHT ON YOU — AIR-1', 24, 156 + units.length * 20);
  }
  // --- Bintang wanted + jam + distrik + radio (tengah atas) ---
  const day = G.day;
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  ctx.fillStyle = 'rgba(10,10,18,0.72)';
  ctx.fillRect(470, 12, 340, 52);
  ctx.font = 'bold 20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < G.wantedLevel ? '★' : '☆';
  ctx.fillStyle = '#ffd76a';
  ctx.textAlign = 'center';
  ctx.fillText(stars, 640, 34);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  const district = districtAt(p.x, p.y);
  ctx.fillText(`${district}  •  Day ${day}  •  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, 640, 54);
  ctx.textAlign = 'left';
  // Radio station (tengah atas, bawah jam).
  ctx.fillStyle = 'rgba(10,10,18,0.72)';
  ctx.fillRect(560, 70, 160, 24);
  ctx.fillStyle = '#22e6ff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('♪ ' + G.audio.stationName(), 640, 87);
  ctx.textAlign = 'left';
  // --- Minimap kanan atas ---
  drawMinimap(ctx, G, 1012, 12, 254, 168);
  // --- Uang + utang (kanan, bawah minimap) ---
  ctx.fillStyle = 'rgba(10,10,18,0.78)';
  ctx.fillRect(1012, 188, 254, 52);
  ctx.fillStyle = '#3fae5a';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 1022, 210);
  ctx.fillStyle = '#ff8a7a';
  ctx.font = '12px sans-serif';
  const debtLeft = Math.max(0, DEBT_TOTAL - G.debtPaid);
  ctx.fillText('Utang Kestrel: $' + debtLeft.toLocaleString('en-US'), 1022, 230);
  // --- Slot senjata + bar HP/armor/respect (kiri bawah) ---
  ctx.fillStyle = 'rgba(10,10,18,0.78)';
  ctx.fillRect(14, 596, 330, 110);
  ctx.font = 'bold 12px sans-serif';
  const slots = ['fists', 'pistol', 'smg', 'shotgun'];
  slots.forEach((w, i) => {
    const x = 24 + i * 78;
    const owned = p.owned[w];
    ctx.fillStyle = p.weapon === w ? '#ff2e88' : owned ? '#2a2a38' : '#1a1a22';
    ctx.fillRect(x, 606, 70, 34);
    ctx.strokeStyle = p.weapon === w ? '#fff' : '#555';
    ctx.strokeRect(x, 606, 70, 34);
    ctx.fillStyle = owned ? '#fff' : '#666';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText((i + 1) + ' ' + WEAPONS[w].label, x + 5, 620);
    ctx.font = '10px monospace';
    ctx.fillText(owned ? (w === 'fists' ? '∞' : String(p.ammo[w] || 0)) : '—', x + 5, 634);
  });
  // Bar HP / armor / respect.
  const bars = [
    ['HP', p.hp, '#3fae5a'],
    ['ARMOR', p.armor, '#4d8dff'],
    ['RESPECT', p.respect, '#ff2e88'],
  ];
  bars.forEach(([label, val, color], i) => {
    const y = 652 + i * 16;
    ctx.fillStyle = '#bbb';
    ctx.font = '10px sans-serif';
    ctx.fillText(label, 24, y + 3);
    ctx.fillStyle = '#333';
    ctx.fillRect(84, y - 6, 250, 9);
    ctx.fillStyle = color;
    ctx.fillRect(84, y - 6, 250 * Math.max(0, val) / 100, 9);
  });
  // --- Speedometer besar kanan bawah ---
  if (p.inCar) {
    const car = p.inCar;
    const kmh = Math.round(Math.abs(car.speed) * 0.31);
    ctx.fillStyle = 'rgba(10,10,18,0.8)';
    ctx.fillRect(1030, 600, 236, 106);
    ctx.strokeStyle = '#22e6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1030, 600, 236, 106);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(CAR_TYPES[car.type].label.toUpperCase(), 1042, 622);
    ctx.fillStyle = '#22e6ff';
    ctx.font = 'bold 44px monospace';
    ctx.fillText(String(kmh), 1042, 668);
    ctx.fillStyle = '#bbb';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('KM/H', 1140, 668);
    ctx.fillStyle = car.cond < 45 ? '#ff3b30' : '#8affc1';
    ctx.font = '12px sans-serif';
    ctx.fillText('Condition ' + Math.round(car.cond) + '%', 1042, 692);
    // Jarum kondisi.
    ctx.fillStyle = '#333';
    ctx.fillRect(1140, 684, 110, 8);
    ctx.fillStyle = car.cond < 45 ? '#ff3b30' : '#3fae5a';
    ctx.fillRect(1140, 684, 110 * car.cond / 100, 8);
  } else {
    ctx.fillStyle = 'rgba(10,10,18,0.7)';
    ctx.fillRect(1030, 600, 236, 106);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('ON FOOT', 1042, 622);
    ctx.fillStyle = '#bbb';
    ctx.font = '12px sans-serif';
    ctx.fillText('Deke Marlowe — jalan kaki', 1042, 648);
    ctx.fillText('E: naik mobil  •  R: radio', 1042, 672);
  }
  // --- Popup skor (DRIFT / NEAR MISS / MISSION COMPLETE) ---
  ctx.textAlign = 'center';
  G.popups.forEach((pp, i) => {
    const a = Math.max(0, 1 - pp.t / 2.2);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(pp.text, 640, 300 - i * 28 - pp.t * 22);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'left';
  // --- Prompt interaksi (E) ---
  if (G.interactPrompt && G.mode === 'play') {
    ctx.fillStyle = 'rgba(10,10,18,0.8)';
    ctx.fillRect(480, 640, 320, 30);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.interactPrompt, 640, 660);
    ctx.textAlign = 'left';
  }
  // --- Dialog bawah-tengah (potret canvas + nama + peran + teks) ---
  if (G.dialog) drawDialog(ctx, G);
  // --- Toko senjata overlay ---
  if (G.shop.open) drawShop(ctx, G);
}

// Potret karakter digambar canvas: lingkaran wajah + ciri khas.
function drawPortrait(ctx, x, y, name) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#2a2a38';
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Wajah.
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(0, 2, 15, 0, Math.PI * 2); ctx.fill();
  if (name.includes('Kestrel')) {
    // Madame Kestrel: rambut merah + anting emas.
    ctx.fillStyle = '#a3122e';
    ctx.beginPath(); ctx.arc(0, -4, 15, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(-13, 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, 4, 2, 0, Math.PI * 2); ctx.fill();
  } else if (name.includes('Rosa')) {
    // Rosa: bandana + kacamata.
    ctx.fillStyle = '#22e6ff';
    ctx.fillRect(-15, -10, 30, 7);
    ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.arc(-5, 2, 3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(6, 2, 3, 0, Math.PI * 2); ctx.stroke();
  } else if (name.includes('Rook')) {
    // Boss Rook: topi + janggut.
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-16, -12, 32, 6);
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.arc(0, 10, 9, 0, Math.PI); ctx.fill();
  } else if (name.includes('PSPD')) {
    // Polisi: topi dinas biru.
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.arc(0, -6, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#4d8dff';
    ctx.fillRect(-14, -8, 28, 5);
  } else {
    // Deke: rambut hitam + jaket biru.
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(0, -4, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#1e5fa8';
    ctx.fillRect(-15, 14, 30, 10);
  }
  // Mata.
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-5, 2, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6, 2, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawDialog(ctx, G) {
  const d = G.dialog;
  ctx.fillStyle = 'rgba(8,8,16,0.88)';
  ctx.fillRect(330, 596, 620, 110);
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = 2;
  ctx.strokeRect(330, 596, 620, 110);
  drawPortrait(ctx, 368, 640, d.name);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(d.name, 404, 624);
  ctx.fillStyle = '#bbb';
  ctx.font = '11px sans-serif';
  ctx.fillText(d.role, 404, 642);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  wrapText(ctx, d.text, 404, 664, 530, 17);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawShop(ctx, G) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#14141f';
  ctx.fillRect(390, 140, 500, 380);
  ctx.strokeStyle = '#ffc233';
  ctx.lineWidth = 2;
  ctx.strokeRect(390, 140, 500, 380);
  ctx.fillStyle = '#ffc233';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('IRONWORKS ARMS', 410, 175);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('Uang: $' + G.player.money.toLocaleString('en-US') + '   (↑↓ pilih, Enter beli, Esc tutup)', 410, 198);
  SHOP_ITEMS.forEach((item, i) => {
    const y = 225 + i * 62;
    const owned = (item.id === 'smg' || item.id === 'shotgun') && G.player.owned[item.id];
    ctx.fillStyle = G.shop.selected === i ? '#2a2a44' : '#1c1c28';
    ctx.fillRect(410, y, 460, 52);
    if (G.shop.selected === i) { ctx.strokeStyle = '#fff'; ctx.strokeRect(410, y, 460, 52); }
    ctx.fillStyle = owned ? '#8affc1' : '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(item.label + (owned ? '  ✓ DIMILIKI' : ''), 422, y + 20);
    ctx.fillStyle = '#bbb';
    ctx.font = '12px sans-serif';
    ctx.fillText(item.desc, 422, y + 40);
    ctx.fillStyle = '#3fae5a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('$' + item.price, 800, y + 28);
  });
  ctx.fillStyle = '#ffd76a';
  ctx.font = '13px sans-serif';
  ctx.fillText(G.shop.message, 410, 490);
}

// Minimap: kota mini, blip pemain/mobil/misi/polisi/heli.
// Revisi: marker misi pink digambar di atas jalan supaya selalu kelihatan.
function drawMinimap(ctx, G, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,8,16,0.85)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#555';
  ctx.strokeRect(x, y, w, h);
  const sx = w / WORLD_W, sy = h / WORLD_H;
  const px = (wx) => x + wx * sx;
  const py = (wy) => y + wy * sy;
  // Jalan.
  ctx.fillStyle = '#55555f';
  for (const vx of ROADS_V) ctx.fillRect(px(vx - 8), y, 16 * sx, h);
  for (const hy of ROADS_H) ctx.fillRect(x, py(hy - 8), w, 16 * sy);
  // Pantai.
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(px(2165), y, w - (px(2165) - x), h);
  // Marker misi (pink).
  if (G.missionMarker) {
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(px(G.missionMarker.x), py(G.missionMarker.y), 5, 0, Math.PI * 2); ctx.fill();
  }
  // Polisi (biru) + heli (kuning).
  for (const u of G.police) {
    ctx.fillStyle = u.kind === 'roadblock' ? '#ff3b30' : '#4d8dff';
    ctx.fillRect(px(u.x) - 2, py(u.y) - 2, 4, 4);
  }
  if (G.heli && G.heli.active) {
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(px(G.heli.x), py(G.heli.y), 4, 0, Math.PI * 2); ctx.fill();
  }
  // Musuh (merah).
  ctx.fillStyle = '#ff3b30';
  for (const e of G.enemies) if (e.alive) ctx.fillRect(px(e.x) - 2, py(e.y) - 2, 4, 4);
  // Pemain (putih, panah arah).
  const p = G.player;
  ctx.save();
  ctx.translate(px(p.x), py(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#bbb';
  ctx.font = '10px sans-serif';
  ctx.fillText('N ↑', x + 6, y + 12);
}

// Layar title / pause / busted / wasted / complete (overlay penuh).
export function drawScreen(ctx, G, kind) {
  ctx.fillStyle = 'rgba(8,6,20,0.82)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  if (kind === 'title') {
    ctx.fillStyle = '#ff2e88';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText('NEON TIDE', 640, 250);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22e6ff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('OPEN-WORLD CRIME IN PORT SOLANO', 640, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Deke Marlowe berutang $50.000 pada Madame Kestrel.', 640, 350);
    ctx.fillText('12 misi. 5 distrik. 1 kota yang tidak pernah tidur.', 640, 380);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('ENTER — New Game      C — Continue', 640, 460);
    ctx.fillStyle = '#bbb';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD jalan / mengemudi • Shift lari • E naik mobil / interaksi • Space handbrake', 640, 510);
    ctx.fillText('Mouse aim • Klik tembak • 1-4 ganti senjata • R radio • Esc pause', 640, 536);
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('Game orisinal — semua nama, karakter, dan musik dibuat sendiri. Bukan GTA.', 640, 660);
  } else if (kind === 'pause') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PAUSED', 640, 320);
    ctx.font = '18px sans-serif';
    ctx.fillText('Esc — lanjut main      M — misi berikutnya (debug: tidak)', 640, 370);
    ctx.fillText(`Misi ${G.missionsDone}/12 selesai  •  $${G.player.money.toLocaleString('en-US')}  •  Day ${G.day}`, 640, 410);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#4d8dff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('BUSTED!', 640, 320);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('PSPD menangkapmu. Denda $100. Dibebaskan di PSPD Central.', 640, 370);
    ctx.fillText('ENTER — lanjut main', 640, 420);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('WASTED', 640, 320);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Deke tumbang. Dirawat di Solano General, uang berkurang $100.', 640, 370);
    ctx.fillText('ENTER — lanjut main', 640, 420);
  } else if (kind === 'complete') {
    ctx.fillStyle = '#ffd76a';
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 24;
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('TIDE TURNS', 640, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('Boss Rook tumbang. Pelabuhan milikmu. Utang lunas.', 640, 360);
    ctx.fillText(`12/12 misi selesai  •  $${G.player.money.toLocaleString('en-US')}  •  Day ${G.day}`, 640, 400);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ENTER — free roam Port Solano', 640, 470);
  }
  ctx.textAlign = 'left';
}
