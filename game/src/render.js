// NEON TIDE — render.js
// Everything the player sees: the city, the cars, the people, the day/night
// lighting, the HUD with its minimap, and the title / pause / busted /
// wasted / story-complete screens. All drawing is plain canvas 2D.

import {
  WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_W, SKY_TINTS, CAR_TYPES,
} from './config.js';
import { clamp, lerp, dist } from './random.js';
import { districtAt, onRoad } from './world.js';
import { drawParticles } from './particles.js';
import { objectiveText } from './missions.js';
import { aimTarget } from './combat.js';

const VIEW_W = 1280;
const VIEW_H = 720;

// Interpolate the sky tint for the current hour of the day.
export function skyTint(hour) {
  let a = SKY_TINTS[0];
  let b = SKY_TINTS[SKY_TINTS.length - 1];
  for (let i = 0; i < SKY_TINTS.length - 1; i += 1) {
    if (hour >= SKY_TINTS[i].h && hour <= SKY_TINTS[i + 1].h) {
      a = SKY_TINTS[i];
      b = SKY_TINTS[i + 1];
      break;
    }
  }
  const span = Math.max(0.001, b.h - a.h);
  const t = clamp((hour - a.h) / span, 0, 1);
  return [
    lerp(a.tint[0], b.tint[0], t),
    lerp(a.tint[1], b.tint[1], t),
    lerp(a.tint[2], b.tint[2], t),
    lerp(a.tint[3], b.tint[3], t),
  ];
}

export function isNight(hour) {
  return hour < 6 || hour >= 19.5;
}

function clockText(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Main draw entry. ctx is the 2D context of the 1280x720 canvas.
export function draw(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  // Screen shake.
  if (G.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  }
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawGround(ctx, G);
  drawMarks(ctx, G);
  drawPickups(ctx, G);
  drawCars(ctx, G);
  drawPeople(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  drawMarker(ctx, G);
  drawMuzzle(ctx, G);
  ctx.restore();
  drawLighting(ctx, G);
  if (G.mode === 'title') { drawTitle(ctx, G); return; }
  drawHUD(ctx, G);
  drawMinimap(ctx, G);
  drawDialog(ctx, G);
  drawMessages(ctx, G);
  if (G.mode === 'pause') drawPause(ctx, G);
  if (G.mode === 'busted') drawEndScreen(ctx, G, 'BUSTED', '#5a8cff', G.bustedInfo);
  if (G.mode === 'wasted') drawEndScreen(ctx, G, 'WASTED', '#ff5a5a', G.wastedInfo);
  if (G.mode === 'complete') drawComplete(ctx, G);
  if (G.missionFlash) drawMissionFlash(ctx, G);
}

function drawGround(ctx, G) {
  const w = G.world;
  const cam = G.camera;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD_W, cam.x + VIEW_W + 40);
  const y1 = Math.min(WORLD_H, cam.y + VIEW_H + 40);
  // Grass base.
  ctx.fillStyle = '#4a7a3f';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach sand on the east edge + water beyond the world edge.
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(2280, y0, WORLD_W - 2280, y1 - y0);
  ctx.fillStyle = '#2e6b9a';
  ctx.fillRect(WORLD_W - 8, y0, 8, y1 - y0);
  // Parks.
  for (const pk of w.parks) {
    ctx.fillStyle = '#5d9448';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  // Harbor concrete.
  ctx.fillStyle = '#8a8578';
  ctx.fillRect(0, 1440, 1000, WORLD_H - 1440);
  // Sidewalks: pale strips beside every road.
  ctx.fillStyle = '#9a9a92';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2 - 14, y0, ROAD_W + 28, y1 - y0);
  for (const ry of ROADS_H) ctx.fillRect(x0, ry - ROAD_W / 2 - 14, x1 - x0, ROAD_W + 28);
  // Asphalt.
  ctx.fillStyle = '#33363d';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of ROADS_H) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
  // Lane dashes.
  ctx.fillStyle = '#c9b458';
  for (const rx of ROADS_V) {
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
      if (onRoad(rx, y)) ctx.fillRect(rx - 2, y, 4, 22);
    }
  }
  for (const ry of ROADS_H) {
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
      if (onRoad(x, ry)) ctx.fillRect(x, ry - 2, 22, 4);
    }
  }
  // Buildings with roof, shadow and windows.
  for (const b of w.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.container) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let i = 1; i < 5; i += 1) ctx.fillRect(b.x + (b.w / 5) * i - 1, b.y + 3, 2, b.h - 6);
      continue;
    }
    // Roof details + windows.
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 6);
    ctx.fillStyle = 'rgba(20,20,30,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        if ((cx * 7 + cy * 13 + b.x) % 3 === 0) continue;
        ctx.fillRect(b.x + 8 + cx * 26, b.y + 10 + cy * 26, 10, 12);
      }
    }
    if (b.hgt > 40) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    }
  }
  // Trees and palms.
  for (const t of w.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#3f6b2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.palm ? 12 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d9448';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Street lamps.
  for (const l of w.lamps) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillStyle = '#555';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }
}

