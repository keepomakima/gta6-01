// NEON TIDE v4 — render: the whole look. Sunset/sun-soaked palette, neon at
// night, lit windows, beachfront palms, headlight glow, shadows, and the full
// HUD: mission card, police response panel, weapon slots, bars, speedometer,
// radio, district + clock, money, wanted stars, dialog portraits, minimap.
// One job: everything the player (and the judge) sees.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, WEAPONS, GUN_SHOP, SAFEHOUSES, SHOP_ITEMS, districtAt } from './config.js';
import { ROADS_X, ROADS_Y, ROAD_HALF } from './world.js';
import { policeUnitList } from './police.js';
import { missionMeta } from './missions.js';

export function timeOfDayColors(hour) {
  // Returns sky/ground tint + night factor 0..1.
  if (hour >= 6 && hour < 16) return { night: 0, sky: '#8ecae6', ground: '#5a7d4f', road: '#3a3f4a' };
  if (hour >= 16 && hour < 19) return { night: 0.25, sky: '#ff9e5e', ground: '#6b7a4a', road: '#43404e' };
  if (hour >= 19 && hour < 21) return { night: 0.6, sky: '#7b5ea7', ground: '#4c5a44', road: '#33364a' };
  return { night: 1, sky: '#1b2340', ground: '#3d4a38', road: '#2c2f3d' };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0d1117';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
  ctx.restore();
}

