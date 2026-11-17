// NEON TIDE — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, wasted.
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene with a deterministic autopilot and sets
// window.__shotReady when the frame is ready to capture.
import { BEACH, PLACES, PLAYER } from './config.js';
import { createRng } from './random.js';
import { buildCity } from './world.js';
import { ACT_CONFIRM, ACT_ENTER, ACT_PAUSE, ACT_PUNCH, ACT_RADIO, ACT_SHOOT, ACT_WEAPON, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createMissions } from './missions.js';
import {
  damagePlayer, exitCar, makeCar, playerPunch, playerShoot, spawnParkedCars,
  spawnPeds, spawnTraffic, tryEnterCar, updateCops, updateEnemies,
  updatePeds, updatePickups, updatePlayer, updateTraffic, wantedLevel,
} from './entities.js';
import { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, createRenderer } from './render.js';
import { setupShot, shotStep } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const SAVE_KEY = 'neontide-save-v1';
const DAY_MINUTES = 24 * 60;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRng(seed);
const city = buildCity(rng);
const audio = createAudio();
const particles = createParticles();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Night factor from the clock: 0 in daylight, 1 at night, ramping at dusk/dawn.
function nightFactorFor(clock) {
  const h = (clock / 60) % 24;
  if (h >= 19 || h < 5) return 1;
  if (h >= 17) return (h - 17) / 2;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  return 0;
}

const G = {
  rng, city, audio, particles,
  mode: 'title',
  clock: 17 * 60 + 20, // start at dusk
  timeSec: 0,
  nightFactor: 0,
  camera: { x: PLACES.club.x, y: PLACES.club.y },
  player: {
    x: PLACES.club.x, y: PLACES.club.y + 80, angle: 0,
    car: null, health: PLAYER.maxHealth, armor: 0,
    weapon: 'fists', ammo: 60, heat: 0, dead: false,
    attackCd: 0, hurtT: 0, moving: false,
    get money() { return this._money; }, set money(v) { this._money = v; },
    _money: 150,
  },
  cars: [], peds: [], cops: [], enemies: [], pickups: [],
  feed: [],
  kills: 0, missionKills: 0, earned: 0, debtPaid: 0,
  storyDone: false, flags: {}, shake: 0, gunshotT: 0, roadblockT: 8,
  nearCar: false, saveExists: false, shootAt: null,
  shot: null, autosaveT: 0,
};
G.player.money = 150;

