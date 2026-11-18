// NEON TIDE v5 — shots.js
// Autopilot deterministik untuk 4 screenshot BARU v5
// (?shot=rainchase|casino|airport|stealth &seed=...): menata dunia, cuaca,
// wanted, misi, dan dialog, lalu memberi sinyal window.__shotReady = true
// saat frame siap difoto. Semua dari kode game yang sama — bukan gambar
// hasil generate. Ditulis fresh untuk v5.
import { PLACES } from './config.js';
import { makeCar } from './entities.js';
import { setWanted } from './police.js';
import { startMission } from './missions.js';
import { setRain } from './weather.js';

export function applyShotScene(G, scene, seed) {
  const p = G.player;
  G.mode = 'play';
  G.shotMode = scene;
  G.shotFrames = 0;
  if (scene === 'rainchase') {
    // COVER v5: malam hujan deras, kejar-kejaran 5 bintang, heli AIR-1 +
    // spotlight, spike strip di depan, NOS menyala biru, roadblock.
    G.clockHour = 22.5;
    setRain(G, 0.9);
    G.weather.rain = 0.9;
    p.x = 700; p.y = 620;
    p.upgrades.nos = 2; p.nosMax = 160; p.nos = 160;
    const sport = makeCar('sport', 700, 620, 0, { parked: false });
    sport.speed = 520;
    sport.nosFlame = true;
    G.cars.push(sport);
    p.inCar = sport;
    setWanted(G, 5);
    G.heli.active = true;
    G.heli.x = p.x - 120; G.heli.y = p.y - 180;
    G.spotlightOn = true;
    G.spike = { x: 1080, y: 620, angle: Math.PI / 2, t: 0 };
    const rb = makeCar('cruiser', 1180, 620, Math.PI / 2, { parked: true });
    rb.kind = 'roadblock'; rb.name = 'Roadblock A';
    G.police.push(rb);
    G.roadblock = { x: 1180, y: 620, t: 0 };
    G.dialog = { name: 'PSPD Dispatch', role: 'Radio Polisi', text: 'AIR-1 mengunci Marlowe di tengah hujan! Spike strip di depan — jangan sampai lolos!', t: 0 };
    startMission(G, 15);
    G.mission.stage = 1;
    G.popups.push({ text: 'NOS BOOST!', amount: 0, t: -1.2, x: p.x, y: p.y - 30 });
    G.popups.push({ text: 'NEAR MISS +$40', amount: 0, t: -1.2, x: p.x, y: p.y - 60 });
    G.shotDrive = true;
  } else if (scene === 'casino') {
    // Neon Mile malam: motor Tide Runner di depan Casino Solano, neon pink/
    // emas menyala, dialog Kestrel, wanted 0, hujan ringan.
    G.clockHour = 21.5;
    setRain(G, 0.35);
    G.weather.rain = 0.35;
    p.x = 1200; p.y = 1420;
    const bike = makeCar('bike', 1200, 1420, Math.PI / 2, { parked: false });
    bike.speed = 120;
    G.cars.push(bike);
    p.inCar = bike;
    setWanted(G, 0);
    G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Casino Solano malam ini. Motor sudah siap — ambil uangnya, Deke.', t: 0 };
    startMission(G, 15);
    G.popups.push({ text: 'NEON MILE', amount: 0, t: -1.2, x: p.x, y: p.y - 30 });
    G.shotDrive = false;
  } else if (scene === 'airport') {
    // Airfield senja: Vortex GT + NOS di runway 27, pesawat parkir, terminal,
    // misi Midnight Run stop 1, timer berjalan. Mobil DIAM di runway (bukan
    // shotDrive) supaya frame tetap di runway, bukan melaju sampai pantai.
    G.clockHour = 18.4;
    p.x = 1960; p.y = 1120;
    p.upgrades.nos = 3; p.nosMax = 240; p.nos = 240;
    const sport = makeCar('sport', 1960, 1120, 0, { parked: false });
    sport.speed = 0;
    sport.nosFlame = true;
    G.cars.push(sport);
    p.inCar = sport;
    setWanted(G, 0);
    G.dialog = { name: 'Vex', role: 'Pembalap Liar', text: 'Runway 27, Deke! Gas penuh — 90 detik untuk tiga stop!', t: 0 };
    startMission(G, 13);
    G.mission.timer = 82;
    G.popups.push({ text: 'NOS BOOST!', amount: 0, t: -1.2, x: p.x, y: p.y - 30 });
    G.shotDrive = false;
  } else if (scene === 'stealth') {
    // Silent Pier senja hujan: Deke jalan kaki, cone sentry kuning, deteksi
    // 35%, Pier Office di depan, dialog Kestrel.
    G.clockHour = 17.8;
    setRain(G, 0.5);
    G.weather.rain = 0.5;
    p.x = 620; p.y = 1420;
    p.weapon = 'pistol';
    p.ammo.pistol = 120;
    setWanted(G, 0);
    startMission(G, 14);
    G.mission.data.detect = 35;
    G.dialog = { name: 'Madame Kestrel', role: 'Bos Pelabuhan', text: 'Sentri itu menyapu pandangan. Tetap di luar cone kuning — diam-diam.', t: 0 };
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