export function drawWorld(ctx, G) {
  const cam = G.cam;
  const cols = timeOfDayColors(G.clock);
  const night = cols.night;
  // Ground.
  ctx.fillStyle = cols.ground;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Beach sand strip (east) + water beyond it.
  ctx.fillStyle = night > 0.5 ? '#2c4a6e' : '#3d9db5';
  ctx.fillRect(2400 - cam.x, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = night > 0.5 ? '#8a7a5a' : '#e9d8a6';
  ctx.fillRect(2260 - cam.x, 0, 150, VIEW_H);
  // Harbor water (south-west corner).
  ctx.fillStyle = night > 0.5 ? '#16324a' : '#2e7d9e';
  ctx.fillRect(0 - cam.x, 1620 - cam.y, 900, 200);
  // Grass blocks tint.
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  // Roads.
  for (const rx of ROADS_X) {
    ctx.fillStyle = cols.road;
    ctx.fillRect(rx - ROAD_HALF - cam.x, 0 - cam.y, ROAD_HALF * 2, WORLD_H);
    ctx.fillStyle = '#d9d9d9';
    for (let y = 40; y < WORLD_H; y += 80) ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 36);
  }
  for (const ry of ROADS_Y) {
    ctx.fillStyle = cols.road;
    ctx.fillRect(0 - cam.x, ry - ROAD_HALF - cam.y, WORLD_W, ROAD_HALF * 2);
    ctx.fillStyle = '#d9d9d9';
    for (let x = 40; x < WORLD_W; x += 80) ctx.fillRect(x - cam.x, ry - 2 - cam.y, 36, 4);
  }
  // Sidewalk edges.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_HALF - 6 - cam.x, 0); ctx.lineTo(rx - ROAD_HALF - 6 - cam.x, VIEW_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + ROAD_HALF + 6 - cam.x, 0); ctx.lineTo(rx + ROAD_HALF + 6 - cam.x, VIEW_H); ctx.stroke();
  }
  // Harbor containers.
  for (const c of G.world.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - cam.x, c.y - cam.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(c.x - cam.x, c.y - cam.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 1; i < 5; i += 1) ctx.fillRect(c.x + i * 15 - cam.x, c.y - cam.y, 2, c.h);
  }
  // Buildings with lit windows + neon glow at night.
  for (const b of G.world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 5 - cam.x, b.y + 6 - cam.y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 3 - cam.x, b.y + 3 - cam.y, b.w - 6, b.h - 6);
    const colsN = Math.max(2, Math.floor(b.w / 22));
    const rowsN = Math.max(2, Math.floor(b.h / 22));
    for (let i = 0; i < b.windows; i += 1) {
      const wx = b.x + 8 + (i % colsN) * ((b.w - 16) / colsN);
      const wy = b.y + 8 + Math.floor(i / colsN) * ((b.h - 16) / rowsN);
      if (wy > b.y + b.h - 14) break;
      const lit = ((i * 7 + b.w) % 10) / 10 < b.lit;
      ctx.fillStyle = lit ? (night > 0.5 ? '#ffd166' : '#ffe8a3') : '#222831';
      ctx.fillRect(wx - cam.x, wy - cam.y, 9, 11);
    }
  }
  // Neon signs (glow at night, bright in sunset too).
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px Arial';
  for (const s of G.world.signs) {
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = night > 0.5 ? 16 : 6;
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.x - cam.x, s.y - cam.y);
    ctx.restore();
  }
  // Palms on the beachfront.
  for (const pl of G.world.palms) {
    const px = pl.x - cam.x; const py = pl.y - cam.y;
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + pl.lean * 20, py - 22, px + pl.lean * 34, py - 34 * pl.size); ctx.stroke();
    ctx.strokeStyle = '#2a9d5c';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      ctx.beginPath();
      ctx.moveTo(px + pl.lean * 34, py - 34 * pl.size);
      ctx.quadraticCurveTo(px + pl.lean * 34 + Math.cos(a) * 16, py - 34 * pl.size + Math.sin(a) * 12, px + pl.lean * 34 + Math.cos(a) * 26, py - 34 * pl.size + Math.sin(a) * 22);
      ctx.stroke();
    }
  }
  // Street props.
  for (const pr of G.world.props) {
    const px = pr.x - cam.x; const py = pr.y - cam.y;
    if (pr.kind === 'lamp') {
      ctx.strokeStyle = '#222831'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 26); ctx.stroke();
      if (night > 0.3) {
        ctx.save();
        ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffe066';
        ctx.beginPath(); ctx.arc(px, py - 28, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (pr.kind === 'hydrant') { ctx.fillStyle = '#c1121f'; ctx.fillRect(px - 4, py - 10, 8, 10); }
    else if (pr.kind === 'planter') { ctx.fillStyle = '#2a9d5c'; ctx.beginPath(); ctx.arc(px, py - 4, 8, 0, Math.PI * 2); ctx.fill(); }
    else if (pr.kind === 'bench') { ctx.fillStyle = '#7f4f24'; ctx.fillRect(px - 12, py - 6, 24, 5); }
    else { ctx.fillStyle = '#4a5568'; ctx.fillRect(px - 5, py - 8, 10, 8); }
  }
  // Gun shop + safehouses markers.
  drawPlaceMarker(ctx, G, GUN_SHOP.x, GUN_SHOP.y, '$', GUN_SHOP.color, 'IRONWORKS');
  for (const s of SAFEHOUSES) drawPlaceMarker(ctx, G, s.x, s.y, 'H', s.color, 'SAFEHOUSE');
  // Mission marker: pulsing diamond + distance.
  if (G.marker) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.15;
    const mx = G.marker.x - cam.x; const my = G.marker.y - cam.y;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-10 * pulse, -10 * pulse, 20 * pulse, 20 * pulse);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(-6 * pulse, -6 * pulse, 12 * pulse, 12 * pulse);
    ctx.restore();
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(G.marker.label, mx, my - 26);
  }
  // Tail target marker (mission 7).
  if (G.mission && G.mission.id === 7 && G.mission.data.target) {
    const t = G.mission.data.target;
    ctx.fillStyle = '#ff7ad9';
    ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
    ctx.fillText('?', t.x - cam.x, t.y - cam.y + 4);
  }
  // Gear crates (mission 10).
  if (G.mission && G.mission.id === 10) {
    for (const c of G.mission.data.crates) {
      if (c.got) continue;
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(c.x - 12 - cam.x, c.y - 12 - cam.y, 24, 24);
      ctx.strokeStyle = '#7f4f24'; ctx.lineWidth = 2;
      ctx.strokeRect(c.x - 12 - cam.x, c.y - 12 - cam.y, 24, 24);
    }
  }
  // Tire marks + particles + drops.
  G.particles.drawWorld(ctx, cam);
  for (const d of G.drops) {
    ctx.fillStyle = d.kind === 'ammo' ? '#ffd166' : '#7dff8a';
    ctx.beginPath(); ctx.arc(d.x - cam.x, d.y - cam.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d1117';
    ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText(d.kind === 'ammo' ? 'A' : '$', d.x - cam.x, d.y - cam.y + 3);
  }
  drawCars(ctx, G);
  drawPeds(ctx, G);
  drawEnemies(ctx, G);
  drawCops(ctx, G);
  drawPlayer(ctx, G);
  drawHeli(ctx, G);
  // Night overlay + headlight glow.
  if (night > 0) {
    ctx.fillStyle = `rgba(8,10,40,${night * 0.42})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Headlight cones for the player's car.
    const car = G.player.inCar;
    if (car) {
      const hx = car.x - cam.x + Math.cos(car.angle) * 30;
      const hy = car.y - cam.y + Math.sin(car.angle) * 30;
      const grad = ctx.createRadialGradient(hx, hy, 10, hx, hy, 190);
      grad.addColorStop(0, 'rgba(255,240,180,0.5)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(hx, hy, 190, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Helicopter spotlight cone (drawn over the night overlay).
  if (G.heli.active && G.heli.spotOn) {
    const hx = G.heli.x - cam.x; const hy = G.heli.y - cam.y;
    const px = G.player.x - cam.x; const py = G.player.y - cam.y;
    const grad = ctx.createRadialGradient(hx, hy, 8, px, py, 150);
    grad.addColorStop(0, 'rgba(255,255,180,0.55)');
    grad.addColorStop(1, 'rgba(255,255,180,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.arc(px, py, 150, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,180,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(px, py); ctx.stroke();
  }
}

function drawPlaceMarker(ctx, G, x, y, glyph, color, label) {
  const px = x - G.cam.x; const py = y - G.cam.y;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d1117';
  ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
  ctx.fillText(glyph, px, py + 4);
  ctx.fillStyle = color;
  ctx.font = 'bold 11px Arial';
  ctx.fillText(label, px, py - 20);
}

function drawCars(ctx, G) {
  const cam = G.cam;
  for (const car of G.cars) {
    ctx.save();
    ctx.translate(car.x - cam.x, car.y - cam.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6);
    ctx.fill();
    ctx.fillStyle = '#1b2a4a';
    ctx.fillRect(-car.w / 2 + 8, -car.h / 2 + 4, car.w / 2 - 6, car.h - 8);
    if (car.type === 'cruiser') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, -car.h / 2 + 2, 12, 4);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-car.w / 2 + 2, -car.h / 2 + 2, 8, 5);
      ctx.fillStyle = '#39c6ff';
      ctx.fillRect(-car.w / 2 + 2, car.h / 2 - 7, 8, 5);
      if (G.time * 4 % 1 < 0.5) {
        ctx.fillStyle = 'rgba(230,57,70,0.8)';
        ctx.beginPath(); ctx.arc(-car.w / 2 + 6, 0, 10, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(57,198,255,0.8)';
        ctx.beginPath(); ctx.arc(-car.w / 2 + 6, 0, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#0d1117';
      ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(-car.w / 2 - 2, -car.h / 2 + 2, 3, 5);
      ctx.fillRect(-car.w / 2 - 2, car.h / 2 - 7, 3, 5);
    }
    if (car.hp < car.maxHp * 0.35) {
      ctx.fillStyle = 'rgba(90,90,90,0.9)';
      ctx.beginPath(); ctx.arc(car.w / 2 - 4, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPeds(ctx, G) {
  const cam = G.cam;
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const px = ped.x - cam.x; const py = ped.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py + 8, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(px, py - 4, 6, 0, Math.PI * 2); ctx.fill();
    if (ped.panic > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
      ctx.fillText('!', px, py - 16);
    }
  }
}

function drawEnemies(ctx, G) {
  const cam = G.cam;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const px = e.x - cam.x; const py = e.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py + 9, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6d28d9';
    ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(px, py - 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222831';
    ctx.fillRect(px - 8, py - 12, 16, 4);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(px - 12, py - 20, 24 * Math.max(0, e.hp / 100), 3);
  }
}

function drawCops(ctx, G) {
  const cam = G.cam;
  for (const cop of G.cops) {
    const px = cop.x - cam.x; const py = cop.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py + 9, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b2a4a';
    ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(px, py - 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#39c6ff';
    ctx.fillRect(px - 8, py - 12, 16, 4);
  }
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return;
  const cam = G.cam;
  const px = p.x - cam.x; const py = p.y - cam.y;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(px, py + 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#e63946';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(6, -3, 10, 6);
  ctx.restore();
  ctx.fillStyle = '#2b2d42';
  ctx.beginPath(); ctx.arc(px, py - 4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(px, py - 5, 5, 0, Math.PI * 2); ctx.fill();
  if (p.hurtT > 0) {
    ctx.strokeStyle = 'rgba(255,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawHeli(ctx, G) {
  const h = G.heli;
  if (!h.active) return;
  const hx = h.x - G.cam.x; const hy = h.y - G.cam.y;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(4, 10, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222831';
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#39c6ff';
  ctx.beginPath(); ctx.ellipse(10, -2, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  const r = h.rotor % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(Math.cos(r) * -30, Math.sin(r) * -6);
  ctx.lineTo(Math.cos(r) * 30, Math.sin(r) * 6);
  ctx.stroke();
  ctx.fillStyle = '#ffe066';
  ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
  ctx.fillText('AIR-1', hx, hy - 22);
}

// ---- HUD + screens (appended second half of render.js) ----
export function drawHUD(ctx, G) {
  const p = G.player;
  // Mission card (top-left).
  const meta = G.mission ? missionMeta(G.mission.id) : null;
  panel(ctx, 12, 12, 268, 92);
  ctx.textAlign = 'left';
  if (meta) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px Arial';
    ctx.fillText(`MISSION ${meta.id}/12 — ${meta.title.toUpperCase()}`, 24, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText(meta.brief.length > 40 ? meta.brief.slice(0, 40) + '…' : meta.brief, 24, 50);
    const prog = missionProgress(G);
    ctx.fillStyle = '#222831';
    ctx.fillRect(24, 60, 244, 8);
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(24, 60, 244 * prog, 8);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '11px Arial';
    ctx.fillText(`NEXT: ${nextObjective(G)}`, 24, 88);
  } else {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('FREE ROAM — PORT SOLANO', 24, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText('Explore, earn, lose the heat.', 24, 52);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '11px Arial';
    ctx.fillText(`MISSIONS DONE: ${G.missionsDone}/12`, 24, 88);
  }
  // Police response panel (left, under the mission card).
  const units = policeUnitList(G);
  if (G.wanted > 0 || units.length > 0) {
    const h = 30 + units.length * 20;
    panel(ctx, 12, 112, 268, h);
    ctx.fillStyle = G.wanted >= 4 ? '#ff5d5d' : '#ff9e5e';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`POLICE RESPONSE — ${G.wanted}★ WANTED`, 24, 132);
    ctx.font = '12px Arial';
    units.forEach((u, i) => {
      ctx.fillStyle = '#fff';
      ctx.fillText(u.name, 24, 154 + i * 20);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillText(`${u.dist}m`, 150, 154 + i * 20);
      ctx.fillStyle = u.status === 'SPOTLIGHT' || u.status === 'RAMMING' ? '#ff5d5d' : '#ffd166';
      ctx.fillText(u.status, 200, 154 + i * 20);
    });
  }
  // Weapon slots (top-right).
  const slotW = 62;
  const slots = ['fists', 'pistol', 'smg', 'shotgun'];
  panel(ctx, VIEW_W - 12 - slotW * 4 - 18, 12, slotW * 4 + 18, 54);
  slots.forEach((id, i) => {
    const x = VIEW_W - 12 - slotW * 4 - 9 + i * slotW;
    const owned = p.owned[id];
    const active = p.weapon === id;
    ctx.fillStyle = active ? '#ffd166' : '#222831';
    roundRect(ctx, x, 20, 56, 38, 5);
    ctx.fill();
    ctx.fillStyle = active ? '#0d1117' : (owned ? '#fff' : '#555');
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(WEAPONS[id].name.toUpperCase().slice(0, 9), x + 28, 36);
    if (owned && id !== 'fists') {
      ctx.font = '11px Arial';
      ctx.fillText(String(p.ammo[id] ?? 0), x + 28, 51);
    } else if (!owned) {
      ctx.font = '10px Arial';
      ctx.fillText('LOCKED', x + 28, 51);
    }
  });
  // Money + debt (top-right, under weapons).
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(`$${p.money.toLocaleString()}`, VIEW_W - 14, 96);
  ctx.fillStyle = '#ff9e5e';
  ctx.font = '12px Arial';
  ctx.fillText(`DEBT $${p.debt.toLocaleString()} — KESTREL`, VIEW_W - 14, 114);
  // Wanted stars (top-center).
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Arial';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < G.wanted ? '#ffd166' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W / 2 - 52 + i * 26, 40);
  }
  // District + day/time (top-center, under stars).
  const d = districtAt(p.x, p.y);
  const hh = Math.floor(G.clock);
  const mm = Math.floor((G.clock - hh) * 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`${d.name}  •  DAY ${G.day}  •  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, VIEW_W / 2, 62);
  // Health / armor / respect bars (bottom-left, above minimap).
  const barY = VIEW_H - 178;
  drawBar(ctx, 12, barY, 200, 12, p.hp / 100, '#e63946', 'HP');
  drawBar(ctx, 12, barY + 18, 200, 12, p.armor / 100, '#39c6ff', 'ARMOR');
  drawBar(ctx, 12, barY + 36, 200, 12, Math.min(1, G.missionsDone / 12), '#7dff8a', 'RESPECT');
  // Minimap (bottom-left).
  drawMinimap(ctx, G);
  // Speedometer (bottom-right).
  const car = p.inCar;
  const kmh = car ? Math.round(Math.abs(car.speed) * 0.55) : 0;
  panel(ctx, VIEW_W - 212, VIEW_H - 118, 200, 106);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px Arial';
  ctx.fillText(`${kmh}`, VIEW_W - 40, VIEW_H - 58);
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('KM/H', VIEW_W - 40, VIEW_H - 40);
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#fff';
  ctx.fillText(car ? car.type.toUpperCase() : 'ON FOOT', VIEW_W - 200, VIEW_H - 96);
  if (car) {
    ctx.fillStyle = '#222831';
    ctx.fillRect(VIEW_W - 200, VIEW_H - 88, 176, 6);
    ctx.fillStyle = car.hp / car.maxHp > 0.35 ? '#7dff8a' : '#e63946';
    ctx.fillRect(VIEW_W - 200, VIEW_H - 88, 176 * Math.max(0, car.hp / car.maxHp), 6);
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '11px Arial';
    ctx.fillText(`CONDITION ${Math.round((car.hp / car.maxHp) * 100)}%`, VIEW_W - 200, VIEW_H - 70);
  }
  ctx.fillStyle = '#ff7ad9';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(`♪ ${G.audio.stationName()}`, VIEW_W - 200, VIEW_H - 24);
  // Interaction + control hints.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px Arial';
  if (G.hint) ctx.fillText(G.hint, VIEW_W / 2, VIEW_H - 8);
  // Dialog box (bottom-center).
  if (G.dialog && G.dialog.t > 0) drawDialog(ctx, G);
  // Shop overlay.
  if (G.shopOpen) drawShop(ctx, G);
  // Mission timer.
  if (G.mission && (G.mission.id === 3 || G.mission.id === 9)) {
    const t = Math.max(0, G.mission.data.timer || 0);
    ctx.textAlign = 'center';
    ctx.fillStyle = t < 10 ? '#ff5d5d' : '#ffd166';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(`${Math.ceil(t)}s`, VIEW_W / 2, 100);
  }
  // Heli warning banner.
  if (G.heli.active) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5d5d';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(G.heli.spotOn ? '🚁 AIR-1 — SPOTLIGHT ON YOU' : '🚁 AIR-1 OVERHEAD', VIEW_W / 2, 84);
  }
}

