// NEON TIDE v5 — police.js
// Sistem wanted 0-5 bintang + respons PSPD: foot cop mengejar dan menangkap,
// cruiser mengejar dan meramming mobil pemain, roadblock di 3 bintang ke
// atas, wanted turun bila lolos dari pandangan. Baru v5: spike strip di
// wanted 4+ (ban bocor, top speed -55%) dan manuver PIT — cruiser menabrak
// sisi belakang mobil untuk memutarnya. Busted / Wasted + denda.
// damagePlayer tinggal di sini (bukan combat.js) — pelajaran dari bug v2.
// Revisi v5.2: PIT hanya aktif saat pemain ngebut (>260) dan wanted >= 3.
import { CAR_TYPES } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { makeCar } from './entities.js';
import { enemyShoot } from './combat.js';

export function makeCop(x, y) {
  return {
    id: Math.floor(Math.random() * 1e9), kind: 'cop', x, y,
    hp: 100, alive: true, speed: 165, angle: 0, fireT: 1.5, name: 'Officer',
  };
}

export function makeCruiser(x, y) {
  const c = makeCar('cruiser', x, y, 0, { ai: null });
  c.kind = 'cruiser';
  c.name = 'Unit ' + (10 + Math.floor(Math.random() * 80));
  c.ramT = 0;
  c.pitT = 0;
  return c;
}

// Naikkan wanted (maks 5) dan beri tahu HUD kenapa.
export function raiseWanted(G, n, reason) {
  const before = G.wantedLevel;
  G.wantedLevel = clamp(G.wantedLevel + n, 0, 5);
  if (G.wantedLevel > before) {
    G.wantedReason = reason || 'kejahatan terlihat';
    G.wantedT = 0;
    G.lastSeenT = 0;
    if (G.wantedLevel >= 4) G.audio.sfx('siren');
  }
}

// Turunkan wanted (dipakai misi Lose the Heat & debug).
export function setWanted(G, n) {
  G.wantedLevel = clamp(n, 0, 5);
  G.wantedT = 0;
  G.lastSeenT = 0;
  if (n === 0) {
    G.police = G.police.filter((u) => u.kind === 'roadblock');
    G.roadblock = null;
    G.spike = null;
    if (G.heli) G.heli.active = false;
  }
}

// Damage ke pemain: armor menyerap dulu, lalu HP. Wasted bila HP habis.
export function damagePlayer(G, n, source) {
  const p = G.player;
  if (!p.alive || G.mode !== 'play' || p.hurtT > 0) return;
  p.hurtT = 0.35;
  let left = n;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  G.audio.sfx('hurt');
  G.shake = Math.min(10, G.shake + 4);
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    G.mode = 'wasted';
    G.audio.sfx('wasted');
  }
}

