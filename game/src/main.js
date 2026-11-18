// NEON TIDE v5 — entry point: game state, main loop, input dispatch,
// save/load, and the window.__debug / window.__game hooks the playtest
// and the screenshot runner use. 2D top-down open-world crime in Port
// Solano: 15 missions, 7 districts, garage upgrades + NOS, rain, AIR-1.
import { WORLD_W, WORLD_H, SAVE_KEY, SEED_DEFAULT, PLAYER_HP, NOS_TANK } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { makeInput } from './input.js';
import { makePlayer, makeCar, walkPlayer, driveCar, updatePeds, makePed, updateEnemies, hurtPlayer } from './entities.js';
import { spawnTraffic, spawnParked, nearestCar } from './traffic.js';
import { updatePolice, addWanted } from './police.js';
import { updateHeli } from './helicopter.js';
import { startMission, updateMissions } from './missions.js';
import { fireWeapon, updateBullets, updatePickups, cycleWeapon } from './combat.js';
import { openGarage, closeGarage, garageKey } from './garage.js';
import { openShop, closeShop, shopKey } from './shops.js';
import { makeParticles, updateParticles, burst, addSkid } from './particles.js';
import { makeWeather, updateWeather, setRain } from './weather.js';
import { makeAudio } from './audio.js';
import { districtAt, LANDMARKS } from './world.js';
import { draw } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newGame(seed) {
  const rng = makeRng(seed);
  const g = {
    seed, rng,
    mode: 'title',
    time: 0, clock: 17.5, day: 1,
    money: 250, missionsDone: 0,
    wanted: 0, wantedQuietT: 0,
    kills: 0,
    player: makePlayer(620, 820),
    cars: [], traffic: [], peds: [],
    enemies: [], cops: [], cruisers: [],
    roadblocks: [], spikes: [], spikeSeen: false,
    spikeT: 0, roadblockT: 0,
    heli: { active: false, x: 1200, y: 800, angle: 0, spotA: 0, spotOn: false },
    mission: { idx: 1, stage: 0, data: {}, target: null },
    upgrades: { engine: 0, grip: 0, armor: 0, nos: 0 },
    nos: 0, nosMax: 0, nosBoost: false,
    owned: {},
    garageOpen: false, garageSel: 0,
    shopOpen: false, shopSel: 0,
    playerBullets: [], enemyBullets: [], pickups: [],
    particles: makeParticles(),
    weather: makeWeather(),
    audio: makeAudio(),
    input: null,
    cam: { x: 0, y: 0 },
    shake: 0, dialog: null, popups: [],
    hasSave: false, shotMode: null, frames: 0,
    ctx,
  };
  g.input = makeInput(canvas);
  g.popup = (text) => {
    g.popups.push({ text, t: 4 });
    if (g.popups.length > 5) g.popups.shift();
  };
  g.addSkid = (x, y, a) => addSkid(g.particles, x, y, a);
  g.save = () => saveGame(g);
  g.busted = () => {
    g.mode = 'busted';
    g.money = Math.max(0, g.money - 100);
    g.audio.siren(false);
    g.cops = [];
    g.cruisers = [];
  };
  g.exitCar = (wrecked) => exitCar(g, wrecked);
  g.enterCar = (car) => enterCar(g, car);
  // World population.
  spawnParked(g, rng);
  spawnTraffic(g, rng, 10);
  for (let i = 0; i < 14; i++) {
    g.peds.push(makePed(200 + rng() * 2000, 200 + rng() * 1200, rng));
  }
  g.pickups.push(
    { x: 700, y: 300, kind: 'health', t: 600 },
    { x: 1600, y: 300, kind: 'armor', t: 600 },
    { x: 1200, y: 1100, kind: 'ammo', t: 600 },
    { x: 600, y: 1200, kind: 'cash', t: 600 },
  );
  try { g.hasSave = !!localStorage.getItem(SAVE_KEY); } catch { g.hasSave = false; }
  return g;
}

function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: g.money, mission: g.mission.idx, missionsDone: g.missionsDone,
      x: g.player.x, y: g.player.y, wanted: g.wanted,
      upgrades: g.upgrades, owned: g.owned, nos: g.nos,
    }));
  } catch { /* storage unavailable: game still runs */ }
}

function loadGame(g) {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return false;
    g.money = s.money ?? 250;
    g.missionsDone = s.missionsDone ?? 0;
    g.upgrades = s.upgrades ?? g.upgrades;
    g.owned = s.owned ?? {};
    g.nos = s.nos ?? 0;
    g.nosMax = (g.upgrades.nos || 0) > 0 ? NOS_TANK : 0;
    g.player.x = s.x ?? 620; g.player.y = s.y ?? 820;
    g.wanted = 0;
    startMission(g, Math.min(15, Math.max(1, s.mission ?? 1)));
    return true;
  } catch { return false; }
}

