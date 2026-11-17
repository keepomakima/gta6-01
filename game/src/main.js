// NEON TIDE — main.js
// Boot, the game loop, menus, saving and the debug hook. This is the file
// index.html loads; it wires every system together into one game state G.

import { WORLD_W, WORLD_H, DAY_LENGTH, START_TIME, PLACES } from './config.js';
import { makeRng, clamp } from './random.js';
import { createInput } from './input.js';
import { buildWorld } from './world.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, spawnPeds, updatePeds, updateEnemies, updatePickups, spawnPickup } from './entities.js';
import { spawnParkedCars, spawnTraffic, updateTraffic, resolveCarCollisions } from './traffic.js';
import { updatePolice, wantedStars } from './police.js';
import { startMission, updateMission, MISSION_NAMES } from './missions.js';
import { updateBullets } from './combat.js';
import { updateParticles } from './particles.js';
import { draw } from './render.js';
import { applyShot, tickShot } from './shots.js';

const SAVE_KEY = 'neontide-save-v2';

function queryParams() {
  return new URLSearchParams(window.location.search);
}

function createGame() {
  const params = queryParams();
  const seed = Number(params.get('seed') || 7);
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const G = {
    seed,
    rng: makeRng(seed),
    canvas, ctx,
    input: createInput(canvas),
    audio: createAudio(),
    world: null,
    time: 18.0,
    mode: 'title',
    player: null,
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    marks: [],
    messages: [],
    dialog: null,
    mission: null,
    missionFlash: null,
    completedMissions: [],
    debtPaid: 0,
    storyDone: false,
    heat: 0,
    wanted: 0,
    lastSeenT: 0,
    roadblock: null,
    camera: { x: 800, y: 400 },
    shake: 0,
    flash: null,
    frame: 0,
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, busted: 0, wasted: 0 },
    saveExists: false,
    nextMissionT: 0,
    recentShot: false,
    shot: null,
  };
  G.world = buildWorld(seed);
  G.player = createPlayer(PLACES.garage.x, PLACES.garage.y - 40);
  // The city starts populated: parked cars, traffic and pedestrians.
  spawnParkedCars(G, 16);
  spawnTraffic(G, 12);
  spawnPeds(G, 26);
  // A few pickups scattered around the city.
  spawnPickup(G, 900, 500, 'health', 25);
  spawnPickup(G, 1500, 900, 'armor', 50);
  spawnPickup(G, 500, 1100, 'ammo', 24);
  spawnPickup(G, 1800, 300, 'cash', 60);
  // A save, if one exists, can be continued from the title screen.
  try {
    G.saveExists = !!localStorage.getItem(SAVE_KEY);
  } catch {
    G.saveExists = false;
  }
  const shotName = params.get('shot');
  if (shotName) applyShot(G, shotName);
  return G;
}

function saveGame(G) {
  const p = G.player;
  const data = {
    money: p.money,
    hp: p.hp,
    armor: p.armor,
    ammo: p.ammo,
    weapon: p.weapon,
    x: p.x, y: p.y,
    time: G.time,
    missionIndex: G.mission ? G.mission.index : G.completedMissions.length,
    completedMissions: G.completedMissions,
    debtPaid: G.debtPaid,
    stats: G.stats,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}

function loadSave(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const p = G.player;
    p.money = d.money;
    p.hp = d.hp;
    p.armor = d.armor;
    p.ammo = d.ammo;
    p.weapon = d.weapon;
    p.x = d.x;
    p.y = d.y;
    G.time = d.time ?? 18;
    G.completedMissions = d.completedMissions || [];
    G.debtPaid = d.debtPaid || 0;
    G.stats = { ...G.stats, ...(d.stats || {}) };
    if (p.inCar) p.inCar = null;
    const next = Math.min(d.missionIndex ?? 0, MISSION_NAMES.length - 1);
    if (next < MISSION_NAMES.length) startMission(G, next);
    return true;
  } catch {
    return false;
  }
}

function startNewGame(G) {
  const p = G.player;
  p.x = PLACES.garage.x;
  p.y = PLACES.garage.y - 40;
  p.hp = p.maxHp;
  p.armor = 0;
  p.money = 250;
  p.ammo = 24;
  p.weapon = 'fists';
  p.inCar = null;
  G.completedMissions = [];
  G.debtPaid = 0;
  G.storyDone = false;
  G.heat = 0;
  G.wanted = 0;
  G.time = START_TIME;
  G.enemies.length = 0;
  G.cops.length = 0;
  G.roadblock = null;
  G.mode = 'play';
  startMission(G, 0);
}

