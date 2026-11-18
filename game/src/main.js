// NEON TIDE v6-rebuild-2 — main.js
// Game loop, player driving/walking, car enter/exit, save/load, and the
// debug API the headless playtest uses (window.__game). Everything else is
// delegated to the focused modules in this folder.
import { Input } from './input.js';
import { buildWorld, streetLamps } from './world.js';
import { makePlayer, makeCar } from './entities.js';
import { spawnTraffic, updateTraffic, spawnParkedCars } from './traffic.js';
import { updatePolice, addWanted, wasted } from './police.js';
import { updateHeli } from './helicopter.js';
import { fireWeapon, updateEnemies, punch } from './combat.js';
import { createMissions, startMission, updateMissions, completeStep, failMission, updateHeatWave, MISSIONS } from './missions.js';
import { createGarage, carTopSpeed, carTurnRate, nosBoost } from './garage.js';
import { handleInteract, exitCar, enterCar, nearestInteractable, shopBuy } from './shops.js';
import { createWeather, updateWeather } from './weather.js';
import { createParticles, updateParticles, spawnCrash, exhaustTick } from './particles.js';
import { createAudio, resumeAudio, radioTick, nextStation, sirenTick, sfxShot, sfxPickup, sfxMission } from './audio.js';
import { initRenderer, updateRender } from './render.js';
import { updateHUD, showScreen } from './hud.js';
import { applyShot } from './shots.js';
import { SAVE_KEY, SEED, DEBT_START, CAR_TYPES, WEAPONS } from './config.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');

export function createState() {
  const S = {
    time: 0, seed: SEED,
    world: buildWorld(),
    lamps: streetLamps(),
    player: makePlayer(0, 0),
    traffic: [], peds: [], parked: [], cruisers: [], enemies: [],
    roadblock: null, spike: null,
    heli: { active: false, x: 0, y: 52, z: 0, targetX: 0, targetZ: 0, rotor: 0, strobe: 0 },
    wanted: 0, lastSeenAt: -100, wantedTimer: 0, bustedTimer: 0,
    missions: createMissions(),
    garage: createGarage(),
    weather: createWeather(),
    particles: createParticles(),
    audio: createAudio(),
    heatwave: { active: false, elapsed: 0, score: 0, takedowns: 0, lastStarAt: 0 },
    debt: DEBT_START,
    killsTotal: 0, shotsFired: 0,
    shake: 0, flash: '', dialog: null, muzzle: null, nosFlame: false,
    shotMode: false, shotHideBeacon: false, camSnap: null,
    aimHeading: 0, saveSoon: false,
    ui: { screen: 'title', shop: null },
    input: new Input(),
    completedCount: 0,
  };
  spawnTraffic(S);
  spawnParkedCars(S);
  return S;
}

const S = createState();
window.__game = makeDebugAPI(S);
window.__shotReady = false;

function saveGame() {
  try {
    const P = S.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: P.money, x: P.x, z: P.z, debt: S.debt,
      completed: S.completedCount, garage: S.garage, weapon: P.weapon,
      missionsIndex: S.missions.index,
    }));
  } catch { /* storage unavailable (headless file://) — non-fatal */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S.player.money = d.money ?? 250;
    S.player.x = d.x ?? 0; S.player.z = d.z ?? 0;
    S.debt = d.debt ?? DEBT_START;
    S.completedCount = d.completed ?? 0;
    Object.assign(S.garage, d.garage || {});
    S.player.weapon = d.weapon || 'pistol';
    return true;
  } catch { return false; }
}