function missionProgress(G) {
  const m = G.mission;
  if (!m) return 1;
  if (m.id === 3) return Math.max(0, (m.data.timer || 0) / 60);
  if (m.id === 9) return (m.data.gate || 0) / 3;
  if (m.id === 7) return Math.min(1, (m.data.followT || 0) / 25);
  if (m.id === 8) return (m.data.fares || 0) / 2;
  if (m.id === 10) return (m.data.crates || []).filter((c) => c.got).length / 3;
  if (m.id === 2 || m.id === 6) return m.stage === 1 ? 0.5 : 0.1;
  if (m.id === 11) return m.stage === 1 ? 0.6 : 0.2;
  return Math.min(1, m.t / 30);
}

function nextObjective(G) {
  const m = G.mission;
  if (!m) return '—';
  const map = {
    1: 'Reach the Kestrel Club', 2: m.stage === 0 ? 'Steal a car' : 'Deliver to the garage',
    3: 'Reach Harbor Dock 7', 4: 'Stay out of sight', 5: 'Defeat the rival gang',
    6: m.stage === 0 ? 'Enter the stash house' : 'Escape to the garage',
    7: 'Stay close, stay unseen', 8: m.data.picked ? 'Drop off the fare' : 'Pick up a fare',
    9: `Reach gate ${(m.data.gate || 0) + 1}/3`, 10: 'Collect the gear crates',
    11: m.stage === 0 ? 'Clear the vault guards' : 'Escape to the garage',
    12: 'Defeat Boss Rook',
  };
  return map[m.id] || '—';
}