// Spawn unit polisi sesuai wanted. Dipanggil berkala dari main loop.
export function updatePolice(G, dt) {
  const p = G.player;
  const w = G.wantedLevel;
  if (G.mode !== 'play') return;
  // Hitung jarak pandang: ada polisi yang melihat pemain?
  let seen = false;
  for (const u of G.police) {
    if (dist(u.x, u.y, p.x, p.y) < 520) { seen = true; break; }
  }
  if (seen) { G.lastSeenT = 0; }
  else {
    G.lastSeenT += dt;
    if (w > 0 && G.lastSeenT > 6) {
      setWanted(G, w - 1);
      G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Mereka kehilangan jejakku. Wanted turun.', t: 0 };
    }
  }
  // Spawn foot cop bila kurang (maks 1 + wanted).
  const cops = G.police.filter((u) => u.kind === 'cop');
  const wantCops = w >= 1 ? Math.min(1 + w, 5) : 0;
  if (cops.length < wantCops && G.spawnT <= 0) {
    G.spawnT = 1.2;
    const a = Math.random() * Math.PI * 2;
    const cop = makeCop(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320);
    cop.name = 'Officer ' + ['Reyes', 'Dunn', 'Marsh', 'Cole', 'Vega'][cops.length % 5];
    G.police.push(cop);
  }
  // Spawn cruiser bila wanted >= 2 (maks wanted-1).
  const cruisers = G.police.filter((u) => u.kind === 'cruiser');
  const wantCruisers = w >= 2 ? Math.min(w - 1, 4) : 0;
  if (cruisers.length < wantCruisers && G.spawnT <= 0) {
    G.spawnT = 2.0;
    const a = Math.random() * Math.PI * 2;
    const c = makeCruiser(p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420);
    c.angle = Math.atan2(p.y - c.y, p.x - c.x);
    G.police.push(c);
  }
  G.spawnT -= dt;

  // Roadblock di wanted 3+: dua cruiser parkir melintang di depan pemain.
  if (w >= 3 && !G.roadblock) {
    const ahead = p.inCar ? p.inCar.angle : p.angle;
    const bx = p.x + Math.cos(ahead) * 420;
    const by = p.y + Math.sin(ahead) * 420;
    const rb1 = makeCruiser(bx, by); rb1.kind = 'roadblock'; rb1.name = 'Roadblock A';
    const rb2 = makeCruiser(bx + 40, by + 40); rb2.kind = 'roadblock'; rb2.name = 'Roadblock B';
    rb1.parked = true; rb2.parked = true;
    G.police.push(rb1, rb2);
    G.roadblock = { x: bx, y: by, t: 0 };
    G.dialog = { name: 'PSPD Dispatch', role: 'Radio Polisi', text: 'Roadblock dipasang di depanmu. Menyerahlah, Marlowe.', t: 0 };
  }
  if (w < 3 && G.roadblock) {
    G.police = G.police.filter((u) => u.kind !== 'roadblock');
    G.roadblock = null;
  }
  if (G.roadblock) G.roadblock.t += dt;

  // Spike strip baru v5: wanted 4+, dipasang di depan pemain, sekali pakai.
  if (w >= 4 && !G.spike && G.spikeT <= 0) {
    const ahead = p.inCar ? p.inCar.angle : p.angle;
    G.spike = { x: p.x + Math.cos(ahead) * 380, y: p.y + Math.sin(ahead) * 380, angle: ahead + Math.PI / 2, t: 0 };
    G.spikeT = 9;
    G.dialog = { name: 'PSPD Dispatch', role: 'Radio Polisi', text: 'Spike strip dipasang! Jangan lewati garis itu!', t: 0 };
  }
  if (G.spikeT > 0) G.spikeT -= dt;
  if (G.spike) {
    G.spike.t += dt;
    if (p.inCar && dist(p.x, p.y, G.spike.x, G.spike.y) < 34 && !p.inCar.spiked) {
      p.inCar.spiked = true;
      p.inCar.spikeT = 5;
      p.inCar.cond = Math.max(0, p.inCar.cond - 12);
      G.spike = null;
      G.shake = Math.min(12, G.shake + 8);
      G.audio.sfx('crash');
      G.particles.burst(p.x, p.y, 'spark', 10);
      G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Ban bocor! Spike strip itu kena aku.', t: 0 };
    }
    if (G.spike && G.spike.t > 14) G.spike = null;
  }

  // Gerakkan unit.
  for (const u of G.police) {
    if (u.kind === 'cop') updateFootCop(G, u, dt);
    else if (u.kind === 'cruiser') updateCruiser(G, u, dt);
    // roadblock diam di tempat.
  }
  // Bersihkan unit yang terlalu jauh (di luar 900px) saat wanted 0.
  if (w === 0) G.police = G.police.filter((u) => u.kind === 'roadblock' || dist(u.x, u.y, p.x, p.y) < 900);
}

