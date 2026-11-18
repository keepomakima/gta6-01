// NEON TIDE — main.js
// Titik masuk game: state global G, game loop (dt dari performance.now —
// pelajaran bug v2: jangan pakai timestamp rAF sebagai last), state machine
// title/play/pause/busted/wasted/complete, save/load localStorage, dan
// window.__debug + window.__game untuk playtest otomatis.
import { WORLD_W, WORLD_H, SAVE_KEY, PLACES, WEAPONS, CAR_TYPES } from './config.js';
import { mulberry32, clamp, dist } from './random.js';
import { Input } from './input.js';
import { buildWorld, districtAt } from './world.js';
import { makePlayer, makeCar, movePlayerOnFoot, driveCar, enterCar, exitCar, nearestCar, addPopup } from './entities.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds, spawnParkedCars } from './traffic.js';
import { updatePolice, raiseWanted, setWanted, damagePlayer, makeCop } from './police.js';
import { makeHeli, updateHeli } from './helicopter.js';
import { startMission, updateMission, missionTarget, completeMission } from './missions.js';
import { makeCombat, playerShoot, playerPunch, updateBullets, updateEnemies, updatePickups } from './combat.js';
import { makeShop, tryOpenShop, buySelected, tryUseSafehouse, nearbyInteractable } from './shops.js';
import { GameAudio } from './audio.js';
import { Particles } from './particles.js';
import { drawWorld, drawHUD, drawScreen, isNight } from './render.js';
import { applyShotScene, updateShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newGameState(seed = 20261118) {
  const world = buildWorld(seed);
  const G = {
    time: 0, clockHour: 13.0, day: 1,
    mode: 'title', seed,
    world, rng: mulberry32(seed ^ 0x9e3779b9),
    player: makePlayer(PLACES.spawn.x, PLACES.spawn.y),
    cars: [], peds: [], police: [], enemies: [], pickups: [],
    cam: { x: 0, y: 0 },
    wantedLevel: 0, wantedReason: '', wantedT: 0, lastSeenT: 0, spawnT: 0,
    roadblock: null, heli: makeHeli(), spotlightOn: false,
    mission: null, missionMarker: null, missionsDone: 0,
    dialog: null, dialogT: 0, popups: [],
    combat: makeCombat(), shop: makeShop(), particles: new Particles(),
    audio: new GameAudio(), input: new Input(canvas),
    shake: 0, debtPaid: 0, shotMode: null, shotFrames: 0, shotDrive: false,
  };
  G.raiseWanted = (n, reason) => raiseWanted(G, n, reason);
  G.saveGame = () => saveGame(G);
  G.loadGame = () => loadGame(G);
  spawnTraffic(G, 14);
  spawnPeds(G, 22);
  spawnParkedCars(G);
  // Beberapa mobil parkir berisi sopir (bisa dicuri, sopir lari).
  const driverSpots = [[668, 220], [2120, 868]];
  for (const [dx, dy] of driverSpots) {
    const car = G.cars.find((c) => Math.abs(c.x - dx) < 5 && Math.abs(c.y - dy) < 5);
    if (car) {
      const ped = { id: 5000 + dx, kind: 'ped', x: dx, y: dy, angle: 0, speed: 30, fleeT: 0, color: '#e8d44d', shirt: true };
      car.driver = ped;
      G.peds.push(ped);
    }
  }
  return G;
}

const G = newGameState();
window.__game = G;
// shopOpen sebagai getter supaya playtest bisa membaca window.__game.shopOpen.
Object.defineProperty(G, 'shopOpen', { get() { return G.shop.open; } });

// ---------- Save / load ----------
function saveGame(G) {
  try {
    const p = G.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: p.money, respect: p.respect, missionsDone: G.missionsDone,
      x: p.x, y: p.y, hp: p.hp, armor: p.armor,
      owned: p.owned, ammo: p.ammo, weapon: p.weapon,
      day: G.day, clockHour: G.clockHour, debtPaid: G.debtPaid,
    }));
  } catch { /* storage penuh / diblokir: abaikan */ }
}

function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const p = G.player;
    p.money = s.money; p.respect = s.respect; p.x = s.x; p.y = s.y;
    p.hp = s.hp; p.armor = s.armor; p.owned = s.owned; p.ammo = s.ammo;
    p.weapon = s.weapon || 'pistol';
    G.missionsDone = s.missionsDone; G.day = s.day || 1;
    G.clockHour = s.clockHour ?? 13.0; G.debtPaid = s.debtPaid || 0;
    return true;
  } catch { return false; }
}