// --- Player movement: on foot (WASD, Shift run) or driving (WASD + Space
// handbrake, Shift NOS). Teleport resets speed — a teleporting car that kept
// its speed used to overshoot and bounce off buildings in earlier builds.
function updatePlayer(dt) {
  const P = S.player;
  const I = S.input;
  if (P.car) {
    const car = P.car;
    const base = CAR_TYPES[car.type];
    const top = carTopSpeed(S, base.top);
    const turn = carTurnRate(S, base.turn);
    const boost = nosBoost(S, I.nos && I.up, dt);
    if (I.up) car.speed += base.accel * boost * dt;
    else if (I.dn) car.speed -= base.accel * 0.7 * dt;
    else car.speed *= Math.max(0, 1 - dt * 0.8);
    if (I.handbrake) car.speed *= Math.max(0, 1 - dt * 3.5);
    car.speed = Math.max(-top * 0.4, Math.min(top * boost, car.speed));
    const steer = (I.lf ? 1 : 0) - (I.rt ? 1 : 0);
    car.heading += steer * turn * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 40 + 0.15);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const c = S.world.collideCircle(nx, nz, 4);
    if (c.x !== nx || c.z !== nz) {
      if (Math.abs(car.speed) > 60) { spawnCrash(S, nx, nz); sfxShot(S.audio); }
      car.speed *= 0.5;
    }
    car.x = c.x; car.z = c.z;
    P.x = car.x; P.z = car.z; P.heading = car.heading; P.speed = car.speed;
    if (Math.abs(car.speed) > 100 && Math.random() < dt * 8) {
      // Tire marks on hard turns.
    }
    // Car condition: wrecked at 0 -> player is thrown out on foot.
    if (car.cond <= 0) {
      exitCar(S);
      S.flash = 'Car wrecked!';
    }
  } else {
    const runMul = I.run ? 1.8 : 1;
    const speed = 26 * runMul;
    let mx = 0, mz = 0;
    if (I.up) mz += 1;
    if (I.dn) mz -= 1;
    if (I.lf) mx -= 1;
    if (I.rt) mx += 1;
    if (mx !== 0 || mz !== 0) {
      // Movement is camera-relative: forward is the camera heading.
      const camH = P.heading;
      const fx = Math.sin(camH), fz = Math.cos(camH);
      const rx = Math.cos(camH), rz = -Math.sin(camH);
      const dx = fx * mz + rx * mx;
      const dz = fz * mz + rz * mx;
      const len = Math.hypot(dx, dz) || 1;
      P.heading = Math.atan2(dx, dz);
      const nx = P.x + (dx / len) * speed * dt;
      const nz = P.z + (dz / len) * speed * dt;
      const c = S.world.collideCircle(nx, nz, 2);
      P.x = c.x; P.z = c.z;
      P.speed = speed;
    } else P.speed = 0;
  }
  // Aim heading: mouse position relative to screen centre.
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const mdx = S.input.mouse.x - cx, mdy = S.input.mouse.y - cy;
  if (Math.abs(mdx) + Math.abs(mdy) > 10) {
    // Screen up (-y) is world forward from the camera; approximate the aim
    // heading from the mouse angle around the player.
    S.aimHeading = P.heading + Math.atan2(mdx, -mdy) * 0.9;
  }
}