function enterCar(g, car) {
  const p = g.player;
  if (p.inCar) return;
  if (car.driver) {
    // Occupied car: the driver flees, and the law notices if it sees it.
    car.driver = false;
    const ped = makePed(car.x + 30, car.y + 30, g.rng);
    ped.fleeT = 4;
    g.peds.push(ped);
    let copNear = false;
    for (const c of g.cops) if (dist(c.x, c.y, p.x, p.y) < 600) copNear = true;
    for (const c of g.cruisers) if (dist(c.x, c.y, p.x, p.y) < 600) copNear = true;
    if (copNear) addWanted(g, 1, 'carjacking');
    g.popup('You jacked the car!');
  }
  if (p.car) p.car.parked = true;
  p.inCar = true;
  p.car = car;
  car.parked = false;
  car.speed = 0;
  p.x = car.x; p.y = car.y;
}

function exitCar(g, wrecked) {
  const p = g.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  car.parked = true;
  car.speed = 0;
  p.inCar = false;
  p.car = null;
  p.x = car.x + 34;
  p.y = car.y + 10;
  if (wrecked) burst(g.particles, car.x, car.y, 18, '#ff8a4a', 240, 0.7);
}

// E key: enter/exit cars first, then garage, gun shop, safehouse.
// In a car, E swaps to a nearby parked car (within 60px) before it
// thinks about the garage or getting out — that is how a fresh delivery
// car is picked up without leaving the one you arrived in.
function interact(g) {
  const p = g.player;
  if (g.mode !== 'play') return;
  if (p.inCar) {
    const other = nearestCar(g, p.x, p.y, 60, p.car);
    if (other) {
      exitCar(g, false);
      enterCar(g, other);
      return;
    }
    if (dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 120) { openGarage(g); return; }
    exitCar(g, false);
    return;
  }
  const car = nearestCar(g, p.x, p.y, 75);
  if (car) { enterCar(g, car); return; }
  if (dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 120) { openGarage(g); return; }
  if (dist(p.x, p.y, LANDMARKS.gunshop.x, LANDMARKS.gunshop.y) < 110) { openShop(g); return; }
  if (dist(p.x, p.y, LANDMARKS.safehouse1.x, LANDMARKS.safehouse1.y) < 100) { useSafehouse(g, 'Old Town'); return; }
  if (dist(p.x, p.y, LANDMARKS.safehouse2.x, LANDMARKS.safehouse2.y) < 100) { useSafehouse(g, 'Airfield'); return; }
}

function useSafehouse(g, name) {
  const p = g.player;
  p.hp = PLAYER_HP;
  p.armor = Math.min(100, p.armor + 25);
  if (p.car) p.car.cond = 100;
  g.save();
  g.popup(`Safehouse (${name}) — healed, car repaired, game saved`);
  g.audio.pickup();
}

// Debug hooks (used by the playtest and the shot runner).
function makeDebug(g) {
  return {
    state() {
      return {
        mode: g.mode, mission: g.mission.idx, missionsDone: g.missionsDone,
        x: Math.round(g.player.x), y: Math.round(g.player.y),
        inCar: g.player.inCar, carType: g.player.car ? g.player.car.type : null,
        wanted: g.wanted, heli: g.heli.active, spike: g.spikeSeen,
        district: districtAt(g.player.x, g.player.y),
        rain: g.weather.rain,
        upgrades: { ...g.upgrades }, nos: Math.round(g.nos), nosMax: g.nosMax,
        owned: { ...g.owned }, hp: Math.round(g.player.hp), money: g.money,
        armor: Math.round(g.player.armor),
      };
    },
    teleport(x, y) {
      const p = g.player;
      p.x = x; p.y = y;
      p.speed = 0;
      if (p.inCar && p.car) {
        p.car.x = x; p.car.y = y;
        p.car.speed = 0;
      }
    },
    giveCar(type) {
      const c = makeCar(type, g.player.x + 50, g.player.y, 0, true);
      g.cars.push(c);
      return c;
    },
    setMission(n) { startMission(g, n); },
    setWanted(n) { g.wanted = clamp(n, 0, 5); },
    giveMoney(n) { g.money += n; },
    setRain(v) { setRain(g.weather, v); },
    spawnCop() {
      g.cops.push({ x: g.player.x, y: g.player.y, speed: 265, hp: 50, fireT: 2 });
    },
    hurt(n) { hurtPlayer(g, n); },
  };
}

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '', 10) || SEED_DEFAULT;
const g = newGame(seed);
window.__game = g;
window.__debug = makeDebug(g);
window.__shotReady = false;

