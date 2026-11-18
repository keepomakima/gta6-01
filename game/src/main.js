// NEON TIDE v4 — main: game state, the loop, modes, save/load, wiring.
// One job: own the frame — create the world, step every system, draw it.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, START_MONEY, PLACES, SHOT_SEED } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { buildWorld, nearestRoadPoint } from './world.js';
import { makePlayer, makeCar, spawnParkedCars, spawnPedestrians, movePlayerOnFoot, driveCar, nearestCar } from './entities.js';
import { spawnTrafficCars, updateTraffic, updatePedestrians } from './traffic.js';
import { updatePolice, addWanted, crimeSeen, damagePlayer, bustPlayer, standDown, spawnFootCop } from './police.js';
import { makeHelicopter, updateHelicopter } from './helicopter.js';
import { updateMissions, startMission, setDialog, failMission } from './missions.js';
import { playerPunch, playerShoot, updateBullets, updateEnemies } from './combat.js';
import { nearGunShop, nearSafehouse, openShop, closeShop, buySelected, useSafehouse, cycleGarageCar } from './shops.js';
import { AudioSys } from './audio.js';
import { Particles } from './particles.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawEnd } from './render.js';
import { setupShot, stepShot } from './shots.js';

const SAVE_KEY = 'neon-tide-v4-save';

export function createGame(seed = 20261118) {
  const rng = makeRng(seed);
  const world = buildWorld(rng);
  const G = {
    seed, rng, world,
    mode: 'title',
    time: 0, clock: 13.0, day: 1,
    player: makePlayer(620, 520),
    cars: [],
    peds: [],
    cops: [],
    cruisers: [],
    enemies: [],
    bullets: [],
    drops: [],
    roadblock: null,
    heli: makeHelicopter(),
    wanted: 0, heatT: 0, lastSeenT: 0,
    missionsDone: 0, mission: null, marker: null,
    dialog: null, hint: '', shopOpen: false, shopSel: 0, shopMsg: '',
    retryT: 0, retryId: 0, garageIdx: 0, bustedKind: 'busted',
    combatNoise: 0, shake: 0,
    cam: { x: 0, y: 0 },
    input: null, audio: new AudioSys(), particles: new Particles(),
    hasSave: false,
  };
  G.cars = [...spawnParkedCars(world, rng), ...spawnTrafficCars(world, rng, 10)];
  G.peds = spawnPedestrians(world, rng, 26);
  G.input = new Input();
  G.saveGame = () => saveGame(G);
  G.loadGame = () => loadGame(G);
  return G;
}

export function saveGame(G) {
  try {
    const p = G.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: p.money, debt: p.debt, missionsDone: G.missionsDone,
      x: p.x, y: p.y, hp: p.hp, armor: p.armor, day: G.day, clock: G.clock,
      owned: p.owned, ammo: p.ammo, weapon: p.weapon,
      kills: p.kills, carsStolen: p.carsStolen,
    }));
    G.hasSave = true;
  } catch { /* storage unavailable: play on without saving */ }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const p = G.player;
    p.money = s.money; p.debt = s.debt; p.hp = s.hp; p.armor = s.armor;
    p.x = s.x; p.y = s.y; p.owned = s.owned; p.ammo = s.ammo; p.weapon = s.weapon;
    p.kills = s.kills || 0; p.carsStolen = s.carsStolen || 0;
    G.missionsDone = s.missionsDone || 0;
    G.day = s.day || 1; G.clock = s.clock || 13;
    return true;
  } catch { return false; }
}

export function startNewGame(G) {
  G.mode = 'play';
  G.player = makePlayer(620, 520);
  G.missionsDone = 0;
  G.wanted = 0;
  standDown(G);
  G.enemies = []; G.bullets = []; G.drops = [];
  G.clock = 13.0; G.day = 1;
  startMission(G, 1);
  G.audio.resume();
  G.audio.startRadio();
}

export function continueGame(G) {
  if (loadGame(G)) {
    G.mode = 'play';
    startMission(G, Math.min(12, G.missionsDone + 1));
    G.audio.resume();
    G.audio.startRadio();
  } else startNewGame(G);
}

