// Drawing only: the city, the people and cars in it, the HUD, the minimap and
// the menus. Everything is canvas 2D with flat colours and simple shapes —
// the art direction is a sun-soaked modern coastal city at dusk and at night.
import { BEACH, DISTRICTS, H_ROADS, ROAD_W, V_ROADS, VEHICLES, WORLD } from './config.js';
import { wantedLevel } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = { x: 16, y: 16, w: 190, h: 127 };

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { w: 1280, h: 720, scale: 1, ox: 0, oy: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.scale = Math.min(canvas.width / 1280, canvas.height / 720);
    view.ox = (canvas.width - 1280 * view.scale) / 2;
    view.oy = (canvas.height - 720 * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawCarShape(x, y, angle, type, color, hp, maxHp) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-24, -13, 48, 28);
    // Body.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-23, -12, 46, 24, 6);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,26,34,0.9)';
    ctx.beginPath();
    ctx.roundRect(-6, -10, 14, 20, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.75)';
    ctx.fillRect(6, -9, 3, 18);
    // Headlights.
    ctx.fillStyle = '#fff6c8';
    ctx.fillRect(21, -10, 3, 5);
    ctx.fillRect(21, 5, 3, 5);
    // Taillights.
    ctx.fillStyle = '#c23b4e';
    ctx.fillRect(-24, -10, 3, 5);
    ctx.fillRect(-24, 5, 3, 5);
    if (type === 'cruiser') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-4, -12, 10, 24);
      text('PSPD', -12, 4, 8, '#1a2a44', 'left', 'bold ');
    }
    if (type === 'taxi') {
      ctx.fillStyle = '#222';
      text('TAXI', -14, 4, 8, '#222', 'left', 'bold ');
    }
    // Damage smoke is a particle; a wrecked car shows its hp bar.
    if (hp < maxHp * 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-23, -16, 46, 3);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-23, -16, 46 * (hp / maxHp), 3);
    }
    ctx.restore();
  }

  function drawPed(x, y, angle, color, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 12, 5);
    ctx.fill();
    circle(9, 0, 5, '#e8b98a');
    ctx.restore();
    if (label) text(label, x, y - 18, 11, '#fff', 'center', 'bold ');
  }

  function drawWorld(G) {
    const city = G.city;
    const cam = G.camera;
    const x0 = Math.max(0, cam.x - 660);
    const y0 = Math.max(0, cam.y - 380);
    const x1 = Math.min(WORLD.w, cam.x + 660);
    const y1 = Math.min(WORLD.h, cam.y + 380);

    // Ground by district.
    for (const d of DISTRICTS) {
      rect(Math.max(d.x0, x0), Math.max(d.y0, y0),
        Math.min(d.x1, x1) - Math.max(d.x0, x0), Math.min(d.y1, y1) - Math.max(d.y0, y0), d.ground);
    }
    // Beach sand and sea.
    rect(x0, BEACH.y0, x1 - x0, BEACH.waterY - BEACH.y0, '#d9c08a');
    rect(x0, BEACH.waterY, x1 - x0, y1 - BEACH.waterY, '#1d5f7a');
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
      ctx.fillRect(wx, BEACH.waterY + 6 + 8 * Math.sin((G.timeSec + wx) * 0.7), 46, 3);
    }

    // Parks.
    for (const pk of city.parks) {
      if (pk.x > x1 || pk.x + pk.w < x0 || pk.y > y1 || pk.y + pk.h < y0) continue;
      rect(pk.x, pk.y, pk.w, pk.h, '#3f6e3a');
    }
    // Roads.
    for (const vx of V_ROADS) rect(vx - ROAD_W / 2, y0, ROAD_W, y1 - y0, '#2c2f36');
    for (const hy of H_ROADS) rect(x0, hy - ROAD_W / 2, x1 - x0, ROAD_W, '#2c2f36');
    // Sidewalk edges.
    ctx.strokeStyle = '#4a4e57';
    ctx.lineWidth = 3;
    for (const vx of V_ROADS) {
      ctx.beginPath(); ctx.moveTo(vx - ROAD_W / 2, y0); ctx.lineTo(vx - ROAD_W / 2, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(vx + ROAD_W / 2, y0); ctx.lineTo(vx + ROAD_W / 2, y1); ctx.stroke();
    }
    for (const hy of H_ROADS) {
      ctx.beginPath(); ctx.moveTo(x0, hy - ROAD_W / 2); ctx.lineTo(x1, hy - ROAD_W / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, hy + ROAD_W / 2); ctx.lineTo(x1, hy + ROAD_W / 2); ctx.stroke();
    }
    // Lane dashes.
    ctx.strokeStyle = 'rgba(230,220,120,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (const vx of V_ROADS) {
      ctx.beginPath(); ctx.moveTo(vx, y0); ctx.lineTo(vx, y1); ctx.stroke();
    }
    for (const hy of H_ROADS) {
      ctx.beginPath(); ctx.moveTo(x0, hy); ctx.lineTo(x1, hy); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      circle(t.x, t.y, t.r, '#2f6e2f');
      circle(t.x - 3, t.y - 3, t.r * 0.6, '#3f8e3f');
    }
    // Harbor containers.
    for (const c of city.containers) {
      if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
      rect(c.x, c.y, c.w, c.h, c.color);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    }
    // Buildings with roof detail and a soft shadow.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      rect(b.x, b.y, b.w, b.h, b.color);
      rect(b.x + 5, b.y + 5, b.w - 10, b.h - 10, b.roof);
      if (b.tall) {
        rect(b.x + 8, b.y + 8, b.w - 16, 10, '#2a2f38');
        text('▮', b.x + b.w / 2, b.y + b.h / 2 + 6, 22, 'rgba(255,255,255,0.16)', 'center');
      }
      // Windows as a grid of lit dots at night.
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let wi = 0; wi < cols; wi += 1) {
        for (let ri = 0; ri < rows; ri += 1) {
          const lit = ((wi * 7 + ri * 13 + b.x) % 5) === 0;
          ctx.fillStyle = lit && G.nightFactor > 0.4 ? '#ffd94d' : 'rgba(0,0,0,0.25)';
          ctx.fillRect(b.x + 10 + wi * 26, b.y + 10 + ri * 26, 9, 7);
        }
      }
    }

    // Tire marks.
    for (const mk of G.particles.marks) {
      ctx.save();
      ctx.translate(mk.x, mk.y);
      ctx.rotate(mk.angle);
      ctx.fillStyle = `rgba(10,10,10,${0.35 * (mk.life / 6)})`;
      ctx.fillRect(-8, -2, 16, 4);
      ctx.restore();
    }

    // Pickups.
    for (const pk of G.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      const color = pk.kind === 'health' ? '#3fce6e' : pk.kind === 'armor' ? '#4fa8e8' : pk.kind === 'ammo' ? '#e8b93a' : '#3fce6e';
      circle(pk.x, pk.y + bob, 11, color);
      text(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '•', pk.x, pk.y + bob + 4, 13, '#10141b', 'center', 'bold ');
    }

    // Mission marker (pulsing).
    const marker = G.missions.marker();
    if (marker) {
      const pulse = 1 + 0.15 * Math.sin(G.timeSec * 4);
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, marker.radius * 0.35 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,217,77,0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, marker.radius * 0.35 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(8, -10); ctx.lineTo(-8, -10); ctx.closePath();
      ctx.fill();
      ctx.restore();
      text(marker.label, marker.x, marker.y - marker.radius * 0.35 - 34, 13, '#ffd94d', 'center', 'bold ');
    }

    // Pedestrians.
    for (const pd of G.peds) {
      if (pd.x < x0 || pd.x > x1 || pd.y < y0 || pd.y > y1) continue;
      drawPed(pd.x, pd.y, pd.angle, pd.color);
    }
    // Enemies.
    for (const e of G.enemies) {
      if (e.dead || e.x < x0 || e.x > x1 || e.y < y0 || e.y > y1) continue;
      drawPed(e.x, e.y, e.angle, e.color, '!');
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(e.x - 14, e.y - 22, 28 * (e.hp / 70), 4);
    }
    // Cars (traffic, parked, police, player).
    for (const car of G.cars) {
      if (car.x < x0 - 60 || car.x > x1 + 60 || car.y < y0 - 60 || car.y > y1 + 60) continue;
      if (car.driver === 'player') continue;
      drawCarShape(car.x, car.y, car.angle, car.type, car.color, car.hp, car.maxHp);
      if (car.driver === 'cop') {
        const flash = Math.sin(G.timeSec * 10) > 0;
        circle(car.x - Math.cos(car.angle) * 8, car.y - Math.sin(car.angle) * 8, 5, flash ? '#ff3b30' : '#3b82ff');
      }
    }
    // Player.
    const p = G.player;
    if (!p.dead) {
      if (p.car) {
        drawCarShape(p.car.x, p.car.y, p.car.angle, p.car.type, p.car.color, p.car.hp, p.car.maxHp);
      } else {
        drawPed(p.x, p.y, p.angle, '#2e6fb0');
        // Aim line for the pistol.
        if (p.weapon === 'pistol') {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(p.angle) * 60, p.y + Math.sin(p.angle) * 60);
          ctx.stroke();
        }
      }
    }
    // Police on foot.
    for (const c of G.cops) {
      if (c.car || c.down) continue;
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      drawPed(c.x, c.y, c.angle, '#2e4a7a', 'PSPD');
    }
    // Particles.
    for (const pt of G.particles.parts) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      circle(pt.x, pt.y, pt.size, pt.color);
    }
    ctx.globalAlpha = 1;

    // Night overlay + headlights.
    if (G.nightFactor > 0.02) {
      ctx.fillStyle = `rgba(8,12,34,${0.42 * G.nightFactor})`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      // Street lamps glow.
      for (const lamp of city.lamps) {
        if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
        const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 90);
        g.addColorStop(0, `rgba(255,214,120,${0.5 * G.nightFactor})`);
        g.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 90, 0, Math.PI * 2);
        ctx.fill();
      }
      // Headlight cone for the player's car.
      const car = p.car;
      if (car) {
        const hx = car.x + Math.cos(car.angle) * 24;
        const hy = car.y + Math.sin(car.angle) * 24;
        const g = ctx.createRadialGradient(hx, hy, 10, hx + Math.cos(car.angle) * 130, hy + Math.sin(car.angle) * 130, 170);
        g.addColorStop(0, `rgba(255,240,180,${0.4 * G.nightFactor})`);
        g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(car.angle) * 130, hy + Math.sin(car.angle) * 130, 170, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Hurt flash.
    if (p.hurtT > 0) {
      ctx.fillStyle = `rgba(200,30,30,${0.25 * (p.hurtT / 0.4)})`;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  function drawMinimap(G) {
    const m = MINIMAP;
    const sx = m.w / WORLD.w;
    const sy = m.h / WORLD.h;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    ctx.fillRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
    ctx.strokeStyle = '#5a6a7a';
    ctx.lineWidth = 1;
    ctx.strokeRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
    // Ground + roads.
    ctx.fillStyle = '#2a3324';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = '#3a3f47';
    for (const vx of V_ROADS) ctx.fillRect(m.x + vx * sx - 2, m.y, 4, m.h);
    for (const hy of H_ROADS) ctx.fillRect(m.x, m.y + hy * sy - 2, m.w, 4);
    ctx.fillStyle = '#1d5f7a';
    ctx.fillRect(m.x, m.y + BEACH.waterY * sy, m.w, m.h - BEACH.waterY * sy);
    const dot = (x, y, r, color) => {
      circle(m.x + x * sx, m.y + y * sy, r, color);
    };
    const marker = G.missions.marker();
    if (marker) {
      const pulse = 4 + Math.sin(G.timeSec * 4);
      dot(marker.x, marker.y, pulse, '#ffd94d');
    }
    for (const car of G.cars) if (car.driver === 'cop') dot(car.x, car.y, 3, '#3b82ff');
    for (const e of G.enemies) if (!e.dead) dot(e.x, e.y, 2.5, '#ff3b30');
    for (const car of G.cars) if (car.driver === 'traffic') dot(car.x, car.y, 1.5, '#9aa5b1');
    dot(G.player.x, G.player.y, 4, '#ffffff');
    ctx.restore();
  }

  function drawHud(G) {
    const p = G.player;
    const level = wantedLevel(p.heat);
    // Top-left: minimap + district name.
    drawMinimap(G);
    const district = G.city.districtAt(p.x, p.y);
    text(district.name.toUpperCase(), MINIMAP.x + MINIMAP.w + 14, MINIMAP.y + 18, 15, '#e8ecf2', 'left', 'bold ');
    // Clock + day/night.
    const hours = Math.floor(G.clock / 60) % 24;
    const mins = Math.floor(G.clock % 60);
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    text(`${hh}:${mm}`, MINIMAP.x + MINIMAP.w + 14, MINIMAP.y + 40, 15, '#ffd94d', 'left', 'bold ');
    text(G.nightFactor > 0.5 ? 'NIGHT' : G.nightFactor > 0.15 ? 'DUSK' : 'DAY', MINIMAP.x + MINIMAP.w + 74, MINIMAP.y + 40, 13, '#c8ccd4', 'left');
    // Top-right: money + wanted stars.
    text(`$${p.money.toLocaleString('en-US')}`, 1264, 34, 24, '#3fce6e', 'right', 'bold ');
    text(`DEBT $${Math.max(0, 50000 - G.debtPaid).toLocaleString('en-US')}`, 1264, 58, 13, '#ff9a7a', 'right');
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < level ? '★' : '☆';
    text(stars, 1264, 88, 26, level > 0 ? '#ffcf4d' : '#5a6a7a', 'right');
    // Bottom-left: health + armor.
    text('HEALTH', 16, 690, 12, '#c8ccd4', 'left', 'bold ');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(16, 696, 220, 12);
    ctx.fillStyle = p.health > 30 ? '#3fce6e' : '#e5534b';
    ctx.fillRect(16, 696, 220 * (p.health / 100), 12);
    text('ARMOR', 250, 690, 12, '#c8ccd4', 'left', 'bold ');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(250, 696, 140, 12);
    ctx.fillStyle = '#4fa8e8';
    ctx.fillRect(250, 696, 140 * (p.armor / 100), 12);
    // Bottom-right: weapon + radio + car.
    const w = p.weapon === 'pistol' ? `K-9 Pistol  ${p.ammo} ammo` : 'Fists';
    text(w, 1264, 676, 15, '#e8ecf2', 'right', 'bold ');
    text(`♪ ${G.audio.stationName}  (R = station, 1/2 = weapon)`, 1264, 696, 12, '#9aa5b1', 'right');
    if (p.car) {
      const spec = VEHICLES[p.car.type];
      text(`${spec.label} — ${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, 1264, 650, 13, '#ffd94d', 'right');
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(1124, 656, 140, 8);
      ctx.fillStyle = p.car.hp > 30 ? '#e8b93a' : '#e5534b';
      ctx.fillRect(1124, 656, 140 * (p.car.hp / p.car.maxHp), 8);
    }
    // Objective tracker under the minimap.
    text(G.missions.objectiveText(), MINIMAP.x, MINIMAP.y + MINIMAP.h + 26, 14, '#ffd94d', 'left', 'bold ');
    // Feed messages (latest 3) — above the dialog box when one is showing.
    const feed = G.feed.slice(-3);
    const dialogShowing = !!G.missions.M.dialogQueue[0];
    feed.forEach((line, i) => {
      text(line, 16, (dialogShowing ? 540 : 620) - (feed.length - 1 - i) * 20, 13, 'rgba(232,236,242,0.9)');
    });
    // Dialog box.
    const dlg = G.missions.M.dialogQueue[0];
    if (dlg) {
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      ctx.fillRect(340, 560, 600, 84);
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 1;
      ctx.strokeRect(340, 560, 600, 84);
      text(dlg.who, 360, 588, 15, '#ffd94d', 'left', 'bold ');
      // Wrap the line.
      const words = dlg.text.split(' ');
      let line = '';
      let y = 612;
      for (const word of words) {
        if ((line + ' ' + word).length > 62) {
          text(line, 360, y, 14, '#e8ecf2');
          line = word;
          y += 18;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      text(line, 360, y, 14, '#e8ecf2');
    }
    // "Press E" hint near a car.
    if (!p.car && G.nearCar) {
      text('Press E to get in the car', 640, 500, 16, '#fff', 'center', 'bold ');
    }
  }

  function drawPanel(title, lines, prompt, accent = '#ffd94d') {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, 1280, 720);
    const w = 640;
    const h = 150 + lines.length * 30;
    const x = (1280 - w) / 2;
    const y = (720 - h) / 2;
    ctx.fillStyle = '#141a24';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, 640, y + 62, 40, accent, 'center', 'bold ');
    lines.forEach((line, i) => text(line, 640, y + 108 + i * 30, 17, '#c8ccd4', 'center'));
    text(prompt, 640, y + h - 26, 17, '#e8ecf2', 'center', 'bold ');
  }

  function drawTitle(G) {
    // The city at dusk behind the menu.
    drawWorld(G);
    ctx.fillStyle = 'rgba(10,10,26,0.45)';
    ctx.fillRect(0, 0, 1280, 720);
    text('NEON TIDE', 640, 190, 84, '#ff5a7a', 'center', 'bold ');
    text('an open-world crime story in Port Solano', 640, 232, 20, '#ffd94d', 'center');
    text('Deke Marlowe owes Madame Kestrel $50,000. The city is the only way out.', 640, 268, 16, '#e8ecf2', 'center');
    const hasSave = G.saveExists;
    text(hasSave ? 'ENTER — Continue' : 'ENTER — New Game', 640, 400, 22, '#fff', 'center', 'bold ');
    text('WASD move · SHIFT run · E enter/exit car · SPACE handbrake', 640, 440, 15, '#c8ccd4', 'center');
    text('Mouse aim · Click / F punch · 1/2 weapon · R radio · ESC pause', 640, 466, 15, '#c8ccd4', 'center');
    text('Steal cars. Lose the heat. Run the missions. Pay the debt.', 640, 540, 16, '#ffd94d', 'center');
    text('A fully original game — no assets from any commercial title.', 640, 690, 12, '#8b93a3', 'center');
  }

  function draw(G, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    const shakeY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + shakeX * view.scale, view.oy + shakeY * view.scale);
    // Camera transform: world coordinates relative to the camera centre.
    ctx.translate(640 - G.camera.x, 360 - G.camera.y);
    drawWorld(G);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    if (screen === SCREEN_TITLE) {
      drawTitle(G);
      return;
    }
    drawHud(G);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The tide waits for no one — except right now.', `Progress saves automatically after each mission.`], 'ESC / P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The PSPD caught up with Deke.', `Fine paid: $${500}. The debt remains.`], 'ENTER to continue', '#3b82ff');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Deke woke up at Solano General.', 'The missions wait. The debt waits.'], 'ENTER to continue', '#e5534b');
    }
  }

  // Screen (CSS) pixels to world coordinates, for mouse aiming.
  function toWorld(sx, sy, camera) {
    const dpr = window.devicePixelRatio || 1;
    return {
      x: camera.x - 640 + (sx * dpr - view.ox) / view.scale,
      y: camera.y - 360 + (sy * dpr - view.oy) / view.scale,
    };
  }

  return { draw, resize, toWorld };
}