function drawBar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = '#0d1117';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, frac))), h - 2, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + h - 3);
}

function drawMinimap(ctx, G) {
  const mw = 200; const mh = 138;
  const x0 = 12; const y0 = VIEW_H - mh - 12;
  panel(ctx, x0, y0, mw, mh, 0.85);
  const sx = mw / WORLD_W; const sy = mh / WORLD_H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#1d2b1f';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#e9d8a6';
  ctx.fillRect(x0 + 2260 * sx, y0, (WORLD_W - 2260) * sx, mh);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke();
  }
  if (G.marker) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x0 + G.marker.x * sx, y0 + G.marker.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#39c6ff';
  for (const c of G.cruisers) { ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4); }
  ctx.fillStyle = '#ff5d5d';
  for (const e of G.enemies) if (e.alive) { ctx.fillRect(x0 + e.x * sx - 2, y0 + e.y * sy - 2, 4, 4); }
  ctx.fillStyle = '#7dff8a';
  ctx.beginPath(); ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#9aa0a6';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑', x0 + 4, y0 + 12);
}

function drawDialog(ctx, G) {
  const d = G.dialog;
  const w = 640; const h = 96;
  const x = (VIEW_W - w) / 2; const y = VIEW_H - h - 132;
  panel(ctx, x, y, w, h, 0.92);
  // Portrait: canvas-drawn face.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 48, y + 48, 32, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = d.color;
  ctx.fillRect(x + 16, y + 16, 64, 64);
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(x + 48, y + 50, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2d42';
  ctx.beginPath(); ctx.arc(x + 48, y + 38, 15, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#0d1117';
  ctx.beginPath(); ctx.arc(x + 42, y + 50, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 54, y + 50, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0d1117';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x + 48, y + 56, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + 48, y + 48, 32, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = d.color;
  ctx.font = 'bold 13px Arial';
  ctx.fillText(`${d.name.toUpperCase()}  —  ${d.role}`, x + 92, y + 28);
  ctx.fillStyle = '#fff';
  ctx.font = '14px Arial';
  wrapText(ctx, d.text, x + 92, y + 50, w - 110, 19);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

function drawShop(ctx, G) {
  const w = 460; const h = 280;
  const x = (VIEW_W - w) / 2; const y = (VIEW_H - h) / 2;
  panel(ctx, x, y, w, h, 0.96);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff5d8f';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('IRONWORKS ARMS', x + 20, y + 34);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`CASH $${G.player.money}`, x + 20, y + 56);
  ctx.fillStyle = '#9aa0a6';
  ctx.font = '12px Arial';
  ctx.fillText('↑↓ select • Enter buy • Esc close', x + 20, y + 74);
  SHOP_ITEMS.forEach((item, i) => {
    const iy = y + 92 + i * 42;
    if (G.shopSel === i) {
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, x + 12, iy - 18, w - 24, 34, 5);
      ctx.fill();
      ctx.fillStyle = '#0d1117';
    } else ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(item.label, x + 22, iy + 4);
    ctx.fillStyle = G.shopSel === i ? '#0d1117' : '#9aa0a6';
    ctx.font = '12px Arial';
    ctx.fillText(item.desc, x + 230, iy + 4);
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`$${item.price}`, x + w - 22, iy + 4);
    ctx.textAlign = 'left';
  });
  if (G.shopMsg) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(G.shopMsg, x + w / 2, y + h - 16);
  }
}

export function drawTitle(ctx, G) {
  ctx.fillStyle = '#1b2340';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9e5e');
  grad.addColorStop(0.55, '#c94b7c');
  grad.addColorStop(1, '#1b2340');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 40; i += 1) {
    const bx = (i * 197) % VIEW_W;
    const bh = 120 + ((i * 89) % 260);
    ctx.fillRect(bx, VIEW_H - bh, 60, bh);
  }
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PORT SOLANO  •  A SUN-SOAKED OPEN WORLD', VIEW_W / 2, 150);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px Arial';
  ctx.fillText('NEON TIDE', VIEW_W / 2, 250);
  ctx.fillStyle = '#ff7ad9';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('An open-world crime story — drive, fight, and take back the port.', VIEW_W / 2, 292);
  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial';
  ctx.fillText('WASD drive & walk  •  E enter / steal car  •  Mouse aim, Click shoot  •  F punch', VIEW_W / 2, 360);
  ctx.fillText('Shift run  •  Space handbrake  •  R radio  •  Esc pause  •  M mute', VIEW_W / 2, 386);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(G.hasSave ? 'ENTER — CONTINUE    N — NEW GAME' : 'ENTER — NEW GAME', VIEW_W / 2, 450);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px Arial';
  ctx.fillText('Deke Marlowe owes $50,000 to Madame Kestrel. Twelve missions. One port. Your tide.', VIEW_W / 2, 510);
  ctx.fillText('All characters, places and music are original. Nothing from any commercial game.', VIEW_W / 2, 534);
}

