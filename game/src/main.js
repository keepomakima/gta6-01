// NEON TIDE v7-coverfix — main.js (structural pass)
// Entry point: builds the state, runs the frame loop, wires input and
// screens. New Game opens the intro cutscene (skippable); a cutscene
// freezes the world while on screen; the finale plays when won.
import { Input } from './input.js';
import { streetLamps, buildWorld } from './world.js';
import { makeCar, makePlayer } from './entities.js';
import { spawnParkedCars, spawnTraffic, updateTraffic } from './traffic.js';
import { wasted, updatePolice, addWanted } from './police.js';
import { updateHeli } from './helicopter.js';
import { punch, fireWeapon, updateEnemies } from './combat.js';
import { MISSIONS, completeStep, createMissions, failMission, startMission, updateHeatWave, updateMissions } from './missions.js';
import { carTopSpeed, carTurnRate, createGarage, nosBoost } from './garage.js';
import { enterCar, exitCar, handleInteract, nearestInteractable, shopBuy } from './shops.js';
import { createWeather, updateWeather } from './weather.js';
import { createParticles, exhaustTick, spawnCrash, updateParticles } from './particles.js';
import { createAudio, nextStation, radioTick, resumeAudio, sfxMission, sfxPickup, sfxShot, sirenTick } from './audio.js';
import { initRenderer, updateRender } from './render.js';
import { showScreen, updateHUD } from './hud.js';
import { applyShot } from './shots.js';
import { INTRO_SCENES, advanceCutscene, createCutscene, skipCutscene, startCutscene } from './cutscene.js';
import { checkTrophies, createTrophyCase, trophyLoadIds, trophySaveIds } from './achievements.js';
import { chatterTick, createChatter } from './chatter.js';
import { createStunts, updateStunts } from './stunts.js';
import { createStats, statsLoadRecords, statsSaveRecords, updateStats } from './stats.js';
import { updatePedRoles } from './pedestrians.js';
import { CAR_TYPES, DEBT_START, SAVE_KEY, SEED, WEAPONS } from './config.js';

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
    cutscene: createCutscene(),
    achievements: createTrophyCase(),
    chatter: createChatter(),
    stunts: createStunts(),
    stats: createStats(),
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
    ui: { shop: null, screen: 'title' },
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
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: S.player.money, x: S.player.x, z: S.player.z, debt: S.debt,
      completed: S.completedCount, garage: S.garage, weapon: S.player.weapon,
      missionsIndex: S.missions.index, trophies: trophySaveIds(S),
      records: statsSaveRecords(S),
    }));
  } catch { /* storage unavailable (headless file://) — non-fatal */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S.player.money = d.money ?? 250;
    S.player.x = d.x ?? 0;
    S.player.z = d.z ?? 0;
    S.debt = d.debt ?? DEBT_START;
    S.completedCount = d.completed ?? 0;
    Object.assign(S.garage, d.garage ? d.garage : {});
    S.player.weapon = d.weapon || 'pistol';
    trophyLoadIds(S, d.trophies);
    statsLoadRecords(S, d.records);
    return true;
  } catch { return false; }
}

// Driving: throttle/brake/coast, steering that bites harder with speed,
// NOS boost, wall collisions that bleed speed and spark.
function driveCar(S, P, car, I, dt) {
  const spec = CAR_TYPES[car.type];
  const maxV = carTopSpeed(S, spec.top);
  const turnR = carTurnRate(S, spec.turn);
  const nos = nosBoost(S, I.nos && I.up, dt);
  if (I.up) car.speed += spec.accel * nos * dt;
  else if (I.dn) car.speed -= spec.accel * 0.7 * dt;
  else car.speed *= Math.max(0, 1 - dt * 0.8);
  if (I.handbrake) car.speed *= Math.max(0, 1 - dt * 3.5);
  if (car.speed > maxV * nos) car.speed = maxV * nos;
  if (car.speed < -maxV * 0.4) car.speed = -maxV * 0.4;
  let dir = 0;
  if (I.lf) dir += 1;
  if (I.rt) dir -= 1;
  car.heading += dir * turnR * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 40 + 0.15);
  const x2 = car.x + Math.sin(car.heading) * car.speed * dt;
  const z2 = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = S.world.collideCircle(x2, z2, 4);
  if (hit.x - x2 || hit.z - z2) {
    if (Math.abs(car.speed) > 60) { spawnCrash(S, x2, z2); sfxShot(S.audio); }
    car.speed *= 0.5;
  }
  car.x = hit.x;
  car.z = hit.z;
  P.x = car.x;
  P.z = car.z;
  P.heading = car.heading;
  P.speed = car.speed;
  if (car.cond <= 0) {
    exitCar(S);
    S.flash = 'Car wrecked!';
  }
}