function drawMarks(ctx, G) {
  ctx.fillStyle = 'rgba(20,20,20,0.35)';
  for (const m of G.marks) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.fillRect(-14, -3, 28, 6);
    ctx.restore();
  }
}

function drawPickups(ctx, G) {
  for (const pk of G.pickups) {
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2e9e4a';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(-7, -4, 14, 8);
      ctx.fillStyle = '#333';
      ctx.fillRect(-5, -2, 3, 4);
      ctx.fillRect(0, -2, 3, 4);
      ctx.fillRect(5, -2, 3, 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#d43a3a';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = '#3a6fd4';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#8ecbff';
      ctx.fillRect(-5, -5, 10, 10);
    }
    ctx.restore();
  }
}

function drawCarShape(ctx, car, night) {
  const def = CAR_TYPES[car.type];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-def.len / 2 + 3, -def.wid / 2 + 3, def.len, def.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -def.len / 2, -def.wid / 2, def.len, def.wid, 7);
  ctx.fill();
  // Windows.
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(-def.len / 2 + 10, -def.wid / 2 + 3, 10, def.wid - 6);
  ctx.fillRect(def.len / 2 - 18, -def.wid / 2 + 3, 8, def.wid - 6);
  // Type details.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  } else if (car.type === 'cruiser') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -def.wid / 2, 12, def.wid);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PSPD', 0, 3);
    const blink = Math.floor((performance.now() / 280) % 2) === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#3b7bff';
    ctx.beginPath();
    ctx.arc(-4, -def.wid / 2 - 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#3b7bff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(4, -def.wid / 2 - 1, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (car.type === 'truck') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-def.len / 2 + 4, -def.wid / 2 + 4, def.len - 22, def.wid - 8);
  } else if (car.type === 'sport') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-4, -def.wid / 2 + 2, 8, def.wid - 4);
  }
  // Headlight beams at night.
  if (night && car.driver) {
    ctx.fillStyle = 'rgba(255,240,180,0.10)';
    ctx.beginPath();
    ctx.moveTo(def.len / 2, -8);
    ctx.lineTo(def.len / 2 + 150, -42);
    ctx.lineTo(def.len / 2 + 150, 42);
    ctx.lineTo(def.len / 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff7c0';
    ctx.fillRect(def.len / 2 - 1, -def.wid / 2 + 2, 3, 4);
    ctx.fillRect(def.len / 2 - 1, def.wid / 2 - 6, 3, 4);
  }
  // Damage smoke marker is drawn by particles; show a dent when hurt.
  if (car.hp < car.maxHp * 0.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(-def.len / 4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, G) {
  const night = isNight(G.time);
  for (const car of G.cars) {
    if (car.hp <= 0) {
      // Wreck: dark husk.
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = '#1c1c1c';
      roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
      ctx.fill();
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, car, night);
  }
}

function drawPerson(ctx, x, y, angle, shirt, walkAnim, flashT, dead) {
  ctx.save();
  ctx.translate(x, y);
  if (dead) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.fillRect(-8, -5, 16, 10);
    ctx.restore();
    return;
  }
  const swing = Math.sin(walkAnim) * 3;
  // Legs.
  ctx.strokeStyle = '#2b2b33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-swing, 10);
  ctx.moveTo(0, 2);
  ctx.lineTo(swing, 10);
  ctx.stroke();
  // Body.
  ctx.fillStyle = flashT > 0 ? '#fff' : shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = flashT > 0 ? '#fff' : '#e8c39a';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 2, Math.sin(angle) * 2 - 2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = '#1c1c22';
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * 2, Math.sin(angle) * 2 - 4, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPeople(ctx, G) {
  const p = G.player;
  for (const pd of G.peds) {
    if (pd.carId) continue; // driving, hidden inside the car
    drawPerson(ctx, pd.x, pd.y, pd.angle, pd.shirt, pd.walkAnim, pd.flashT, pd.hp <= 0);
  }
  for (const e of G.enemies) {
    drawPerson(ctx, e.x, e.y, e.angle, e.shirt, e.walkAnim, e.flashT, e.hp <= 0);
    if (e.hp > 0) {
      // Enemy health pip + gun.
      ctx.fillStyle = '#222';
      ctx.fillRect(e.x - 12, e.y - 20, 24, 4);
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(e.x - 12, e.y - 20, 24 * (e.hp / 60), 4);
    }
  }
  for (const cop of G.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, cop.shirt, cop.walkAnim, cop.flashT, cop.hp <= 0);
    if (cop.hp > 0) {
      ctx.fillStyle = '#8ecbff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PSPD', cop.x, cop.y - 16);
    }
  }
  // The player: Deke, in a teal jacket so he reads at a glance.
  if (!p.inCar && p.hp > 0) {
    drawPerson(ctx, p.x, p.y, p.angle, '#1f8a8a', p.walkAnim, 0, false);
    if (p.weapon === 'pistol') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.aimAngle ?? p.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -2, 12, 4);
      ctx.restore();
    }
    // Punch reach indicator.
    if (p.weapon === 'fists' && p.punchCooldown > 0.2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawBullets(ctx, G) {
  ctx.fillStyle = '#ffe27a';
  for (const b of G.bullets) {
    ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
  }
}

function drawMuzzle(ctx, G) {
  if (!G.flash) return;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.arc(G.flash.x, G.flash.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMarker(ctx, G) {
  const m = G.mission?.marker;
  if (!m || G.mode !== 'play') return;
  const pulse = 1 + Math.sin(performance.now() / 240) * 0.15;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.strokeStyle = '#ffd75a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd75a';
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(-9, -14);
  ctx.lineTo(9, -14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLighting(ctx, G) {
  const tint = skyTint(G.time);
  if (tint[3] > 0.01) {
    ctx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${tint[3].toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  // Lamp glows at night.
  if (isNight(G.time)) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cam = G.camera;
    for (const l of G.world.lamps) {
      const sx = l.x - cam.x;
      const sy = l.y - cam.y;
      if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 40) continue;
      const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60);
      grad.addColorStop(0, 'rgba(255,210,120,0.20)');
      grad.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, 60, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// --- HUD --------------------------------------------------------------------

function drawHUD(ctx, G) {
  const p = G.player;
  const pad = 16;
  // Health + armor bars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, pad, pad, 230, 54, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DEKE MARLOWE', pad + 10, pad + 17);
  ctx.fillStyle = '#222';
  ctx.fillRect(pad + 10, pad + 24, 210, 10);
  ctx.fillStyle = p.hp > 30 ? '#4ad45a' : '#ff5a5a';
  ctx.fillRect(pad + 10, pad + 24, 210 * (p.hp / p.maxHp), 10);
  ctx.fillStyle = '#222';
  ctx.fillRect(pad + 10, pad + 38, 210, 6);
  ctx.fillStyle = '#8ecbff';
  ctx.fillRect(pad + 10, pad + 38, 210 * (p.armor / 100), 6);
  // Money + clock, top right.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, VIEW_W - 250, pad, 234, 54, 8);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${p.money.toLocaleString()}`, VIEW_W - pad - 10, pad + 26);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${clockText(G.time)}  •  Debt $${(50000 - (G.debtPaid || 0)).toLocaleString()}`, VIEW_W - pad - 10, pad + 46);
  // Wanted stars, top centre-right.
  const stars = G.wanted || 0;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd75a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W / 2 - 60 + i * 30, pad + 28);
  }
  // Objective, top centre.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const obj = objectiveText(G);
  ctx.font = 'bold 14px sans-serif';
  const ow = ctx.measureText(obj).width + 24;
  roundRect(ctx, VIEW_W / 2 - ow / 2, pad + 38, ow, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd75a';
  ctx.fillText(obj, VIEW_W / 2, pad + 56);
  // Weapon + ammo + speed, bottom right.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, VIEW_W - 190, VIEW_H - 66, 174, 50, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  const weaponText = p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS';
  ctx.fillText(weaponText, VIEW_W - pad - 10, VIEW_H - 44);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#bbb';
  ctx.fillText('1 fists · 2 pistol · E car · R radio', VIEW_W - pad - 10, VIEW_H - 28);
  if (p.inCar) {
    const car = G.cars.find((c) => c.id === p.inCar);
    if (car) {
      // Speed readout on its own chip above the weapon box.
      const speedText = `${Math.round(Math.abs(car.speed) * 0.36)} km/h  •  ${car.name}`;
      ctx.font = 'bold 12px sans-serif';
      const sw = ctx.measureText(speedText).width + 20;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, VIEW_W - pad - sw, VIEW_H - 96, sw, 22, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd75a';
      ctx.fillText(speedText, VIEW_W - pad - 10, VIEW_H - 81);
    }
  }
  // Radio station, bottom centre.
  if (G.audio.radioOn) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    const label = `♪ ${G.audio.stationName()}`;
    const lw = ctx.measureText(label).width + 20;
    roundRect(ctx, VIEW_W / 2 - lw / 2, VIEW_H - 34, lw, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#ffb0d0';
    ctx.fillText(label, VIEW_W / 2, VIEW_H - 19);
  }
  // Crosshair when armed.
  if (p.weapon === 'pistol' && G.mode === 'play') {
    const target = aimTarget(G);
    const mx = G.input.mouseX;
    const my = G.input.mouseY;
    ctx.strokeStyle = target ? '#ff5a5a' : '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, target ? 12 : 9, 0, Math.PI * 2);
    ctx.moveTo(mx - 14, my);
    ctx.lineTo(mx - 6, my);
    ctx.moveTo(mx + 6, my);
    ctx.lineTo(mx + 14, my);
    ctx.moveTo(mx, my - 14);
    ctx.lineTo(mx, my - 6);
    ctx.moveTo(mx, my + 6);
    ctx.lineTo(mx, my + 14);
    ctx.stroke();
  }
  // Waypoint arrow at the screen edge toward the mission marker.
  const m = G.mission?.marker;
  if (m && G.mode === 'play') {
    const sx = m.x - G.camera.x;
    const sy = m.y - G.camera.y;
    if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
      const cx = clamp(sx, 40, VIEW_W - 40);
      const cy = clamp(sy, 90, VIEW_H - 90);
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd75a';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd75a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist(m.x, m.y, G.player.x, G.player.y))}m`, cx, cy + 24);
    }
  }
}

function drawMinimap(ctx, G) {
  const mw = 200;
  const mh = 134;
  const mx = 16;
  const my = VIEW_H - mh - 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#2f5d33';
  ctx.fillRect(mx, my, mw, mh);
  // Beach + harbor.
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(mx + 2280 * sx, my, (WORLD_W - 2280) * sx, mh);
  ctx.fillStyle = '#8a8578';
  ctx.fillRect(mx, my + 1440 * sy, 1000 * sx, (WORLD_H - 1440) * sy);
  // Roads.
  ctx.fillStyle = '#555';
  for (const rx of ROADS_V) ctx.fillRect(mx + (rx - ROAD_W / 2) * sx, my, ROAD_W * sx, mh);
  for (const ry of ROADS_H) ctx.fillRect(mx, my + (ry - ROAD_W / 2) * sy, mw, ROAD_W * sy);
  // Buildings.
  ctx.fillStyle = '#7a7a72';
  for (const b of G.world.buildings) {
    if (b.container) continue;
    ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Mission marker.
  const m = G.mission?.marker;
  if (m) {
    ctx.fillStyle = '#ffd75a';
    ctx.beginPath();
    ctx.arc(mx + m.x * sx, my + m.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cars.
  ctx.fillStyle = '#ccc';
  for (const car of G.cars) {
    if (car.hp <= 0) continue;
    ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  }
  // Enemies red, cops blue (flashing).
  ctx.fillStyle = '#ff5a5a';
  for (const e of G.enemies) {
    if (e.hp > 0) ctx.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
  }
  const blink = Math.floor(performance.now() / 300) % 2 === 0;
  ctx.fillStyle = blink ? '#3b7bff' : '#ff3b30';
  for (const car of G.cars) {
    if (car.driver === 'police') ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  }
  for (const cop of G.cops) {
    if (cop.hp > 0) ctx.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
  }
  // Player: white dot with a ring.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + G.player.x * sx, my + G.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // District label.
  const d = districtAt(G.player.x, G.player.y);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.name.toUpperCase(), mx, my - 8);
}

function drawDialog(ctx, G) {
  if (!G.dialog) return;
  const lines = G.dialog.lines;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  const w = 640;
  const h = 24 + lines.length * 20;
  roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 150, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2 - w / 2 + 16, VIEW_H - 150 + 26 + i * 20);
  });
}

function drawMessages(ctx, G) {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  let y = VIEW_H - 190;
  for (const msg of G.messages) {
    ctx.globalAlpha = clamp(msg.t, 0, 1);
    ctx.fillStyle = msg.color;
    ctx.fillText(msg.text, 230, y);
    y -= 20;
  }
  ctx.globalAlpha = 1;
}

function drawMissionFlash(ctx, G) {
  const f = G.missionFlash;
  ctx.globalAlpha = clamp(f.t, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, VIEW_H / 2 - 44, VIEW_W, 66);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(f.text, VIEW_W / 2, VIEW_H / 2);
  ctx.globalAlpha = 1;
}

// --- Screens ----------------------------------------------------------------

function drawTitle(ctx, G) {
  ctx.fillStyle = 'rgba(6,8,20,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2e63';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('NEON TIDE', VIEW_W / 2, 250);
  ctx.fillStyle = '#08d9d6';
  ctx.font = 'bold 92px sans-serif';
  ctx.globalAlpha = 0.35;
  ctx.fillText('NEON TIDE', VIEW_W / 2 + 4, 254);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime story in Port Solano', VIEW_W / 2, 300);
  ctx.fillStyle = '#ffd75a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Deke Marlowe owes Madame Kestrel $50,000. Pay it back — or take the city.', VIEW_W / 2, 330);
  const hasSave = !!G.saveExists;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(hasSave ? 'ENTER — Continue' : 'ENTER — New Game', VIEW_W / 2, 420);
  if (hasSave) ctx.fillText('N — New Game', VIEW_W / 2, 452);
  ctx.fillStyle = '#bbb';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move · Shift run · E enter / steal car · Mouse aim · Click shoot · F punch', VIEW_W / 2, 520);
  ctx.fillText('1 fists · 2 pistol · Space handbrake · R radio · Esc pause', VIEW_W / 2, 544);
  ctx.fillStyle = '#888';
  ctx.font = '13px sans-serif';
  ctx.fillText('A fully original game. No Rockstar content. Best played with sound on.', VIEW_W / 2, 600);
}

function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.font = '17px sans-serif';
  ctx.fillText('Esc — resume · M — mute · R — radio · Q — save & quit to title', VIEW_W / 2, 350);
  ctx.fillText(`Missions done: ${G.completedMissions.length}/8 · Cash: $${G.player.money} · Kills: ${G.stats.kills}`, VIEW_W / 2, 385);
}

function drawEndScreen(ctx, G, title, color, info) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = color;
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  if (info) {
    ctx.fillText(`You lost $${info.fine ?? info.lost} — taken to ${info.place}.`, VIEW_W / 2, 350);
  }
  ctx.fillText('Press ENTER to get back on the streets', VIEW_W / 2, 400);
}

function drawComplete(ctx, G) {
  ctx.fillStyle = 'rgba(6,20,10,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE HARBOR IS YOURS', VIEW_W / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = '19px sans-serif';
  ctx.fillText('Deke Marlowe paid the debt and took Port Solano from the Tide Rats.', VIEW_W / 2, 330);
  ctx.fillText(`Final cash: $${G.player.money} · Missions: 8/8 · Kills: ${G.stats.kills} · Cars stolen: ${G.stats.carsStolen}`, VIEW_W / 2, 370);
  ctx.fillText('ENTER — keep playing free roam', VIEW_W / 2, 430);
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