// ---------- Debug API (playtest otomatis + shot) ----------
window.__debug = {
  state() {
    const p = G.player;
    return {
      mode: G.mode, mission: G.mission ? G.mission.id : 0, missionsDone: G.missionsDone,
      x: Math.round(p.x), y: Math.round(p.y), inCar: !!p.inCar,
      wanted: G.wantedLevel, heli: !!(G.heli && G.heli.active),
      hp: Math.round(p.hp), armor: Math.round(p.armor), money: p.money,
      owned: { ...p.owned }, weapon: p.weapon,
      district: districtAt(p.x, p.y), hour: G.clockHour,
    };
  },
  teleport(x, y) {
    const p = G.player;
    p.x = clamp(x, 16, WORLD_W - 16);
    p.y = clamp(y, 16, WORLD_H - 16);
    if (p.inCar) { p.inCar.x = p.x; p.inCar.y = p.y; }
    G.cam.x = clamp(p.x - 640, 0, WORLD_W - 1280);
    G.cam.y = clamp(p.y - 360, 0, WORLD_H - 720);
  },
  giveCar(type) {
    const p = G.player;
    const car = makeCar(type, p.x + 50, p.y, 0, { parked: false });
    car.given = true; // mobil pemberian debug: bisa ditukar dengan E
    G.cars.push(car);
    return car.id;
  },
  setMission(n) { startMission(G, n); },
  setWanted(n) { setWanted(G, n); },
  giveMoney(n) { G.player.money += n; },
  spawnCop() {
    const p = G.player;
    const cop = makeCop(p.x + 4, p.y + 4);
    cop.name = 'Officer Test';
    G.police.push(cop);
  },
  hurt(n) {
    const p = G.player;
    p.hp -= n;
    if (p.hp <= 0) { p.hp = 0; p.alive = false; G.mode = 'wasted'; G.audio.sfx('wasted'); }
  },
};

// ---------- Interaksi E ----------
function handleInteract() {
  const p = G.player;
  if (G.shop.open) return;
  if (p.inCar) {
    // Ganti mobil bila ada mobil parkir / pemberian di dekatnya; kalau
    // tidak ada, turun dari mobil. (Dipakai misi taksi: sport -> taksi.)
    const other = G.cars.find((c) => c !== p.inCar && (c.parked || c.given) && dist(c.x, c.y, p.x, p.y) < 95);
    if (other) {
      p.inCar = null;
      if (other.type === 'cruiser') G.raiseWanted(1, 'mencuri cruiser polisi');
      enterCar(G, other);
      return;
    }
    exitCar(G);
    return;
  }
  if (tryOpenShop(G)) return;
  if (tryUseSafehouse(G)) return;
  const car = nearestCar(G.cars, p.x, p.y, 95);
  if (car) {
    // Curi mobil polisi juga menaikkan wanted bila ada yang melihat.
    if (car.type === 'cruiser') G.raiseWanted(1, 'mencuri cruiser polisi');
    enterCar(G, car);
    if (!car.driver) {
      // Mobil kosong: tetap ada peluang kecil saksi melapor.
      if (G.police.some((c) => dist(c.x, c.y, p.x, p.y) < 380)) G.raiseWanted(1, 'curi mobil dilihat polisi');
    }
    return;
  }
  const cop = G.police.find((c) => c.kind === 'cop' && dist(c.x, c.y, p.x, p.y) < 60);
  if (cop) { G.mode = 'busted'; p.money = Math.max(0, p.money - 100); }
}