// On foot: WASD moves relative to the camera heading, Shift runs.
function walkPlayer(S, P, I, dt) {
  const v = I.run ? 46.8 : 26;
  const mx = (I.rt ? 1 : 0) - (I.lf ? 1 : 0);
  const mz = (I.up ? 1 : 0) - (I.dn ? 1 : 0);
  if (mx !== 0 || mz !== 0) {
    const h = P.heading;
    const sx = Math.sin(h), sz = Math.cos(h);
    const rx = Math.cos(h), rz = -Math.sin(h);
    const wx = sx * mz + rx * mx;
    const wz = sz * mz + rz * mx;
    let n = Math.hypot(wx, wz);
    if (!n) n = 1;
    P.heading = Math.atan2(wx, wz);
    const x2 = P.x + (wx / n) * v * dt;
    const z2 = P.z + (wz / n) * v * dt;
    const hit = S.world.collideCircle(x2, z2, 2);
    P.x = hit.x;
    P.z = hit.z;
    P.speed = v;
  } else P.speed = 0;
}

function updatePlayer(dt) {
  const P = S.player;
  const I = S.input;
  if (P.car) driveCar(S, P, P.car, I, dt);
  else walkPlayer(S, P, I, dt);
  // Mouse aim: the aim heading follows the cursor from screen centre.
  const cy = window.innerHeight / 2;
  const cx = window.innerWidth / 2;
  const dx = S.input.mouse.x - cx, dy = S.input.mouse.y - cy;
  if (Math.abs(dx) + Math.abs(dy) > 10) {
    S.aimHeading = P.heading + Math.atan2(dx, -dy) * 0.9;
  }
}

function nearestCar(maxD = 14) {
  const P = S.player;
  let near = null, nearD = maxD;
  const cars = [...S.parked, ...S.traffic, ...S.cruisers];
  cars.forEach((c) => {
    if (c.cond <= 0) return;
    const dist = Math.hypot(c.x - P.x, c.z - P.z);
    if (dist < nearD) { near = c; nearD = dist; }
  });
  return near;
}

function tryEnterExit() {
  const P = S.player;
  if (P.car) {
    if (!handleInteract(S)) exitCar(S);
    return;
  }
  if (handleInteract(S)) return;
  const c = nearestCar(14);
  if (c) {
    if (c.ai === 'traffic') addWanted(S, 1); // stealing a driven car
    enterCar(S, c);
    const idx = S.parked.indexOf(c);
    if (idx >= 0) S.parked.splice(idx, 1);
    S.flash = `Entered ${CAR_TYPES[c.type].label}`;
  }
}

function updateWorld(dt) {
  const n0 = S.enemies.length;
  updatePlayer(dt);
  updateTraffic(S, dt);
  updatePolice(S, dt);
  updateHeli(S, dt);
  if (!S.shotMode) updateEnemies(S, dt); // frozen for staged screenshots
  const lost = n0 - S.enemies.length;
  if (lost > 0) {
    S.killsTotal += lost;
    S.heatwave.takedowns += lost;
  }
  updateMissions(S, dt);
  updateHeatWave(S, dt);
  updateStunts(S, dt);
  updateStats(S, dt);
  checkTrophies(S);
  chatterTick(S);
  updatePedRoles(S);
  updateWeather(S, dt);
  updateParticles(S, dt);
  exhaustTick(S, dt);
  radioTick(S, dt);
  sirenTick(S, dt);
  const pl = S.player;
  if (pl.health > 0 && pl.health < 100 && S.time - pl.lastDamageAt > 8) {
    pl.health = Math.min(100, pl.health + 4 * dt);
  }
  if (pl.health <= 0) wasted(S);
  if (S.saveSoon) { S.saveSoon = false; saveGame(); }
  if (S.flash) S.flashTimer = (S.flashTimer || 0) + dt;
  if (S.flashTimer > 3) { S.flash = ''; S.flashTimer = 0; }
}