function saveGame() {
  try {
    const save = {
      money: G.player.money, earned: G.earned, debtPaid: G.debtPaid,
      missionIndex: G.missions.M.index,
      x: G.player.x, y: G.player.y,
      health: G.player.health, armor: G.player.armor,
      ammo: G.player.ammo, weapon: G.player.weapon,
      clock: G.clock,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    G.saveExists = true;
  } catch { /* storage off: progress lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
G.saveGame = saveGame;

const missions = createMissions(G);
G.missions = missions;

function resetWorld() {
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.enemies = [];
  G.pickups = [];
  G.kills = 0;
  G.missionKills = 0;
  G.feed = [];
  G.flags = {};
  spawnParkedCars(G);
  spawnTraffic(G, 14);
  spawnPeds(G, 26);
}

function newGame() {
  resetWorld();
  const p = G.player;
  p.x = PLACES.club.x;
  p.y = PLACES.club.y + 80;
  p.angle = 0;
  p.car = null;
  p.health = PLAYER.maxHealth;
  p.armor = 0;
  p.weapon = 'fists';
  p.ammo = 60;
  p.heat = 0;
  p.dead = false;
  p.money = 150;
  G.earned = 0;
  G.debtPaid = 0;
  G.clock = 17 * 60 + 20;
  G.storyDone = false;
  G.camera.x = p.x;
  G.camera.y = p.y;
  missions.startMission(0);
  G.mode = 'play';
  audio.unlock();
  audio.startRadio();
  announce('Playing. Mission 1: Welcome Back.');
}

function continueGame() {
  const save = loadSave();
  if (!save) { newGame(); return; }
  resetWorld();
  const p = G.player;
  p.x = save.x; p.y = save.y;
  p.health = save.health; p.armor = save.armor;
  p.ammo = save.ammo; p.weapon = save.weapon;
  p.money = save.money;
  p.car = null;
  p.heat = 0;
  p.dead = false;
  G.earned = save.earned || 0;
  G.debtPaid = save.debtPaid || 0;
  G.clock = save.clock || 12 * 60;
  G.camera.x = p.x;
  G.camera.y = p.y;
  missions.startMission(Math.min(save.missionIndex || 0, 7));
  G.mode = 'play';
  audio.unlock();
  audio.startRadio();
  announce('Continuing your story.');
}

function respawn(at, fine, label) {
  const p = G.player;
  p.money = Math.max(0, p.money - fine);
  p.health = PLAYER.maxHealth;
  p.armor = 0;
  p.heat = 0;
  p.dead = false;
  if (p.car) exitCar(G, false);
  p.x = at.x;
  p.y = at.y;
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.feed.push(`${label} — $${fine} gone.`);
  saveGame();
  G.mode = 'play';
}

function announce(message) {
  status.textContent = message;
}

function step(dt) {
  G.timeSec += dt;
  G.clock = (G.clock + dt * 0.8) % DAY_MINUTES; // one game hour per 75 s
  G.nightFactor = nightFactorFor(G.clock);
  G.shake = Math.max(0, G.shake - dt * 30);
  G.player.hurtT = Math.max(0, G.player.hurtT - dt);
  G.gunshotT = Math.max(0, G.gunshotT - dt);

  if (G.mode === 'title') {
    updateTraffic(G, dt);
    updatePeds(G, dt);
    particles.update(dt);
    return;
  }
  if (G.mode !== 'play') return;

  missions.update(dt);
  updatePlayer(G, dt, input);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateCops(G, dt);
  updateEnemies(G, dt);
  updatePickups(G, dt);
  particles.update(dt);

  // Camera follows the player, clamped to the world.
  const p = G.player;
  G.camera.x += clamp(p.x - G.camera.x, -500 * dt, 500 * dt);
  G.camera.y += clamp(p.y - G.camera.y, -500 * dt, 500 * dt);
  G.camera.x = clamp(G.camera.x, 640, 2400 - 640);
  G.camera.y = clamp(G.camera.y, 360, 1600 - 360);

  // Nearest car for the "Press E" hint.
  G.nearCar = false;
  if (!p.car) {
    for (const car of G.cars) {
      if (car.driver === 'cop') continue;
      if (Math.hypot(car.x - p.x, car.y - p.y) < 58) { G.nearCar = true; break; }
    }
  }

  // Shooting: mouse click, held mouse, or the shot autopilot's target.
  if (G.shootAt) {
    playerShoot(G, G.shootAt.x, G.shootAt.y);
    G.shootAt = null;
  } else if (p.weapon === 'pistol' && input.mouse.down && !p.car) {
    const w = renderer.toWorld(input.mouse.x, input.mouse.y, G.camera);
    playerShoot(G, w.x, w.y);
  }

  // Periodic autosave.
  G.autosaveT += dt;
  if (G.autosaveT > 30) {
    G.autosaveT = 0;
    saveGame();
  }

  if (G.mode === 'busted' || G.mode === 'wasted') {
    // Handled by the action handler below; the loop just stops simulating.
  }
}

function handleActions() {
  const actions = input.takeActions();
  if (!actions) return;
  audio.unlock();
  if (actions & ACT_CONFIRM) {
    if (G.mode === 'title') {
      if (loadSave()) continueGame();
      else newGame();
    } else if (G.mode === 'busted') {
      respawn(PLACES.precinct, 500, 'Busted — released from the PSPD precinct.');
    } else if (G.mode === 'wasted') {
      respawn(PLACES.hospital, 250, 'Wasted — patched up at Solano General.');
    }
  }
  if (actions & ACT_PAUSE) {
    if (G.mode === 'play') { G.mode = 'paused'; announce('Paused.'); }
    else if (G.mode === 'paused') { G.mode = 'play'; announce('Playing.'); }
  }
  if (G.mode !== 'play') return;
  if (actions & ACT_ENTER) tryEnterCar(G);
  if (actions & ACT_PUNCH) playerPunch(G);
  if (actions & ACT_RADIO) {
    const name = audio.nextStation();
    G.feed.push(`Radio: ${name}`);
  }
  if (actions & ACT_WEAPON) {
    G.player.weapon = G.player.weapon === 'fists' ? 'pistol' : 'fists';
    G.feed.push(`Weapon: ${G.player.weapon === 'fists' ? 'Fists' : 'K-9 Pistol'}`);
  }
  if (actions & ACT_SHOOT) {
    const p = G.player;
    if (p.weapon === 'pistol' && !p.car) {
      const w = renderer.toWorld(input.mouse.x, input.mouse.y, G.camera);
      playerShoot(G, w.x, w.y);
    } else if (p.weapon === 'fists') {
      playerPunch(G);
    }
  }
}

function screenForMode() {
  if (G.mode === 'title') return SCREEN_TITLE;
  if (G.mode === 'paused') return SCREEN_PAUSED;
  if (G.mode === 'busted') return SCREEN_BUSTED;
  if (G.mode === 'wasted') return SCREEN_WASTED;
  return SCREEN_PLAY;
}

function runShot(name) {
  resetWorld();
  const screen = setupShot(G, name);
  G.saveExists = !!loadSave();
  let painted = 0;
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && !window.__shotReady) {
      // The shot timer ticks in every mode, including the title backdrop.
      shotStep(G, input);
      if (G.mode === 'title') {
        G.timeSec += STEP;
        G.clock = (G.clock + STEP * 0.8) % DAY_MINUTES;
        G.nightFactor = nightFactorFor(G.clock);
        updateTraffic(G, STEP);
        updatePeds(G, STEP);
        particles.update(STEP);
      } else {
        step(STEP);
      }
      accumulator -= STEP;
    }
    renderer.draw(G, screen);
    painted += 1;
  }
  requestAnimationFrame(frame);
}

function runGame() {
  resetWorld();
  G.saveExists = !!loadSave();
  // The title screen shows the living city behind it.
  G.camera.x = PLACES.club.x;
  G.camera.y = PLACES.club.y;
  let accumulator = 0;
  let last = performance.now();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'play') {
      G.mode = 'paused';
      announce('Paused.');
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (G.mode === 'title' || G.mode === 'play') {
      while (accumulator >= STEP && (G.mode === 'title' || G.mode === 'play')) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(G, screenForMode());
  }

  announce('NEON TIDE. Press Enter to start.');
  requestAnimationFrame(frame);
}

// Debug and playtest hook (also used by the screenshot driver).
window.__neontide = {
  getState() {
    const p = G.player;
    return {
      mode: G.mode, x: Math.round(p.x), y: Math.round(p.y),
      health: Math.round(p.health), armor: Math.round(p.armor),
      money: p.money, wanted: wantedLevel(p.heat), heat: Math.round(p.heat),
      weapon: p.weapon, ammo: p.ammo, inCar: !!p.car,
      car: p.car ? p.car.type : null,
      carHp: p.car ? Math.round(p.car.hp) : null,
      carSpeed: p.car ? Math.round(p.car.speed) : null,
      mission: G.missions.current ? G.missions.current.id : null,
      stage: G.missions.M.stage, objective: G.missions.objectiveText(),
      cars: G.cars.length, peds: G.peds.length, cops: G.cops.length,
      enemies: G.enemies.filter((e) => !e.dead).length,
      clock: `${String(Math.floor(G.clock / 60) % 24).padStart(2, '0')}:${String(Math.floor(G.clock % 60)).padStart(2, '0')}`,
      debtPaid: G.debtPaid, kills: G.kills, errors: window.__neontideErrors || [],
    };
  },
  teleport(x, y) {
    const p = G.player;
    if (p.car) exitCar(G, false);
    p.x = x; p.y = y;
    G.camera.x = x; G.camera.y = y;
    return true;
  },
  setWanted(stars) {
    G.player.heat = [0, 25, 60, 120, 200, 300][Math.max(0, Math.min(5, stars))] || 0;
    return wantedLevel(G.player.heat);
  },
  startMission(i) { missions.startMission(i); return true; },
  shootAt(x, y) { playerShoot(G, x, y); return true; },
  nearestEnemy() {
    let best = null;
    let bestD = Infinity;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - G.player.x, e.y - G.player.y);
      if (d < bestD) { bestD = d; best = { x: Math.round(e.x), y: Math.round(e.y), hp: Math.round(e.hp), dist: Math.round(d) }; }
    }
    return best;
  },
  giveCar(type) {
    const p = G.player;
    const car = makeCar(G, type || 'sport', p.x + 40, p.y, 0, 'player');
    G.cars.push(car);
    p.car = car;
    return car.type;
  },
  start() { if (G.mode === 'title') newGame(); return G.mode; },
};
window.__neontideErrors = [];
window.addEventListener('error', (event) => {
  window.__neontideErrors.push(String(event.message || event.error));
});

if (shotName) runShot(shotName);
else runGame();