function tryEnterCar(G) {
  const p = G.player;
  if (p.inCar) {
    const car = p.inCar;
    car.driver = null; car.parked = true;
    p.inCar = null; p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    G.audio.engineStop();
    G.audio.sfx('door');
    return;
  }
  const car = nearestCar(G, 70);
  if (!car) return;
  if (car.driver === 'ai' || car.driver === 'police' || car.driver === 'roadblock') {
    // Steal it: the driver flees on foot.
    car.driver = null;
    p.carsStolen += 1;
    if (crimeSeen(G)) addWanted(G, 1);
    G.particles.popup(car.x, car.y - 30, 'CAR STOLEN', '#ff9e5e', true);
  } else if (car.parked) {
    p.carsStolen += 1;
    if (crimeSeen(G)) addWanted(G, 1);
  }
  car.parked = false;
  car.driver = 'player';
  p.inCar = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  G.audio.engineStart();
  G.audio.sfx('door');
}

function updateCamera(G) {
  const p = G.player;
  const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2));
  G.cam.x += (tx - G.cam.x) * 0.2;
  G.cam.y += (ty - G.cam.y) * 0.2;
}

function updatePlay(G, dt) {
  const p = G.player;
  const inp = G.input;
  G.time += dt;
  G.clock += dt / 20; // one game hour per 20 real seconds
  if (G.clock >= 24) { G.clock -= 24; G.day += 1; }
  if (G.dialog) { G.dialog.t -= dt; if (G.dialog.t <= 0) G.dialog = null; }
  if (G.combatNoise > 0) G.combatNoise -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 20);
  if (G.retryT > 0) {
    G.retryT -= dt;
    if (G.retryT <= 0) startMission(G, G.retryId);
  }

  // Shop / safehouse interaction.
  G.hint = '';
  if (G.shopOpen) {
    if (inp.wasPressed('ArrowUp')) G.shopSel = (G.shopSel + 3) % 4;
    if (inp.wasPressed('ArrowDown')) G.shopSel = (G.shopSel + 1) % 4;
    if (inp.wasPressed('Enter')) G.shopMsg = buySelected(G);
    if (inp.wasPressed('Escape')) closeShop(G);
    return;
  }
  if (nearGunShop(G) && p.onFoot) G.hint = 'E — ENTER IRONWORKS ARMS (gun shop)';
  const house = nearSafehouse(G);
  if (house && p.onFoot) G.hint = `E — ${house.name.toUpperCase()} (heal + save)   G — swap garage car`;
  if (inp.wasPressed('e') && p.onFoot) {
    if (nearGunShop(G)) openShop(G);
    else if (house) useSafehouse(G, house);
  }
  if (inp.wasPressed('g') && house && p.onFoot) {
    const type = cycleGarageCar(G);
    G.particles.popup(p.x, p.y - 40, `GARAGE: ${type.toUpperCase()} READY OUTSIDE`, '#7dff8a', true);
  }
  if (inp.wasPressed('e') && !G.shopOpen) tryEnterCar(G);
  if (inp.wasPressed('r')) G.audio.nextStation();
  if (inp.wasPressed('m')) G.audio.toggleMute();
  if (inp.wasPressed('Escape')) { G.mode = 'pause'; return; }
  if (inp.wasPressed('1')) p.weapon = 'fists';
  if (inp.wasPressed('2') && p.owned.pistol) p.weapon = 'pistol';
  if (inp.wasPressed('3') && p.owned.smg) p.weapon = 'smg';
  if (inp.wasPressed('4') && p.owned.shotgun) p.weapon = 'shotgun';

  // Movement + combat.
  if (p.inCar) driveCar(G, p.inCar, dt);
  else movePlayerOnFoot(G, dt);
  if (inp.wasPressed('f')) playerPunch(G);
  if (inp.mousePressed && p.onFoot) {
    const wx = G.input.mouseX + G.cam.x;
    const wy = G.input.mouseY + G.cam.y;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    playerShoot(G, wx, wy);
  }
  if (inp.mouseDown && p.onFoot && p.weapon !== 'fists') {
    const wx = G.input.mouseX + G.cam.x;
    const wy = G.input.mouseY + G.cam.y;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    playerShoot(G, wx, wy);
  }

  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePolice(G, dt);
  updateHelicopter(G, dt);
  updateBullets(G, dt);
  updateEnemies(G, dt);
  updateMissions(G, dt);
  G.particles.update(dt);
  updateCamera(G);

  // Car wrecked while driving.
  if (p.inCar && p.inCar.hp <= 0) {
    G.particles.smoke(p.inCar.x, p.inCar.y);
    G.audio.sfx('crash');
    const car = p.inCar;
    car.driver = null; car.parked = true;
    p.inCar = null; p.onFoot = true;
    p.x = car.x + 40; p.y = car.y;
    G.audio.engineStop();
    damagePlayer(G, 10, 'crash');
  }
}