function makeDebugAPI(S) {
  return {
    S,
    state: S,
    teleport(x, z) {
      const pl = S.player;
      pl.x = x;
      pl.z = z;
      pl.speed = 0;
      if (pl.car) { pl.car.x = x; pl.car.z = z; pl.car.speed = 0; }
      const hit = S.world.collideCircle(pl.x, pl.z, 3);
      pl.x = hit.x;
      pl.z = hit.z;
      if (pl.car) { pl.car.x = hit.x; pl.car.z = hit.z; }
    },
    giveCar(type, x, z) {
      const pl = S.player;
      const x0 = x ?? pl.x, z0 = z ?? pl.z;
      const car = makeCar(type, x0, z0, pl.heading);
      car.nos = S.garage.nosTank;
      S.player.car = car;
      S.player.onFoot = false;
      S.player.x = x0;
      S.player.z = z0;
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
      S.heatwave.active = true;
      S.heatwave.elapsed = 0;
      S.heatwave.score = 0;
      S.heatwave.takedowns = 0;
      S.heatwave.lastStarAt = S.time;
      S.wanted = 1;
      S.lastSeenAt = S.time;
    },
    shootAtNearest() {
      const pl = S.player;
      let near = null, nearD = 1e9;
      S.enemies.forEach((e) => {
        const dist = Math.hypot(e.x - pl.x, e.z - pl.z);
        if (dist < nearD) { near = e; nearD = dist; }
      });
      if (!near) return false;
      S.aimHeading = Math.atan2(near.x - pl.x, near.z - pl.z);
      return fireWeapon(S);
    },
    killEnemies() {
      S.enemies.forEach((foe) => { foe.hp = 0; });
    },
    press(code) { S.input.press(code); },
    release(code) { S.input.release(code); },
    startGame() { beginPlay(false); },
    skipCutscene() { skipCutscene(S); },
    startIntro() { startCutscene(S, INTRO_SCENES); },
    saveGame,
    loadGame,
  };
}

function beginPlay(fresh) {
  if (fresh) {
    Object.assign(S.player, { money: 250, x: 0, z: 0 });
    S.debt = DEBT_START;
    S.completedCount = 0;
    S.missions = createMissions();
    S.enemies = [];
  }
  S.ui.screen = 'playing';
  showScreen(S, null);
  resumeAudio(S.audio);
  // A fresh game opens with the intro cutscene (Kestrel vs Deke).
  if (fresh) startCutscene(S, INTRO_SCENES);
}

function nextMissionOrRetry() {
  const ms = S.missions;
  if (ms.mode === 'failed') { startMission(S, ms.index); return; }
  if (ms.mode === 'complete' || ms.mode === 'idle') {
    if (ms.index + 1 < MISSIONS.length) startMission(S, ms.index + 1);
  }
}

