// NEON TIDE — shots.js
// Autopilot deterministik untuk 4 screenshot (?shot=chase|drive|mission|heist
// &seed=...): menata dunia, cuaca, wanted, misi, dan dialog, lalu memberi
// sinyal window.__shotReady = true saat frame siap difoto. Semua dari kode
// game yang sama — bukan gambar hasil generate.
import { PLACES } from './config.js';
import { makeCar } from './entities.js';
import { setWanted } from './police.js';
import { startMission } from './missions.js';

export function applyShotScene(G, scene, seed) {
  const p = G.player;
  G.mode = 'play';
  G.shotMode = scene;
  G.shotFrames = 0;
  if (scene === 'chase') {
    // COVER: malam neon, kejar-kejaran 5 bintang, heli + spotlight, cruiser
    // meramming, dialog, speedometer ~160 KM/H. Start di barat Downtown
    // supaya saat difoto mobil masih di Downtown (bukan Beachfront).
    G.clockHour = 22.5;
    p.x = 700; p.y = 620;
    const sport = makeCar('sport', 700, 620, 0, { parked: false });
    sport.speed = 520;
    G.cars.push(sport);
    p.inCar = sport;
    setWanted(G, 5);
    G.heli.active = true;
    G.heli.x = p.x - 120; G.heli.y = p.y - 180;
    G.spotlightOn = true;
    G.dialog = { name: 'PSPD Dispatch', role: 'Radio Polisi', text: 'AIR-1 mengunci Marlowe! Semua unit, kejar Vortex GT pink itu — sekarang!', t: 0 };
    startMission(G, 11);
    G.mission.stage = 1;
    G.popups.push({ text: 'NEAR MISS +$40', amount: 0, t: -1.2, x: p.x, y: p.y - 30 });
    G.shotDrive = true;
  } else if (scene === 'drive') {
    // Senja di beachfront, mobil sport, popup DRIFT / NEAR MISS, radio, minimap.
    // Jalan vertikal x=2120 ke utara: pantai + palem di kanan, kota di kiri.
    G.clockHour = 18.4;
    p.x = 2120; p.y = 1400;
    const sport = makeCar('sport', 2120, 1400, -Math.PI / 2, { parked: false });
    sport.speed = 430;
    G.cars.push(sport);
    p.inCar = sport;
    setWanted(G, 0);
    G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Senja di Beachfront. Satu putaran lagi, lalu kembali ke garasi Rosa.', t: 0 };
    startMission(G, 9);
    G.popups.push({ text: 'DRIFT +$25', amount: 0, t: -1.2, x: p.x, y: p.y - 30 });
    G.popups.push({ text: 'NEAR MISS +$40', amount: 0, t: -1.2, x: p.x, y: p.y - 60 });
    G.shotDrive = true;
  } else if (scene === 'mission') {
    // Misi di pelabuhan: combat + marker misi + dialog karakter.
    // Revisi: jam 16.00 (siang terang) supaya musuh dan marker jelas terlihat.
    // Revisi 2: pemain di (620,1380) — cukup jauh dari drop Pier 9 (420,1420)
    // supaya misi 3 tidak auto-complete, dan wanted 0 supaya tidak busted
    // sebelum __shotReady (bug shot pertama).
    G.clockHour = 16.0;
    p.x = 620; p.y = 1380;
    p.weapon = 'pistol';
    p.ammo.pistol = 120;
    setWanted(G, 0);
    startMission(G, 3);
    G.mission.timer = 48;
    G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Paket itu harus sampai Pier 9. Tide Rats mengintai — jaga dirimu, Deke.', t: 0 };
    // Dua musuh di dekat dermaga untuk adegan combat.
    G.enemies.push({ id: 7001, kind: 'enemy', x: 480, y: 1420, hp: 60, alive: true, boss: false, angle: 0, fireT: 2, speed: 78, label: 'Tide Rat', shootT: 0, wanderA: 0 });
    G.enemies.push({ id: 7002, kind: 'enemy', x: 360, y: 1480, hp: 60, alive: true, boss: false, angle: 0, fireT: 2.5, speed: 78, label: 'Tide Rat', shootT: 0, wanderA: 0 });
  } else if (scene === 'heist') {
    // Downtown, misi heist, wanted 4-5, roadblock + helikopter.
    // Revisi: start di barat Downtown (600,820) supaya saat difoto masih
    // di Downtown; roadblock di depan mobil (1750,820).
    G.clockHour = 21.0;
    p.x = 600; p.y = 820;
    const sport = makeCar('sport', 600, 820, 0, { parked: false });
    sport.speed = 380;
    G.cars.push(sport);
    p.inCar = sport;
    setWanted(G, 4);
    G.heli.active = true;
    G.heli.x = p.x - 140; G.heli.y = p.y - 160;
    G.spotlightOn = true;
    startMission(G, 11);
    G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Vault sudah kosong. Kabur ke garasi Rosa — roadblock di depan, hati-hati!', t: 0 };
    // Roadblock di depan pemain.
    const rb = makeCar('cruiser', 1750, 820, Math.PI / 2, { parked: true });
    rb.kind = 'roadblock'; rb.name = 'Roadblock A';
    G.police.push(rb);
    G.roadblock = { x: 1750, y: 820, t: 0 };
    G.shotDrive = true;
  }
  // Kamera langsung ke pemain supaya frame pertama sudah benar.
  G.cam.x = Math.max(0, Math.min(2400 - 1280, p.x - 640));
  G.cam.y = Math.max(0, Math.min(1600 - 720, p.y - 360));
  window.__shotReady = false;
}

// Dipanggil tiap frame saat shot mode: jalankan dunia sebentar lalu tandai siap.
export function updateShot(G) {
  G.shotFrames += 1;
  if (G.shotFrames > 100) {
    window.__shotReady = true;
  }
}