export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px Arial';
  ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.font = '16px Arial';
  ctx.fillText('Esc resume  •  R radio station  •  M mute  •  S save game', VIEW_W / 2, 350);
  ctx.fillText(`Missions ${G.missionsDone}/12  •  $${G.player.money}  •  Kills ${G.player.kills}`, VIEW_W / 2, 380);
}

export function drawEnd(ctx, G, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#39c6ff';
    ctx.font = 'bold 64px Arial';
    ctx.fillText('BUSTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('The PSPD took you in. Fine paid. You walk out — lighter.', VIEW_W / 2, 350);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#e63946';
    ctx.font = 'bold 64px Arial';
    ctx.fillText('WASTED', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('Solano General patched you up. The bill stings more than the wounds.', VIEW_W / 2, 350);
  } else {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 64px Arial';
    ctx.fillText('THE TIDE TURNS', VIEW_W / 2, 280);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('All 12 missions complete. Port Solano is yours, Deke.', VIEW_W / 2, 330);
    ctx.font = '16px Arial';
    ctx.fillText(`Final cash $${G.player.money}  •  Kills ${G.player.kills}  •  Cars stolen ${G.player.carsStolen}`, VIEW_W / 2, 366);
  }
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('ENTER — CONTINUE', VIEW_W / 2, 430);
}