function handleKeys() {
  const inp = S.input;
  // A cutscene eats input first: Enter/Space advance, Esc skips.
  if (S.cutscene.active) {
    if (inp.advance) advanceCutscene(S);
    if (inp.pause) skipCutscene(S);
    return;
  }
  if (inp.pause) {
    if (S.ui.screen === 'playing') { S.ui.screen = 'paused'; showScreen(S, 'pause-screen'); }
    else if (S.ui.screen === 'paused') { S.ui.screen = 'playing'; showScreen(S, null); }
  }
  switch (S.ui.screen) {
    case 'title':
      if (inp.wasPressed('Enter')) beginPlay(true);
      if (inp.wasPressed('KeyC')) { if (loadGame()) beginPlay(false); }
      if (inp.wasPressed('KeyH')) { beginPlay(true); window.__game.startHeatWave(); }
      return;
    case 'shop':
      if (inp.wasPressed('Escape') || inp.wasPressed('KeyE')) { S.ui.shop = null; S.ui.screen = 'playing'; showScreen(S, null); }
      return;
    case 'busted':
    case 'wasted':
      if (inp.wasPressed('Enter')) {
        S.player.x = 0;
        S.player.z = 0;
        if (S.player.car) { S.player.car = null; S.player.onFoot = true; }
        S.ui.screen = 'playing';
        showScreen(S, null);
      }
      return;
    case 'won':
      return;
    default:
      break;
  }
  if (S.ui.screen !== 'playing') return;
  if (inp.interact) tryEnterExit();
  if (inp.wasPressed('Enter')) nextMissionOrRetry();
  if (inp.radioNext) nextStation(S.audio);
  for (const [code, w] of [['Digit1', 'fists'], ['Digit2', 'pistol']]) {
    if (inp.wasPressed(code)) S.player.weapon = w;
  }
  if (inp.wasPressed('Digit3') && S.player.ammo.smg > 0) S.player.weapon = 'smg';
  if (inp.shoot) {
    if (S.player.weapon === 'fists') punch(S);
    else if (fireWeapon(S)) sfxShot(S.audio);
  }
}

function wire(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function boot() {
  S.input.attach(window);
  initRenderer(S);
  document.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = shopBuy(S, btn.dataset.buy);
      const note = document.getElementById('shop-note');
      if (note) note.textContent = m || 'Cannot buy that right now';
    });
  });
  wire('shop-close', () => {
    S.ui.shop = null; S.ui.screen = 'playing'; showScreen(S, null);
  });
  wire('btn-new', () => beginPlay(true));
  wire('btn-continue', () => { if (loadGame()) beginPlay(false); });
  wire('btn-heatwave', () => { beginPlay(true); window.__game.startHeatWave(); });
  wire('btn-resume', () => { S.ui.screen = 'playing'; showScreen(S, null); });
  wire('btn-retry', () => nextMissionOrRetry());
  wire('btn-restart', () => beginPlay(true));
  wire('cs-next', () => advanceCutscene(S));
  wire('cs-skip', () => skipCutscene(S));

  if (SHOT) {
    S.ui.screen = 'playing';
    showScreen(S, null);
    applyShot(S, SHOT);
  } else {
    showScreen(S, 'title-screen');
  }

  let prev = performance.now();
  let prevScreen = S.ui.screen;
  function frame(now) {
    let step = (now - prev) / 1000;
    if (step > 0.1) step = 0.1;
    prev = now;
    if (S.ui.screen !== prevScreen) {
      prevScreen = S.ui.screen;
      const t1 = document.getElementById('end-title');
      const t2 = document.getElementById('end-text');
      switch (S.ui.screen) {
        case 'busted':
          if (t1) t1.textContent = 'BUSTED';
          if (t2) t2.textContent = 'The PSPD caught up with you. $500 fine.';
          showScreen(S, 'end-screen');
          break;
        case 'wasted':
          if (t1) t1.textContent = 'WASTED';
          if (t2) t2.textContent = 'You got taken down. The hospital patched you up — $300.';
          showScreen(S, 'end-screen');
          break;
        case 'won':
          if (t1) t1.textContent = 'KING OF PORT SOLANO';
          if (t2) t2.textContent = 'Debt paid. The city is yours, Deke.';
          showScreen(S, 'end-screen');
          break;
        default:
          break;
      }
    }
    if (S.ui.screen === 'playing' || SHOT) {
      S.time += step;
      handleKeys();
      // A live cutscene freezes the world (staged shots exempt: their
      // systems are already frozen individually, and peds keep walking).
      const held = SHOT ? false : S.cutscene.active;
      if ((S.ui.screen === 'playing' || SHOT) && !held) updateWorld(step);
    } else {
      handleKeys();
    }
    updateRender(S, step);
    updateHUD(S);
    S.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
