// NEON TIDE v6 — bootstrap + game loop + debug API. Owns the renderer,
// chase camera, all systems, save/load, title/pause/busted/won screens and
// the window.__game hooks the playtest and the shot autopilot drive.
// 3D: three.js (vendored game/vendor/three.min.js) with a real third-person
// chase camera; physics stays 2D on the XZ plane.
import { SAVE_KEY, SEED, ANCHORS, CARS } from './config.js';
import { makeRng, clamp, angleLerp } from './rng.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Garage, GUNSHOP } from './garage.js';
import { Weather } from './weather.js';
import { AudioSys } from './audio.js';
import { HUD } from './hud.js';
import { HeatWave } from './heat.js';
import { applyShot } from './shots.js';

const PARKED = [
  // Parked cars also sit on roads / sidewalk strips, never inside blocks.
  ['sport', 414, 60, 0.6], ['sedan', 620, 700, 0], ['taxi', -186, -120, 1.57],
  ['sedan', -386, 420, 0], ['truck', -986, 200, 1.57], ['sport', 814, 200, 0],
  ['bike', 1000, 700, 0], ['sedan', 114, -420, 1.57], ['taxi', 414, 520, 0],
  ['sedan', -614, -300, 1.57], ['truck', 814, -300, 0], ['sport', -200, 620, 1.57],
];