function render(G, ctx) {
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  if (G.mode === 'title') drawTitle(ctx, G);
  else {
    drawWorld(ctx, G);
    drawHUD(ctx, G);
    if (G.mode === 'pause') drawPause(ctx, G);
    if (G.mode === 'busted' || G.mode === 'wasted') drawEnd(ctx, G, G.bustedKind);
    if (G.mode === 'complete') drawEnd(ctx, G, 'complete');
  }
  ctx.restore();
}

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const G = createGame(Number(params.get('seed') || SHOT_SEED));
  window.__game = G;
  G.input.attach(canvas);
  try { G.hasSave = !!localStorage.getItem(SAVE_KEY); } catch { G.hasSave = false; }

  // Debug hooks for headless playtests (teleport, mission control, state).
  window.__debug = {
    teleport(x, y) { G.player.x = x; G.player.y = y; if (G.player.inCar) { G.player.inCar.x = x; G.player.inCar.y = y; } },
    state() {
      return {
        mode: G.mode, money: G.player.money, hp: G.player.hp,
        wanted: G.wanted, mission: G.mission ? G.mission.id : null,
        missionsDone: G.missionsDone, x: Math.round(G.player.x), y: Math.round(G.player.y),
        inCar: !!G.player.inCar, heli: G.heli.active, cops: G.cops.length,
        cruisers: G.cruisers.length, enemies: G.enemies.filter((e) => e.alive).length,
        owned: G.player.owned, ammo: G.player.ammo, clock: G.clock,
      };
    },
    setMission(id) { G.mission = null; G.enemies = []; startMission(G, id); },
    completeMission() { if (G.mission) { const m = G.mission; G.mission = null; G.missionsDone = m.id; G.marker = null; if (m.id >= 12) G.mode = 'complete'; else startMission(G, m.id + 1); } },
    setWanted(n) {
      if (n === 0) { G.wanted = 0; G.heatT = 0; standDown(G); }
      else { G.wanted = n; G.heatT = 0; }
    },
    hurt(n) { damagePlayer(G, n, 'test'); },
    spawnCop() { spawnFootCop(G, G.player.x + 30, G.player.y); },
    giveMoney(n) { G.player.money += n; },
    giveCar(type) {
      const car = makeCar(type, G.player.x + 60, G.player.y, 0, null);
      G.cars.push(car);
      return true;
    },
    press(key) { G.input.fakeDown(key); },
    release(key) { G.input.fakeUp(key); },
    dialog() { return G.dialog; },
  };

  const shot = params.get('shot');
  if (shot) {
    setupShot(G, shot);
  } else {
    G.mode = 'title';
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const inp = G.input;
    if (G.mode === 'title') {
      if (inp.wasPressed('Enter')) {
        if (G.hasSave) continueGame(G); else startNewGame(G);
      }
      if (inp.wasPressed('n')) startNewGame(G);
      G.time += dt;
      G.clock += dt / 40;
      if (G.clock >= 24) G.clock -= 24;
    } else if (G.mode === 'play') {
      updatePlay(G, dt);
      if (G.shot && !G.shot.done) stepShot(G);
    } else if (G.mode === 'pause') {
      if (inp.wasPressed('Escape')) G.mode = 'play';
      if (inp.wasPressed('s')) { saveGame(G); G.particles.popup(G.player.x, G.player.y - 40, 'SAVED', '#7dff8a'); }
      if (inp.wasPressed('r')) G.audio.nextStation();
      if (inp.wasPressed('m')) G.audio.toggleMute();
    } else if (G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'complete') {
      if (inp.wasPressed('Enter')) { G.mode = 'play'; }
    }
    render(G, ctx);
    inp.endFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

if (typeof document !== 'undefined') boot();