function updateFootCop(G, cop, dt) {
  const p = G.player;
  const d = dist(cop.x, cop.y, p.x, p.y);
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  if (p.inCar) {
    // Cop tidak bisa menangkap mobil: berdiri dan menembak dari jauh.
    cop.fireT -= dt;
    if (d < 380 && cop.fireT <= 0) {
      cop.fireT = 1.6;
      enemyShoot(G, cop, p.inCar);
    }
    return;
  }
  if (d > 26) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  } else {
    // Menangkap pemain -> Busted.
    G.mode = 'busted';
    p.money = Math.max(0, p.money - 100);
    G.audio.sfx('busted');
    return;
  }
  // Menembak bila dekat tapi belum menyentuh.
  cop.fireT -= dt;
  if (d < 300 && d > 60 && cop.fireT <= 0) {
    cop.fireT = 1.8;
    enemyShoot(G, cop, p);
  }
}

function updateCruiser(G, c, dt) {
  const p = G.player;
  const target = p.inCar || p;
  const d = dist(c.x, c.y, target.x, target.y);
  const want = Math.atan2(target.y - c.y, target.x - c.x);
  const da = angleDiff(c.angle, want);
  c.angle += clamp(da, -2.4 * dt, 2.4 * dt);
  const top = CAR_TYPES.cruiser.top * 0.92;
  c.speed = Math.min(top, c.speed + 300 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.ramT -= dt;
  c.pitT -= dt;
  // Ramming: tabrak mobil pemain -> kerusakan + shake.
  if (p.inCar && d < 52 && c.ramT <= 0) {
    c.ramT = 1.0;
    p.inCar.cond = Math.max(0, p.inCar.cond - 9);
    G.shake = Math.min(12, G.shake + 7);
    G.audio.sfx('crash');
    G.particles.burst(p.x, p.y, 'spark', 8);
    if (p.inCar.cond <= 0) {
      G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Mobilku hancur! Aku harus jalan kaki.', t: 0 };
    }
  }
  // PIT baru v5: cruiser di samping belakang mobil pemain yang ngebut —
  // dorong sisi belakang, putar mobil 40 derajat, potong kecepatan.
  if (p.inCar && Math.abs(p.inCar.speed) > 260 && d < 62 && d > 34 && c.pitT <= 0 && G.wantedLevel >= 3) {
    c.pitT = 2.5;
    p.inCar.angle += 0.7;
    p.inCar.speed *= 0.55;
    p.inCar.cond = Math.max(0, p.inCar.cond - 6);
    G.shake = Math.min(14, G.shake + 9);
    G.audio.sfx('crash');
    G.particles.burst(p.x, p.y, 'spark', 10);
    G.popups.push({ text: 'PIT MANEUVER!', amount: 0, t: 0, x: p.x, y: p.y - 30 });
  }
  // Cruiser menabrak pemain jalan kaki -> damage.
  if (!p.inCar && d < 30) {
    damagePlayer(G, 25, 'cruiser');
    c.speed *= -0.3;
  }
}

// Daftar unit polisi untuk panel HUD: nama, jarak meter, status.
export function policePanelUnits(G) {
  const p = G.player;
  const units = [];
  for (const u of G.police) {
    if (u.kind === 'roadblock') continue;
    const meters = Math.round(dist(u.x, u.y, p.x, p.y) / 4);
    let status = 'PURSUIT';
    if (u.kind === 'cruiser' && p.inCar && dist(u.x, u.y, p.x, p.y) < 90) status = 'RAMMING';
    if (u.kind === 'cop') status = dist(u.x, u.y, p.x, p.y) < 60 ? 'ARREST' : 'PURSUIT';
    units.push({ name: u.name || (u.kind === 'cop' ? 'Foot Cop' : 'Cruiser'), meters, status });
  }
  if (G.heli && G.heli.active) {
    units.push({ name: 'AIR-1', meters: Math.round(dist(G.heli.x, G.heli.y, p.x, p.y) / 4), status: 'SPOTLIGHT' });
  }
  if (G.roadblock) {
    units.push({ name: 'Roadblock', meters: Math.round(dist(G.roadblock.x, G.roadblock.y, p.x, p.y) / 4), status: 'ROADBLOCK' });
  }
  if (G.spike) {
    units.push({ name: 'Spike Strip', meters: Math.round(dist(G.spike.x, G.spike.y, p.x, p.y) / 4), status: 'SPIKE' });
  }
  return units.slice(0, 5);
}