// ---------- Update utama ----------
function update(dt) {
  const p = G.player;
  const inp = G.input;
  G.time += dt;
  // Jam dunia: 1 detik nyata = 1 menit game (siang/malam terasa).
  G.clockHour += dt / 60;
  if (G.clockHour >= 24) { G.clockHour -= 24; G.day += 1; }
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.fireT = Math.max(0, p.fireT - dt);
  if (G.dialog) {
    G.dialog.t += dt;
    if (G.dialog.t > 9) G.dialog = null;
  }
  for (const pp of G.popups) pp.t += dt;
  G.popups = G.popups.filter((pp) => pp.t < 2.4);
  G.shake = Math.max(0, G.shake - dt * 14);

  // Radio + senjata + pause (tombol sekali tekan).
  if (inp.hit('KeyR')) {
    const st = G.audio.nextStation();
    G.dialog = { name: 'Radio', role: G.audio.stationName(), text: 'Station: ' + st, t: 0 };
  }
  if (inp.hit('Digit1')) p.weapon = 'fists';
  if (inp.hit('Digit2') && p.owned.pistol) p.weapon = 'pistol';
  if (inp.hit('Digit3') && p.owned.smg) p.weapon = 'smg';
  if (inp.hit('Digit4') && p.owned.shotgun) p.weapon = 'shotgun';

  if (G.shop.open) {
    if (inp.hit('ArrowUp')) G.shop.selected = (G.shop.selected + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
    if (inp.hit('ArrowDown')) G.shop.selected = (G.shop.selected + 1) % SHOP_ITEMS.length;
    if (inp.hit('Enter')) buySelected(G);
    if (inp.hit('Escape')) { G.shop.open = false; }
    inp.endFrame();
    return;
  }
  if (inp.hit('Escape')) { G.mode = 'pause'; inp.endFrame(); return; }

  if (inp.hit('KeyE')) handleInteract();

  // Gerak pemain / mobil.
  const dir = inp.moveDir();
  if (p.inCar) {
    if (G.shotDrive) {
      // Mode shot: mobil jalan kinematik (tanpa gesekan/tabrak gedung) supaya
      // speedometer stabil ~160 KM/H saat screenshot diambil.
      const car = p.inCar;
      const top = CAR_TYPES[car.type].top;
      car.speed = Math.min(car.speed + 420 * dt, top * 0.96);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 20, WORLD_W - 20);
      car.y = clamp(car.y, 20, WORLD_H - 20);
      p.x = car.x; p.y = car.y;
      p.angle = car.angle;
      G.audio.setEngine(Math.abs(car.speed) / top);
    } else {
      driveCar(G, p.inCar, dt);
      p.x = p.inCar.x; p.y = p.inCar.y;
      p.angle = p.inCar.angle;
      G.audio.setEngine(Math.abs(p.inCar.speed) / CAR_TYPES[p.inCar.type].top);
    }
  } else {
    if (dir) movePlayerOnFoot(G, p, dir, dt);
    G.audio.setEngine(0);
    // Combat jalan kaki.
    if (inp.mouseDown && p.weapon !== 'fists') playerShoot(G);
    else if (inp.mouseDown && p.weapon === 'fists') playerPunch(G);
  }

  // Prompt interaksi.
  G.interactPrompt = p.inCar ? null : nearbyInteractable(G) || (nearestCar(G.cars, p.x, p.y, 95) ? 'Tekan E — naik mobil' : null);

  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateHeli(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateMission(G, dt);
  G.particles.update(dt);

  // Kamera mengikuti pemain, dengan shake.
  // Mode shot: snap langsung (tanpa lerp) supaya mobil selalu di tengah
  // frame walau melaju 160 KM/H — lerp biasa tertinggal ~80px.
  const tx = clamp(p.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(p.y - 360, 0, WORLD_H - 720);
  if (G.shotMode) {
    G.cam.x = tx;
    G.cam.y = ty;
  } else {
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
    G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 6);
  }
  if (G.shake > 0.2) {
    G.cam.x += (Math.random() - 0.5) * G.shake;
    G.cam.y += (Math.random() - 0.5) * G.shake;
  }
  inp.endFrame();
}

// ---------- Render ----------
function render() {
  ctx.clearRect(0, 0, 1280, 720);
  if (G.mode === 'title') {
    // Kota senja di belakang title.
    G.clockHour = 18.3;
    drawWorld(ctx, G);
    drawScreen(ctx, G, 'title');
    return;
  }
  drawWorld(ctx, G);
  drawHUD(ctx, G);
  if (G.mode === 'pause') drawScreen(ctx, G, 'pause');
  else if (G.mode === 'busted') drawScreen(ctx, G, 'busted');
  else if (G.mode === 'wasted') drawScreen(ctx, G, 'wasted');
  else if (G.mode === 'complete') drawScreen(ctx, G, 'complete');
}

// ---------- Loop ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  // dt dari performance.now() — pelajaran bug v2: timestamp rAF vs now
  // selisihnya ~0,3ms dan membuat game jalan 1/60 kecepatan.
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.audio.ensure();
  if (G.mode === 'title') {
    if (G.input.hit('Enter')) {
      G.mode = 'play';
      G.audio.ensure();
      startMission(G, 1);
    } else if (G.input.hit('KeyC') && localStorage.getItem(SAVE_KEY)) {
      if (loadGame(G)) { G.mode = 'play'; startMission(G, Math.min(12, G.missionsDone + 1)); }
    }
    G.input.endFrame();
    G.time += dt;
  } else if (G.mode === 'play') {
    update(dt);
    if (G.shotMode) updateShot(G);
  } else if (G.mode === 'pause') {
    if (G.input.hit('Escape') || G.input.hit('Enter')) G.mode = 'play';
    G.input.endFrame();
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    if (G.input.hit('Enter')) {
      const p = G.player;
      p.hp = 100; p.alive = true;
      if (G.mode === 'busted') { p.x = PLACES.policeStation.x; p.y = PLACES.policeStation.y; }
      else { p.x = PLACES.hospital.x; p.y = PLACES.hospital.y; }
      if (p.inCar) { p.inCar = null; }
      setWanted(G, 0);
      G.mode = 'play';
    }
    G.input.endFrame();
  } else if (G.mode === 'complete') {
    if (G.input.hit('Enter')) { G.mode = 'play'; G.mission = null; }
    G.input.endFrame();
  }
  render();
}

// ---------- Shot mode (?shot=chase|drive|mission|heist&seed=...) ----------
const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
if (shotScene) {
  const seed = parseInt(params.get('seed') || '20261118', 10);
  G.mode = 'play';
  applyShotScene(G, shotScene, seed);
}

requestAnimationFrame(loop);