function updateCamera(G, dt) {
  const p = G.player;
  const tx = clamp(p.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(p.y - 360, 0, WORLD_H - 720);
  if (G.mode === 'title') return; // the title shot pans the camera itself
  const k = 1 - Math.pow(0.001, dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
}

function update(G, dt) {
  G.frame += 1;
  const input = G.input;
  // Audio unlocks on the first gesture.
  if (input.pressed.size > 0 || input.mousePressed) G.audio.ensure();

  if (G.mode === 'title') {
    if (input.hit('Enter')) {
      G.audio.ensure();
      if (G.saveExists && !input.down('KeyN')) {
        if (loadSave(G)) G.mode = 'play';
        else startNewGame(G);
      } else {
        startNewGame(G);
      }
    }
    if (input.hit('KeyN')) startNewGame(G);
    updateCamera(G, dt);
    return;
  }

  if (G.mode === 'pause') {
    if (input.hit('Escape') || input.hit('Enter')) G.mode = 'play';
    if (input.hit('KeyQ')) {
      saveGame(G);
      G.mode = 'title';
      G.saveExists = true;
    }
    if (input.hit('KeyM')) {
      G.audio.setMuted(!G.audio.muted);
    }
    return;
  }

  if (G.mode === 'busted' || G.mode === 'wasted') {
    if (input.hit('Enter')) {
      G.mode = 'play';
      // The next mission resumes where the story left off.
      if (!G.mission && G.completedMissions.length < 8) {
        startMission(G, G.completedMissions.length);
      }
    }
    return;
  }

  if (G.mode === 'complete') {
    if (input.hit('Enter')) {
      G.mode = 'play';
      G.storyDone = false;
      // Free roam after the story: no active mission.
      G.mission = null;
    }
    return;
  }

  // --- play mode ---
  if (input.hit('Escape')) {
    G.mode = 'pause';
    saveGame(G);
    return;
  }
  if (input.hit('KeyR')) {
    if (!G.audio.radioOn) G.audio.ensure();
    G.audio.setRadio(!G.audio.radioOn);
    if (G.audio.radioOn) G.audio.cycleStation();
  }
  if (input.hit('KeyQ') && G.audio.radioOn) {
    G.audio.cycleStation();
  }
  if (input.hit('KeyM')) {
    G.audio.setMuted(!G.audio.muted);
  }

  // The clock runs: one game day per DAY_LENGTH seconds.
  G.time = (G.time + (dt / DAY_LENGTH) * 24) % 24;

  // Breather between missions.
  if (G.nextMissionT > 0) {
    G.nextMissionT -= dt;
    if (G.nextMissionT <= 0 && G.completedMissions.length < 8) {
      startMission(G, G.completedMissions.length);
    }
  }

  updatePlayer(G, dt);
  updateTraffic(G, dt);
  resolveCarCollisions(G);
  updatePolice(G, dt);
  updatePeds(G, dt);
  updateEnemies(G, dt);
  updatePickups(G, dt);
  updateBullets(G, dt);
  updateMission(G, dt);
  updateParticles(G, dt);

  // Dialog lines advance and expire.
  if (G.dialog) {
    G.dialog.t += dt;
    if (G.dialog.t > 7) G.dialog = null;
  }
  for (let i = G.messages.length - 1; i >= 0; i -= 1) {
    G.messages[i].t -= dt;
    if (G.messages[i].t <= 0) G.messages.splice(i, 1);
  }
  if (G.missionFlash) {
    G.missionFlash.t -= dt;
    if (G.missionFlash.t <= 0) G.missionFlash = null;
  }

  // Engine sound follows the driven car.
  const car = G.player.inCar ? G.cars.find((c) => c.id === G.player.inCar) : null;
  G.audio.setEngine(car ? Math.abs(car.speed) / car.top : 0, !!car);

  // Autosave every 20 seconds of play.
  G.saveT = (G.saveT || 0) + dt;
  if (G.saveT > 20) {
    G.saveT = 0;
    saveGame(G);
  }

  updateCamera(G, dt);
}

function loop(G, last) {
  const now = performance.now();
  const dt = clamp((now - last) / 1000, 0, 0.05);
  if (G.shot) tickShot(G, dt);
  update(G, dt);
  draw(G);
  G.input.endFrame();
  // Pass this frame's own performance.now() as the next frame's `last`:
  // the rAF callback timestamp is the frame's start time, not the previous
  // frame's, so passing it would make dt near zero.
  requestAnimationFrame(() => loop(G, now));
}

const G = createGame();
window.__neontide = {
  getState() {
    return {
      mode: G.mode,
      money: G.player.money,
      hp: G.player.hp,
      wanted: G.wanted,
      mission: G.mission ? G.mission.name : null,
      missionsDone: G.completedMissions.length,
      cars: G.cars.length,
      peds: G.peds.length,
      enemies: G.enemies.length,
      cops: G.cops.length,
      time: G.time.toFixed(2),
      player: { x: Math.round(G.player.x), y: Math.round(G.player.y), inCar: !!G.player.inCar },
    };
  },
  game: G,
};
window.__shotReady = false;
requestAnimationFrame((t) => loop(G, t));