function nearestCar(maxD = 14) {
  const P = S.player;
  let best = null, bestD = maxD;
  const all = [...S.parked, ...S.traffic, ...S.cruisers];
  for (const car of all) {
    if (car.cond <= 0) continue;
    const d = Math.hypot(car.x - P.x, car.z - P.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function tryEnterExit() {
  const P = S.player;
  if (P.car) {
    // E in a car near a shop exits first (shops.js handles the shop case);
    // otherwise E just exits the car.
    if (!handleInteract(S)) exitCar(S);
    return;
  }
  // On foot: shops/safehouses beat cars (handleInteract returns true then).
  if (handleInteract(S)) return;
  const car = nearestCar(14);
  if (car) {
    if (car.ai === 'traffic') addWanted(S, 1); // stealing a driven car
    enterCar(S, car);
    if (S.parked.includes(car)) S.parked = S.parked.filter((c) => c !== car);
    S.flash = `Entered ${CAR_TYPES[car.type].label}`;
  }
}

// --- World update: the kill hook counts enemies before vs after, so a kill
// is only counted when an enemy actually leaves the world.
function updateWorld(dt) {
  const before = S.enemies.length;
  updatePlayer(dt);
  updateTraffic(S, dt);
  updatePolice(S, dt);
  updateHeli(S, dt);
  if (!S.shotMode) updateEnemies(S, dt); // frozen for staged screenshots:
  // otherwise the pier sentries keep shooting the staged player (HP 96 in
  // the first pier shot) and bosses wander out of frame
  const died = before - S.enemies.length;
  if (died > 0) {
    S.killsTotal += died;
    S.heatwave.takedowns += died;
  }
  updateMissions(S, dt);
  updateHeatWave(S, dt);
  updateWeather(S, dt);
  updateParticles(S, dt);
  exhaustTick(S, dt);
  radioTick(S, dt);
  sirenTick(S, dt);
  // Health regen (slow) and wasted check.
  const P = S.player;
  if (P.health > 0 && P.health < 100 && S.time - P.lastDamageAt > 8) {
    P.health = Math.min(100, P.health + 4 * dt);
  }
  if (P.health <= 0) wasted(S);
  if (S.saveSoon) { S.saveSoon = false; saveGame(); }
  if (S.flash) S.flashTimer = (S.flashTimer || 0) + dt;
  if (S.flashTimer > 3) { S.flash = ''; S.flashTimer = 0; }
}

// --- Debug / playtest API (window.__game). Used by the headless playtest
// scripts; harmless in normal play.
function makeDebugAPI(S) {
  return {
    S,
    state: S,
    teleport(x, z) {
      const P = S.player;
      P.x = x; P.z = z; P.speed = 0;
      if (P.car) { P.car.x = x; P.car.z = z; P.car.speed = 0; }
      const c = S.world.collideCircle(P.x, P.z, 3);
      P.x = c.x; P.z = c.z;
      if (P.car) { P.car.x = c.x; P.car.z = c.z; }
    },
    giveCar(type, x, z) {
      const P = S.player;
      const cx = x ?? P.x, cz = z ?? P.z;
      const car = makeCar(type, cx, cz, P.heading);
      car.nos = S.garage.nosTank;
      S.player.car = car;
      S.player.onFoot = false;
      S.player.x = cx; S.player.z = cz;
      return car;
    },
    startMission(i) { startMission(S, i); },
    heal() { S.player.health = 100; S.player.armor = 100; },
    setWanted(n) { S.wanted = n; S.lastSeenAt = S.time; },
    setRain(v) { S.weather.autoRain = false; S.weather.rain = v; },
    setClock(h) { S.weather.clock = h; },
    buy(item) { return shopBuy(S, item); },
    openShop(kind) { S.ui.shop = kind; S.ui.screen = 'shop'; },
    closeShop() { S.ui.shop = null; S.ui.screen = 'playing'; },
    startHeatWave() {
      S.heatwave.active = true; S.heatwave.elapsed = 0;
      S.heatwave.score = 0; S.heatwave.takedowns = 0;
      S.heatwave.lastStarAt = S.time;
      S.wanted = 1; S.lastSeenAt = S.time;
    },
    shootAtNearest() {
      const P = S.player;
      let best = null, bestD = 1e9;
      for (const e of S.enemies) {
        const d = Math.hypot(e.x - P.x, e.z - P.z);
        if (d < bestD) { best = e; bestD = d; }
      }
      if (!best) return false;
      S.aimHeading = Math.atan2(best.x - P.x, best.z - P.z);
      return fireWeapon(S);
    },
    killEnemies() {
      for (const e of S.enemies) e.hp = 0;
    },
    press(code) { S.input.press(code); },
    release(code) { S.input.release(code); },
    startGame() { beginPlay(false); },
    saveGame,
    loadGame,
  };
}

// --- Screens and input routing.
function beginPlay(fresh) {
  if (fresh) {
    S.player.money = 250;
    S.player.x = 0; S.player.z = 0;
    S.debt = DEBT_START;
    S.completedCount = 0;
    S.missions = createMissions();
    S.enemies = [];
  }
  S.ui.screen = 'playing';
  showScreen(S, null);
  resumeAudio(S.audio);
}

function nextMissionOrRetry() {
  const M = S.missions;
  if (M.mode === 'failed') { startMission(S, M.index); return; }
  if (M.mode === 'complete' || M.mode === 'idle') {
    const next = M.index + 1;
    if (next < MISSIONS.length) startMission(S, next);
  }
}

function handleKeys() {
  const I = S.input;
  if (I.pause) {
    if (S.ui.screen === 'playing') { S.ui.screen = 'paused'; showScreen(S, 'pause-screen'); }
    else if (S.ui.screen === 'paused') { S.ui.screen = 'playing'; showScreen(S, null); }
  }
  if (S.ui.screen === 'title') {
    if (I.wasPressed('Enter')) beginPlay(true);
    if (I.wasPressed('KeyC')) { if (loadGame()) beginPlay(false); }
    if (I.wasPressed('KeyH')) { beginPlay(true); window.__game.startHeatWave(); }
    return;
  }
  if (S.ui.screen === 'shop') {
    if (I.wasPressed('Escape') || I.wasPressed('KeyE')) { S.ui.shop = null; S.ui.screen = 'playing'; showScreen(S, null); }
    return;
  }
  if (S.ui.screen === 'busted' || S.ui.screen === 'wasted') {
    if (I.wasPressed('Enter')) {
      S.player.x = 0; S.player.z = 0;
      if (S.player.car) { S.player.car = null; S.player.onFoot = true; }
      S.ui.screen = 'playing'; showScreen(S, null);
    }
    return;
  }
  if (S.ui.screen === 'won') return;
  if (S.ui.screen !== 'playing') return;
  if (I.interact) tryEnterExit();
  if (I.wasPressed('Enter')) nextMissionOrRetry();
  if (I.radioNext) nextStation(S.audio);
  if (I.wasPressed('Digit1')) S.player.weapon = 'fists';
  if (I.wasPressed('Digit2')) S.player.weapon = 'pistol';
  if (I.wasPressed('Digit3') && S.player.ammo.smg > 0) S.player.weapon = 'smg';
  if (I.shoot) {
    if (S.player.weapon === 'fists') punch(S);
    else if (fireWeapon(S)) sfxShot(S.audio);
  }
}

// --- Boot.
function boot() {
  S.input.attach(window);
  initRenderer(S);
  // Shop buttons.
  document.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const msg = shopBuy(S, btn.dataset.buy);
      const note = document.getElementById('shop-note');
      if (note) note.textContent = msg || 'Cannot buy that right now';
    });
  });
  const closeBtn = document.getElementById('shop-close');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    S.ui.shop = null; S.ui.screen = 'playing'; showScreen(S, null);
  });
  const newBtn = document.getElementById('btn-new');
  if (newBtn) newBtn.addEventListener('click', () => beginPlay(true));
  const contBtn = document.getElementById('btn-continue');
  if (contBtn) contBtn.addEventListener('click', () => { if (loadGame()) beginPlay(false); });
  const heatBtn = document.getElementById('btn-heatwave');
  if (heatBtn) heatBtn.addEventListener('click', () => { beginPlay(true); window.__game.startHeatWave(); });
  const resumeBtn = document.getElementById('btn-resume');
  if (resumeBtn) resumeBtn.addEventListener('click', () => { S.ui.screen = 'playing'; showScreen(S, null); });
  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) retryBtn.addEventListener('click', () => nextMissionOrRetry());
  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) restartBtn.addEventListener('click', () => beginPlay(true));

  if (SHOT) {
    // Screenshot mode: skip the title screen, stage the shot.
    S.ui.screen = 'playing';
    showScreen(S, null);
    applyShot(S, SHOT);
  } else {
    showScreen(S, 'title-screen');
  }

  let last = performance.now();
  let lastScreen = S.ui.screen;
  function frame(now) {
    const rawDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // End screens (busted / wasted / won) are shown here, not in police.js
    // (which cannot import the HUD without a module cycle).
    if (S.ui.screen !== lastScreen) {
      lastScreen = S.ui.screen;
      const title = document.getElementById('end-title');
      const text = document.getElementById('end-text');
      if (S.ui.screen === 'busted') {
        if (title) title.textContent = 'BUSTED';
        if (text) text.textContent = 'The PSPD caught up with you. $500 fine.';
        showScreen(S, 'end-screen');
      } else if (S.ui.screen === 'wasted') {
        if (title) title.textContent = 'WASTED';
        if (text) text.textContent = 'You got taken down. The hospital patched you up — $300.';
        showScreen(S, 'end-screen');
      } else if (S.ui.screen === 'won') {
        if (title) title.textContent = 'KING OF PORT SOLANO';
        if (text) text.textContent = 'Debt paid. The city is yours, Deke.';
        showScreen(S, 'end-screen');
      }
    }
    // Headless swiftshader runs ~4 fps; game time still advances per frame.
    const dt = rawDt;
    if (S.ui.screen === 'playing' || SHOT) {
      S.time += dt;
      handleKeys();
      if (S.ui.screen === 'playing' || SHOT) updateWorld(dt);
    } else {
      handleKeys();
    }
    updateRender(S, dt);
    updateHUD(S);
    S.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