export class Game {
  constructor() {
    this.time = 0;
    this.rng = makeRng(SEED);
    this.state = {
      mode: 'title', money: 150, debt: 50000,
      upgrades: { engine: 0, grip: 0, armor: 0, nos: 0 },
      weapons: ['fists', 'pistol'],
    };
    this.input = new Input();
    this.input.attach();
    this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // ?noshadow=1 trades shadows for speed (headless playtest on swiftshader).
    if (new URLSearchParams(location.search).get('noshadow') === '1') this.renderer.shadowMap.enabled = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(-40, 40, 140);
    this.world = new World(this.scene);
    this.player = new Player(this.scene, this.world, ANCHORS.start.x, ANCHORS.start.z);
    this.traffic = new Traffic(this.scene, this.world);
    this.police = new Police(this.scene, this.world, this.player);
    this.combat = new Combat(this.scene, this.world, this.player, this.police, this.traffic);
    this.weather = new Weather(this.world);
    this.audio = new AudioSys();
    this.hud = new HUD();
    this.garage = new Garage(this.state);
    this.missions = new Missions({
      player: this.player, police: this.police, combat: this.combat,
      traffic: this.traffic, world: this.world, scene: this.scene,
      onEvent: (kind, data) => this.onEvent(kind, data),
    });
    this.heat = new HeatWave({
      police: this.police, combat: this.combat, playerPos: () => this.player.pos,
      onEvent: (kind, data) => this.onEvent(kind, data),
    });
    this.combat.onKill = (e) => {
      this.missions.kills++;
      this.heat.onKill();
      this.state.money += 25; // pocket cash off a fallen rival
    };
    this.parkedCars = [];
    for (const [type, x, z, h] of PARKED) {
      const car = new Car(type, x, z, h);
      this.scene.add(car.mesh);
      this.parkedCars.push(car);
    }
    this.camYaw = 0;
    this.shotMode = null;
    this.shotFrames = 0;
    this._bindUI();
    this._shotCheck();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ---- UI wiring -------------------------------------------------------
  _bindUI() {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    on('btn-new', () => { this.audio.ensure(); this.startNewGame(); });
    on('btn-continue', () => { this.audio.ensure(); this.loadGame() ? this.startNewGame(true) : this.startNewGame(); });
    on('btn-heat', () => { this.audio.ensure(); this.startNewGame(); this.heat.start(); this.hud.showPopup('HEAT WAVE — survive as long as you can!'); });
    on('btn-resume', () => this.setMode('playing'));
    on('btn-quit-title', () => this.setMode('title'));
    on('btn-retry', () => { this.missions.retry(); this.setMode('playing'); });
    on('btn-busted-ok', () => this._afterBusted());
    on('btn-wasted-ok', () => this._afterWasted());
    on('btn-won-again', () => this.startNewGame());
    on('garage-close', () => this._closePanels());
    on('gunshop-close', () => this._closePanels());
    document.querySelectorAll('#garage-panel [data-buy]').forEach((b) => {
      b.addEventListener('click', () => {
        if (this.garage.buy(b.dataset.buy)) { this.audio.blip(990); this._refreshShopPanels(); }
        else this.audio.blip(220);
      });
    });
    on('garage-service', () => { if (this.garage.service()) this._refreshShopPanels(); });
    document.querySelectorAll('#gunshop-panel [data-buy]').forEach((b) => {
      b.addEventListener('click', () => {
        if (GUNSHOP.buy(this.state, this.combat, b.dataset.buy)) { this.audio.blip(990); this._refreshShopPanels(); }
        else this.audio.blip(220);
      });
    });
    document.querySelectorAll('#garage-panel [data-radio]').forEach((b) => {
      b.addEventListener('click', () => { this.audio.nextStation(); this._refreshShopPanels(); });
    });
    window.addEventListener('keydown', () => this.audio.ensure(), { once: true });
    window.addEventListener('mousedown', () => this.audio.ensure(), { once: true });
  }

  _shotCheck() {
    const q = new URLSearchParams(location.search);
    const shot = q.get('shot');
    if (shot) {
      this.shotMode = shot;
      this.startNewGame();
      const cam = applyShot(this, shot);
      this.shotCam = cam;
      this.setMode('playing');
    }
  }

  // ---- Modes / save ----------------------------------------------------
  setMode(mode) {
    this.state.mode = mode;
    const show = (id, v) => { const e = document.getElementById(id); if (e) e.style.display = v ? 'block' : 'none'; };
    show('title', mode === 'title');
    show('hud', mode === 'playing' || mode === 'paused');
    show('pause-panel', mode === 'paused');
    show('busted-panel', mode === 'busted');
    show('wasted-panel', mode === 'wasted');
    show('won-panel', mode === 'won');
    show('failed-panel', mode === 'failed');
    if (mode !== 'playing') this._closePanels();
  }

  startNewGame(loaded = false) {
    if (!loaded) {
      this.state.money = 150; this.state.debt = 50000;
      this.state.upgrades = { engine: 0, grip: 0, armor: 0, nos: 0 };
      this.state.weapons = ['fists', 'pistol'];
      this.combat.ammo = { pistol: 24, smg: 0 };
      this.combat.weapon = 'pistol';
      this.missions.startMission(0);
      this.player.respawn(ANCHORS.start.x, ANCHORS.start.z);
      this.police.setWanted(0);
      this.weather.timeOfDay = 19.5;
    }
    this.setMode('playing');
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.state.money, debt: this.state.debt,
        mission: this.missions.index, upgrades: this.state.upgrades,
        weapons: this.state.weapons, ammo: this.combat.ammo,
        x: this.player.x, z: this.player.z, hp: this.player.hp,
        timeOfDay: this.weather.timeOfDay, heatBest: this.heat.best,
      }));
      return true;
    } catch { return false; }
  }
  saveGame() { return this.save(); }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.state.money = d.money; this.state.debt = d.debt;
      this.state.upgrades = d.upgrades; this.state.weapons = d.weapons;
      this.combat.ammo = d.ammo || { pistol: 24, smg: 0 };
      this.combat.weapon = this.state.weapons.includes('smg') ? this.combat.weapon : 'pistol';
      this.missions.startMission(d.mission || 0);
      this.player.respawn(d.x ?? ANCHORS.start.x, d.z ?? ANCHORS.start.z);
      this.player.hp = d.hp ?? 100;
      this.weather.timeOfDay = d.timeOfDay ?? 19.5;
      this.heat.best = d.heatBest || 0;
      return true;
    } catch { return false; }
  }

  _afterBusted() {
    this.state.money = Math.max(0, this.state.money - 500);
    this.police.setWanted(0);
    this.police.cops.forEach((c) => this.scene.remove(c.mesh)); this.police.cops = [];
    this.police.cruisers.forEach((c) => this.scene.remove(c.mesh)); this.police.cruisers = [];
    this.player.respawn(ANCHORS.safehouse1.x, ANCHORS.safehouse1.z);
    if (this.heat.active) this.heat.stop('busted');
    this.setMode('playing');
  }
  _afterWasted() {
    this.state.money = Math.max(0, this.state.money - 250);
    this.police.setWanted(0);
    this.player.respawn(ANCHORS.safehouse1.x, ANCHORS.safehouse1.z);
    this.missions.retry();
    if (this.heat.active) this.heat.stop('wasted');
    this.setMode('playing');
  }

  // ---- Events ----------------------------------------------------------
  onEvent(kind, data) {
    if (kind === 'mission-complete') {
      this.state.money += data.reward;
      this.state.debt = Math.max(0, this.state.debt - data.reward);
      this.audio.fanfare();
      this.hud.showPopup(`Mission complete: ${data.name} +$${data.reward.toLocaleString('en-US')}`);
      this.save();
    } else if (kind === 'bonus') {
      this.state.money += data;
      this.state.debt = Math.max(0, this.state.debt - data);
      this.hud.showPopup(`+$${data.toLocaleString('en-US')} grabbed`);
    } else if (kind === 'mission-failed') {
      this.setMode('failed');
      const e = document.getElementById('failed-reason');
      if (e) e.textContent = data;
    } else if (kind === 'game-won') {
      this.state.debt = 0;
      this.audio.fanfare();
      this.save();
      this.setMode('won');
    } else if (kind === 'heat-start') {
      this.hud.showPopup('HEAT WAVE started — wanted climbs every 15s!');
    } else if (kind === 'heat-end') {
      this.hud.showPopup(`HEAT WAVE over — score ${data.score} (${data.time}s, ${data.reason})`, 5000);
    }
  }

  // ---- Interaction -----------------------------------------------------
  _nearestParked(x, z, r) {
    let best = null, bd = r;
    for (const c of this.parkedCars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  _nearestTrafficCar(x, z, r) {
    let best = null, bd = r;
    for (const c of this.traffic.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  teleport(x, z) {
    // Land on open ground: resolve building collision so a teleport into a
    // block edge ends at the nearest valid spot instead of inside a wall.
    const p = { x, z };
    this.world.collideCircle(p, 2);
    const car = this.player.car;
    if (car) { car.x = p.x; car.z = p.z; car.speed = 0; car.mesh.position.set(p.x, 0, p.z); }
    this.player.x = p.x; this.player.z = p.z;
    if (car) { this.player.heading = car.heading; }
    this.player.mesh.position.set(p.x, 0, p.z);
  }

  giveCar(type) {
    const old = this.player.car;
    if (old) { this.parkedCars.push(old); }
    const car = new Car(type, this.player.x, this.player.z, this.player.heading);
    this.scene.add(car.mesh);
    this.garage.applyToCar(car);
    car.nos = car.nosMax;
    this.player.enterCar(car);
    return car;
  }

  setWanted(n) { this.police.setWanted(n); }
  setMoney(n) { this.state.money = n; }
  heal() { this.player.heal(999); }
  shootAll() { this.combat.shootAll(); }
  openShop(which) { this._openPanel(which + '-panel'); }
  startMission(i) {
    this.missions.startMission(i);
    if (this.state.mode === 'failed') this.setMode('playing');
  }
  completeStep() {
    this.missions.completeStep();
    if (this.state.mode === 'failed') this.setMode('playing');
  }

  _tryInteract() {
    // E closes an open shop panel first.
    for (const id of ['garage-panel', 'gunshop-panel']) {
      const e = document.getElementById(id);
      if (e && e.style.display === 'block') { this._closePanels(); return; }
    }
    const p = this.player.pos;
    if (!this.player.car) {
      // Shops and safehouses win over cars on foot: a parked car next to
      // Rosa's Garage should not eat the E press meant for the garage.
      if (Math.hypot(p.x - ANCHORS.garage.x, p.z - ANCHORS.garage.z) < 26) { this._openPanel('garage-panel'); return; }
      if (Math.hypot(p.x - ANCHORS.gunshop.x, p.z - ANCHORS.gunshop.z) < 26) { this._openPanel('gunshop-panel'); return; }
      if (Math.hypot(p.x - ANCHORS.safehouse1.x, p.z - ANCHORS.safehouse1.z) < 26 ||
          Math.hypot(p.x - ANCHORS.safehouse2.x, p.z - ANCHORS.safehouse2.z) < 26) {
        this.player.heal(100);
        this.save();
        this.hud.showPopup('Safehouse — healed and game saved');
        this.audio.blip(880);
        return;
      }
      const parked = this._nearestParked(p.x, p.z, 14);
      const traf = this._nearestTrafficCar(p.x, p.z, 14);
      const car = parked && (!traf || Math.hypot(parked.x - p.x, parked.z - p.z) <= Math.hypot(traf.x - p.x, traf.z - p.z)) ? parked : traf;
      if (car) {
        if (parked) this.parkedCars.splice(this.parkedCars.indexOf(car), 1);
        else {
          this.traffic.cars.splice(this.traffic.cars.indexOf(car), 1);
          this.traffic.scare(p.x, p.z, 60);
          // Stealing a driven car in view of police adds heat.
          if (this.police.cops.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 150)) this.police.addHeat(12);
        }
        this.garage.applyToCar(car);
        this.player.enterCar(car);
        this.audio.blip(660);
        return;
      }
    } else {
      // In a car near a shop: step out instead of swapping cars — the next
      // E opens the shop. (Abandoned cars pile up at the garage otherwise,
      // and E would just swap between them forever.)
      if (Math.hypot(p.x - ANCHORS.garage.x, p.z - ANCHORS.garage.z) < 26 ||
          Math.hypot(p.x - ANCHORS.gunshop.x, p.z - ANCHORS.gunshop.z) < 26) {
        this.player.exitCar();
        return;
      }
      // In a car: swap to a nearby parked car first, else step out.
      const parked = this._nearestParked(p.x, p.z, 14);
      if (parked && parked !== this.player.car) {
        const old = this.player.car;
        this.parkedCars.splice(this.parkedCars.indexOf(parked), 1);
        this.parkedCars.push(old);
        this.player.exitCar();
        this.garage.applyToCar(parked);
        this.player.enterCar(parked);
        return;
      }
      this.player.exitCar();
    }
  }

  _openPanel(id) {
    this._refreshShopPanels();
    const e = document.getElementById(id);
    if (e) e.style.display = 'block';
  }
  _closePanels() {
    for (const id of ['garage-panel', 'gunshop-panel']) {
      const e = document.getElementById(id);
      if (e) e.style.display = 'none';
    }
  }
  _refreshShopPanels() {
    const g = this.state;
    document.querySelectorAll('#garage-panel [data-buy]').forEach((b) => {
      const kind = b.dataset.buy;
      const lv = g.upgrades[kind];
      const price = this.garage.price(kind);
      b.textContent = `${kind.toUpperCase()} Lv${lv} — ${price === null ? 'MAX' : '$' + price}`;
      b.disabled = price === null || g.money < price;
    });
    document.querySelectorAll('#gunshop-panel [data-buy]').forEach((b) => {
      const item = GUNSHOP.items.find((i) => i.id === b.dataset.buy);
      b.textContent = `${item.label} — $${item.price}`;
      b.disabled = g.money < item.price || (item.id === 'smg' && g.weapons.includes('smg'));
    });
    const st = document.getElementById('radio-station');
    if (st) st.textContent = 'Radio: ' + this.audio.stations[this.audio.station];
  }

  // ---- Camera ----------------------------------------------------------
  _updateCamera(dt) {
    const p = this.player.pos;
    const inCar = !!this.player.car;
    const dist = this.shotCam ? this.shotCam.camDist : inCar ? 17 : 11;
    const height = this.shotCam ? this.shotCam.camHeight : inCar ? 7.5 : 5.5;
    const heading = this.player.heading;
    // Chase camera: behind the player, looking ahead.
    const tx = p.x - Math.sin(heading) * dist;
    const tz = p.z - Math.cos(heading) * dist;
    const k = 1 - Math.exp(-6 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    const lx = p.x + Math.sin(heading) * 12;
    const lz = p.z + Math.cos(heading) * 12;
    this.camera.lookAt(lx, 1.6, lz);
    this.camYaw = Math.atan2(lx - this.camera.position.x, lz - this.camera.position.z);
  }

  // ---- Main loop -------------------------------------------------------
  _cameraRelativeInput() {
    // WASD relative to the chase camera: W moves away from the camera.
    const f = (this.input.up ? 1 : 0) - (this.input.dn ? 1 : 0);
    const r = (this.input.rt ? 1 : 0) - (this.input.lf ? 1 : 0);
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const rx = -Math.cos(this.camYaw), rz = Math.sin(this.camYaw);
    return { mx: fx * f + rx * r, mz: fz * f + rz * r };
  }

  update(dt) {
    const inp = this.input;
    // Keys that work outside the playing state.
    if (this.state.mode === 'paused' && inp.wasPressed('Escape')) { this.setMode('playing'); inp.endFrame(); return; }
    if (this.state.mode === 'failed' && (inp.wasPressed('KeyR') || inp.wasPressed('Enter'))) { this.missions.retry(); this.setMode('playing'); inp.endFrame(); return; }
    if (this.state.mode === 'playing') {
      // Pause / retry / interact / weapons / radio.
      if (inp.wasPressed('Escape')) { this.setMode('paused'); inp.endFrame(); return; }
      if (inp.wasPressed('KeyE')) this._tryInteract();
      if (inp.wasPressed('KeyR') && this.missions.failed) { this.missions.retry(); this.setMode('playing'); }
      if (inp.wasPressed('Digit1')) this.combat.weapon = 'fists';
      if (inp.wasPressed('Digit2') && this.state.weapons.includes('pistol')) this.combat.weapon = 'pistol';
      if (inp.wasPressed('Digit3') && this.state.weapons.includes('smg')) this.combat.weapon = 'smg';
      if (inp.wasPressed('KeyC')) { this.audio.nextStation(); this.hud.showPopup('Radio: ' + this.audio.stations[this.audio.station]); }

      // Camera-relative movement on foot; raw input in the car.
      const move = this._cameraRelativeInput();
      this.player.moveOverride = this.player.car ? null : move;
      this.player.update(dt, inp, this.time);
      this.player.moveOverride = null;

      // Aim + shoot.
      this.combat.setAimFromMouse(this.camera, inp.mouseX, inp.mouseY);
      if (inp.mouseDown || inp.mouseClicked) {
        if (this.combat.shoot()) this.audio.gunshot();
      }

      this.traffic.update(dt, this.player.x, this.player.z);
      this.police.update(dt, this.time);
      this.combat.update(dt);
      this.missions.update(dt);
      this.heat.update(dt);
      this.weather.update(dt);
      this.world.update(dt, this.player.x, this.player.z);
      this.audio.setEngine(this.player.car ? Math.abs(this.player.car.speed) / this.player.car.topSpeed : 0);
      this.audio.siren(this.police.wanted >= 2 && this.police.cruisers.length > 0);

      // Busted / wasted.
      if (this.police.busted) { this.police.busted = false; this.setMode('busted'); }
      if (!this.player.alive) { this.setMode('wasted'); }
      // Car wrecked while driving.
      if (this.player.car && this.player.car.hp <= 0) {
        this.player.car.mesh.visible = false;
        this.player.exitCar();
        this.hud.showPopup('Your car is wrecked!');
      }
      this.hud.update(dt, this);
    } else if (this.state.mode === 'title') {
      // Slow orbit over the city behind the title screen.
      const a = this.time * 0.05;
      this.camera.position.set(Math.sin(a) * 260, 90, Math.cos(a) * 260);
      this.camera.lookAt(0, 0, 0);
      this.world.update(dt, 0, 0);
      this.weather.update(dt);
      this.traffic.update(dt, 0, 0);
    }
    inp.endFrame();
  }

  loop = () => {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, this._last ? now - this._last : 0.016);
    this._last = now;
    this.time += dt;
    this.update(dt);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.shotMode) {
      this.shotFrames++;
      if (this.shotFrames > 90) window.__shotReady = true;
    }
    requestAnimationFrame(this.loop);
  };

  start() {
    this.loop();
  }
}

// Debug / playtest API (also used by the shot autopilot).
export function boot() {
  const game = new Game();
  window.__game = game;
  // Convenient flat accessors the playtest uses.
  game.state.player = game.player;
  game.state.missions = game.missions;
  game.state.police = game.police;
  game.state.combat = game.combat;
  game.state.weather = game.weather;
  game.state.heat = game.heat;
  game.state.input = game.input;
  game.state.traffic = game.traffic;
  game.state.garage = game.garage;
  game.state.saveGame = (s) => game.save();
  window.__shotReady = false;
  game.start();
  return game;
}