if (params.get('shot')) {
  setupShot(g, params.get('shot'), seed);
} else {
  startMission(g, 1);
}

// Key dispatch: menus first, then mode keys, then gameplay keys.
window.addEventListener('keydown', (e) => {
  if (g.garageOpen) { garageKey(g, e.code); e.preventDefault(); return; }
  if (g.shopOpen) { shopKey(g, e.code); e.preventDefault(); return; }
  if (e.code === 'Enter') {
    if (g.mode === 'title') {
      g.mode = 'play';
      if (g.hasSave && loadGame(g)) g.popup('Welcome back, Deke.');
      else startMission(g, 1);
    } else if (g.mode === 'busted' || g.mode === 'wasted') {
      g.player.hp = PLAYER_HP;
      g.player.x = LANDMARKS.safehouse1.x; g.player.y = LANDMARKS.safehouse1.y;
      if (g.player.inCar && g.player.car) { g.player.car.x = g.player.x; g.player.car.y = g.player.y; }
      g.wanted = 0;
      g.cops = []; g.cruisers = [];
      g.mode = 'play';
    } else if (g.mode === 'complete') {
      g.mode = 'play';
    }
    return;
  }
  if (e.code === 'Escape') {
    if (g.mode === 'play') g.mode = 'pause';
    else if (g.mode === 'pause') g.mode = 'play';
    return;
  }
  if (g.mode !== 'play') return;
  if (e.code === 'KeyE') interact(g);
  else if (e.code === 'KeyR') { g.audio.ensure(); g.audio.cycleStation(); g.popup(g.audio.stationName()); }
  else if (e.code === 'KeyM') { g.audio.musicOn = !g.audio.musicOn; g.popup(g.audio.musicOn ? 'Music on' : 'Music off'); }
  else if (e.code === 'Digit1') g.player.weapon = 'fists';
  else if (e.code === 'Digit2') g.player.weapon = 'pistol';
  else if (e.code === 'Digit3' && g.owned.smg) g.player.weapon = 'smg';
  else if (e.code === 'Digit4' && g.owned.shotgun) g.player.weapon = 'shotgun';
  else if (e.code === 'KeyQ') cycleWeapon(g, 1);
});

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) return;
  g.frames++;
  g.time += dt;

  if (g.mode === 'play') {
    g.clock += dt * 0.05;
    if (g.clock >= 24) { g.clock -= 24; g.day++; }
    const isNight = g.clock >= 19 || g.clock < 6;
    // Driving or walking.
    if (g.player.inCar) g.nosBoost = driveCar(g, dt);
    else { walkPlayer(g, dt); g.nosBoost = false; }
    // Shooting while the mouse is held.
    if (g.input.mouse.down) fireWeapon(g);
    updateBullets(g, dt);
    updatePickups(g, dt);
    updatePeds(g, dt);
    updateEnemies(g, dt);
    updatePolice(g, dt);
    updateHeli(g, dt);
    updateMissions(g, dt);
    updateParticles(g.particles, dt);
    updateWeather(g.weather, dt, isNight);
    // Peds panic at nearby gunfire.
    if (g.playerBullets.length > 0) {
      for (const ped of g.peds) {
        if (dist(ped.x, ped.y, g.player.x, g.player.y) < 320) ped.fleeT = 2;
      }
    }
    // Wrecked player car strands the player on foot.
    if (g.player.inCar && g.player.car && g.player.car.cond <= 0) {
      g.popup('CAR WRECKED');
      exitCar(g, true);
    }
    // Dialog + popup timers.
    if (g.dialog) { g.dialog.t -= dt; if (g.dialog.t <= 0) g.dialog = null; }
    for (const pp of g.popups) pp.t -= dt;
    g.popups = g.popups.filter((pp) => pp.t > 0);
    g.audio.tickMusic(now / 1000);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 22);
  }

  // Camera follows the player, clamped to the city.
  g.cam.x = clamp(g.player.x - 640, 0, WORLD_W - 1280);
  g.cam.y = clamp(g.player.y - 360, 0, WORLD_H - 720);
  if (g.shake > 0.3) {
    g.cam.x += (Math.random() - 0.5) * g.shake;
    g.cam.y += (Math.random() - 0.5) * g.shake;
  }

  draw(g);
  if (g.shotMode && g.frames > 30 && !window.__shotReady) window.__shotReady = true;
}
requestAnimationFrame(frame);
