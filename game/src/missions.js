// NEON TIDE — missions.js
// 12 misi berurutan NEON TIDE (8 lama + 4 baru v4): marker, waypoint, dialog,
// timer, dan reward. Setiap misi punya stage + progress 0..1 untuk HUD.
// Misi gagal bisa diulang; progres tersimpan di localStorage.
import { MISSION_DEFS, PLACES } from './config.js';
import { dist } from './random.js';
import { makeEnemy, makePickup } from './entities.js';
import { setWanted, raiseWanted } from './police.js';

const DIALOGS = {
  1: { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Deke. Lima puluh ribu dolar, dan kau pulang tanpa apa-apa. Kerja untukku — mulai sekarang.' },
  2: { name: 'Rosa', role: 'Mekanik Garasi', text: 'Butuh mobil sport. Curi satu, antar ke garasiku. Jangan sampai penyok parah.' },
  3: { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Paket ini harus sampai Pier 9. Cepat — pembelinya tidak suka menunggu.' },
  4: { name: 'Deke Marlowe', role: 'Protagonis', text: 'Tiga bintang. Aku harus hilang dari pandangan mereka. Jangan sampai terlihat.' },
  5: { name: 'Rosa', role: 'Mekanik Garasi', text: 'Tide Rats menguasai sudut itu. Bersihkan mereka. Pistolmu sudah terisi.' },
  6: { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Rampok rumah simpan mereka. Ambil uangnya, kabur ke garasi Rosa.' },
  7: { name: 'Kestrel', role: 'Bos Pelabuhan', text: 'Ikuti orang itu. Jangan terlalu dekat, jangan sampai dia sadar.' },
  8: { name: 'Rosa', role: 'Mekanik Garasi', text: 'Taksi butuh sopir. Antar tiga penumpang, uangnya lumayan.' },
  9: { name: 'Vex', role: 'Pembalap Liar', text: 'Balapan malam ini. Lewati tiga gate — yang paling cepat dapat hadiahnya.' },
  10: { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Heist butuh peralatan. Kumpulkan tiga crate di container yard.' },
  11: { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Malam ini kita rampok vault pelabuhan. Lumpuhkan penjaga, lalu kabur!' },
  12: { name: 'Deke Marlowe', role: 'Protagonis', text: 'Rook. Semua ini berakhir malam ini. Di beach house-nya.' },
};

export function startMission(G, id) {
  const def = MISSION_DEFS[id - 1];
  if (!def) return;
  const m = { id, title: def.title, giver: def.giver, reward: def.reward, stage: 0, data: {}, progress: 0, timer: 0 };
  G.mission = m;
  G.missionMarker = missionTarget(G);
  G.dialog = { ...DIALOGS[id], t: 0 };
  G.audio.sfx('mission');
  setupMission(G, m);
}

function setupMission(G, m) {
  const p = G.player;
  switch (m.id) {
    case 3: m.timer = 75; break; // Harbor Run: 75 detik
    case 4: setWanted(G, 3); spawnHeatCops(G); break; // Lose the Heat mulai 3★
    case 5: spawnGang(G, PLACES.rivalCorner.x, PLACES.rivalCorner.y, 4); break;
    case 6: m.data.stashTaken = false; break;
    case 7: {
      m.data.target = { x: PLACES.tailStart.x, y: PLACES.tailStart.y, angle: 0, speed: 70 };
      m.data.followT = 0;
      m.data.spotted = 0;
      break;
    }
    case 8: m.data.fare = 0; m.data.fareStage = 'pickup'; break;
    case 9: m.data.gate = 0; m.data.raceT = 0; break;
    case 10: m.data.crates = [false, false, false]; break;
    case 11: spawnGang(G, PLACES.vault.x, PLACES.vault.y, 5); raiseWanted(G, 2, 'heist terlihat'); break;
    case 12: spawnBoss(G); raiseWanted(G, 1, 'Rook memanggil anak buahnya'); break;
    default: break;
  }
}

function spawnHeatCops(G) {
  // Dua foot cop langsung mengejar saat misi 4 mulai.
  const p = G.player;
  for (let i = 0; i < 2; i += 1) {
    const a = (i / 2) * Math.PI * 2;
    G.police.push({ id: 900 + i, kind: 'cop', x: p.x + Math.cos(a) * 260, y: p.y + Math.sin(a) * 260, hp: 100, alive: true, speed: 170, angle: 0, fireT: 1.2, name: 'Officer Heat-' + (i + 1) });
  }
}

export function spawnGang(G, x, y, n) {
  G.enemies = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    // Clamp ke dalam dunia: vault di tepi selatan, radius spawn tidak boleh
    // melempar musuh keluar peta / luar layar (bug M11 percobaan pertama).
    const ex = Math.max(60, Math.min(2340, x + Math.cos(a) * 90));
    const ey = Math.max(60, Math.min(1540, y + Math.sin(a) * 90));
    G.enemies.push(makeEnemy(ex, ey, { label: 'Tide Rat' }));
  }
}

function spawnBoss(G) {
  G.enemies = [];
  const b = PLACES.bossArena;
  // Boss TIDAK spawn tepat di titik pemain (2380,1300) — offset 144px supaya
  // tidak ada contact damage instan saat pemain teleport ke arena (bug M12).
  G.enemies.push(makeEnemy(b.x - 120, b.y - 80, { hp: 300, boss: true, label: 'Boss Rook' }));
  const gc = { x: 2300, y: 1380 };
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    // Clamp: arena di tepi timur pantai, jangan sampai guard keluar dunia.
    const gx = Math.max(60, Math.min(2340, gc.x + Math.cos(a) * 110));
    const gy = Math.max(60, Math.min(1540, gc.y + Math.sin(a) * 110));
    G.enemies.push(makeEnemy(gx, gy, { label: 'Rook Guard' }));
  }
}

// Target waypoint misi saat ini (untuk marker + minimap + HUD NEXT).
export function missionTarget(G) {
  const m = G.mission;
  if (!m) return null;
  const P = PLACES;
  switch (m.id) {
    case 1: return { x: P.club.x, y: P.club.y, label: 'Kestrel Club' };
    case 2: return m.stage === 0 ? { x: P.club.x, y: P.club.y, label: 'Curi mobil sport' } : { x: P.garage.x, y: P.garage.y, label: "Rosa's Garage" };
    case 3: return { x: P.harborDrop.x, y: P.harborDrop.y, label: 'Harbor Pier 9' };
    case 4: return { x: P.spawn.x, y: P.spawn.y, label: 'Hilang dari pandangan polisi' };
    case 5: return { x: P.rivalCorner.x, y: P.rivalCorner.y, label: 'Rival Corner' };
    case 6: return m.stage === 0 ? { x: P.stashHouse.x, y: P.stashHouse.y, label: 'Stash House' } : { x: P.garage.x, y: P.garage.y, label: "Rosa's Garage" };
    case 7: return m.data.target ? { x: m.data.target.x, y: m.data.target.y, label: 'Ikuti target' } : null;
    case 8: {
      const fares = [P.fareA, P.fareB, P.fareC];
      const f = fares[Math.min(m.data.fare || 0, 2)];
      return { x: f.x, y: f.y, label: (m.data.fareStage === 'pickup' ? 'Jemput' : 'Antar') + ' — ' + f.label };
    }
    case 9: return { x: P.raceGates[Math.min(m.data.gate || 0, 2)].x, y: P.raceGates[Math.min(m.data.gate || 0, 2)].y, label: 'Gate ' + ((m.data.gate || 0) + 1) + '/3' };
    case 10: {
      const idx = (m.data.crates || []).findIndex((c) => !c);
      if (idx < 0) return { x: P.garage.x, y: P.garage.y, label: "Rosa's Garage" };
      return { x: P.crateSpots[idx].x, y: P.crateSpots[idx].y, label: 'Crate ' + (idx + 1) + '/3' };
    }
    case 11: return m.stage === 0 ? { x: P.vault.x, y: P.vault.y, label: 'Harbor Vault' } : { x: P.garage.x, y: P.garage.y, label: 'Kabur ke garasi!' };
    case 12: return { x: P.bossArena.x, y: P.bossArena.y, label: "Rook's Beach House" };
    default: return null;
  }
}

// Teks stage untuk HUD mission card.
export function missionStageText(G) {
  const m = G.mission;
  if (!m) return 'Free roam — jelajahi Port Solano';
  switch (m.id) {
    case 1: return 'Jalan kaki ke Kestrel Club';
    case 2: return m.stage === 0 ? 'Curi mobil sport (E di dekat mobil)' : 'Antar ke garasi Rosa';
    case 3: return 'Antar paket ke Pier 9 — ' + Math.ceil(m.timer) + ' dtk tersisa';
    case 4: return 'Wanted ' + G.wantedLevel + '★ — hilang dari pandangan polisi';
    case 5: return 'Kalahkan geng: ' + G.enemies.filter((e) => e.alive).length + ' tersisa';
    case 6: return m.stage === 0 ? 'Masuk ke stash house rival' : 'Kabur ke garasi Rosa';
    case 7: return 'Ikuti target — jangan ketahuan (' + Math.floor(m.data.followT || 0) + '/25 dtk)';
    case 8: return 'Penumpang ' + ((m.data.fare || 0) + 1) + '/3 — ' + (m.data.fareStage === 'pickup' ? 'jemput penumpang' : 'antar ke tujuan');
    case 9: return 'Gate ' + ((m.data.gate || 0) + 1) + '/3 — ' + Math.floor(m.data.raceT || 0) + ' dtk';
    case 10: return 'Crate: ' + (m.data.crates || []).filter(Boolean).length + '/3 dikumpulkan';
    case 11: return m.stage === 0 ? 'Lumpuhkan penjaga vault: ' + G.enemies.filter((e) => e.alive).length + ' tersisa' : 'Kabur ke garasi Rosa!';
    case 12: return 'Kalahkan Boss Rook: ' + G.enemies.filter((e) => e.alive).length + ' musuh tersisa';
    default: return '';
  }
}

// Update misi aktif. Return true bila misi selesai frame ini.
export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return false;
  const p = G.player;
  const near = (x, y, r) => dist(p.x, p.y, x, y) < r;
  switch (m.id) {
    case 1:
      m.progress = 1 - Math.min(1, dist(p.x, p.y, PLACES.club.x, PLACES.club.y) / 600);
      if (near(PLACES.club.x, PLACES.club.y, 70)) return completeMission(G, m);
      break;
    case 2: {
      if (m.stage === 0 && p.inCar && p.inCar.type === 'sport') { m.stage = 1; G.dialog = { name: 'Rosa', role: 'Mekanik Garasi', text: 'Itu dia! Sekarang antar ke garasiku.', t: 0 }; }
      m.progress = m.stage === 0 ? 0.3 : 0.7;
      if (m.stage === 1 && p.inCar && near(PLACES.garage.x, PLACES.garage.y, 130)) return completeMission(G, m);
      break;
    }
    case 3: {
      m.timer -= dt;
      m.progress = 1 - m.timer / 75;
      if (near(PLACES.harborDrop.x, PLACES.harborDrop.y, 130)) return completeMission(G, m);
      if (m.timer <= 0) { failMission(G, m, 'Timer habis — paket terlambat.'); return false; }
      break;
    }
    case 4: {
      m.progress = 1 - G.wantedLevel / 3;
      if (G.wantedLevel === 0) return completeMission(G, m);
      break;
    }
    case 5: {
      const left = G.enemies.filter((e) => e.alive).length;
      m.progress = 1 - left / 4;
      if (left === 0) return completeMission(G, m);
      break;
    }
    case 6: {
      if (m.stage === 0 && near(PLACES.stashHouse.x, PLACES.stashHouse.y, 110)) {
        m.stage = 1; p.money += 1500;
        G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Dapat $1.500 dari brankas mereka. Kabur sekarang!', t: 0 };
        raiseWanted(G, 2, 'perampokan terlihat');
      }
      m.progress = m.stage === 0 ? 0.4 : 0.75;
      if (m.stage === 1 && near(PLACES.garage.x, PLACES.garage.y, 130)) return completeMission(G, m);
      break;
    }
    case 7: {
      const t = m.data.target;
      if (t) {
        // Target berjalan di jalan, belok-belok pelan.
        t.angle += (Math.sin(G.time * 0.3) * 0.4) * dt;
        t.x += Math.cos(t.angle) * t.speed * dt;
        t.y += Math.sin(t.angle) * t.speed * dt;
        if (t.x < 100) t.angle = 0; if (t.x > 2300) t.angle = Math.PI;
        if (t.y < 100) t.angle = Math.PI / 2; if (t.y > 1500) t.angle = -Math.PI / 2;
        const d = dist(p.x, p.y, t.x, t.y);
        if (d < 340 && d > 55) m.data.followT += dt; // terlalu dekat = ketahuan
        if (d <= 55) {
          m.data.spotted += dt;
          if (m.data.spotted > 1.2) { failMission(G, m, 'Ketahuan! Target kabur.'); return false; }
        } else m.data.spotted = Math.max(0, (m.data.spotted || 0) - dt);
        m.progress = Math.min(1, (m.data.followT || 0) / 25);
        // Cek selesai DI LUAR blok jarak (pelajaran bug v2): dari jauh pun selesai.
        if ((m.data.followT || 0) >= 25) return completeMission(G, m);
      }
      break;
    }
    case 8: {
      const fares = [PLACES.fareA, PLACES.fareB, PLACES.fareC];
      const starts = [PLACES.taxiStand, PLACES.fareA, PLACES.fareB];
      const idx = Math.min(m.data.fare || 0, 2);
      const inTaxi = p.inCar && p.inCar.type === 'taxi';
      if (m.data.fareStage === 'pickup' && inTaxi && near(starts[idx].x, starts[idx].y, 130)) {
        m.data.fareStage = 'dropoff';
        G.dialog = { name: 'Penumpang', role: 'Taksi', text: 'Tolong antar saya ke ' + fares[idx].label + '.', t: 0 };
      } else if (m.data.fareStage === 'dropoff' && inTaxi && near(fares[idx].x, fares[idx].y, 130)) {
        p.money += 300;
        m.data.fare = (m.data.fare || 0) + 1;
        m.data.fareStage = 'pickup';
        G.audio.sfx('pickup');
        if (m.data.fare >= 3) return completeMission(G, m);
        G.dialog = { name: 'Rosa', role: 'Mekanik Garasi', text: 'Penumpang ' + m.data.fare + '/3 selesai. Lanjut!', t: 0 };
      }
      m.progress = ((m.data.fare || 0) + (m.data.fareStage === 'dropoff' ? 0.5 : 0)) / 3;
      break;
    }
    case 9: {
      m.data.raceT += dt;
      const g = PLACES.raceGates[Math.min(m.data.gate || 0, 2)];
      if (near(g.x, g.y, 140)) {
        m.data.gate = (m.data.gate || 0) + 1;
        G.audio.sfx('pickup');
        if (m.data.gate >= 3) return completeMission(G, m);
      }
      m.progress = (m.data.gate || 0) / 3;
      break;
    }
    case 10: {
      PLACES.crateSpots.forEach((c, i) => {
        if (!m.data.crates[i] && near(c.x, c.y, 120)) {
          m.data.crates[i] = true;
          G.audio.sfx('pickup');
          G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Crate ' + (m.data.crates.filter(Boolean).length) + '/3 didapat.', t: 0 };
        }
      });
      m.progress = (m.data.crates || []).filter(Boolean).length / 3;
      if ((m.data.crates || []).every(Boolean)) return completeMission(G, m);
      break;
    }
    case 11: {
      if (m.stage === 0) {
        const left = G.enemies.filter((e) => e.alive).length;
        m.progress = 0.5 * (1 - left / 5);
        if (left === 0) {
          m.stage = 1; p.money += 3000;
          G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Vault kosong! Bawa uangnya ke garasi Rosa — cepat!', t: 0 };
        }
      } else {
        m.progress = 0.5 + 0.5 * (1 - Math.min(1, dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) / 1200));
        if (near(PLACES.garage.x, PLACES.garage.y, 130)) return completeMission(G, m);
      }
      break;
    }
    case 12: {
      const left = G.enemies.filter((e) => e.alive).length;
      m.progress = 1 - left / 4;
      if (left === 0) return completeMission(G, m);
      break;
    }
    default: break;
  }
  G.missionMarker = missionTarget(G);
  return false;
}

export function completeMission(G, m) {
  const p = G.player;
  p.money += m.reward;
  p.respect = Math.min(100, p.respect + 8);
  G.missionsDone += 1;
  G.audio.sfx('fanfare');
  G.popups.push({ text: 'MISSION COMPLETE +$' + m.reward, amount: 0, t: 0, x: p.x, y: p.y - 40 });
  const done = m.id;
  G.mission = null;
  G.missionMarker = null;
  G.saveGame();
  if (done >= 12) {
    G.mode = 'complete';
    G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Rook tumbang. Pelabuhan ini milik kita sekarang, Deke. Utangmu lunas.', t: 0 };
    return true;
  }
  G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Misi ' + done + ' selesai. Hadiah $' + m.reward + '. Misi berikutnya sudah menunggumu.', t: 0 };
  startMission(G, done + 1);
  return true;
}

function failMission(G, m, reason) {
  G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: reason + ' Coba lagi.', t: 0 };
  G.audio.sfx('fail');
  // Ulang misi yang sama dari awal.
  G.enemies = [];
  startMission(G, m.id);
}
