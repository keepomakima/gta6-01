// NEON TIDE — shots.js
// Deterministic autopilot for the four screenshots. Each shot starts the
// game from a fresh seeded world, plays a short scripted sequence, then
// raises window.__shotReady so the capture driver can take the frame.
// The game itself never reads ?shot= outside this file.

import { PLACES } from './config.js';
import { createCar } from './entities.js';
import { spawnTrafficCar } from './traffic.js';
import { startMission } from './missions.js';
import { burst } from './particles.js';

// Configure the game state for one named shot. Called once at boot.
export function applyShot(G, name) {
  G.shot = { name, frames: 0, ready: false };
  const p = G.player;
  if (name === 'start') {
    // Title screen over the city at sunset.
    G.mode = 'title';
    G.time = 18.4;
    G.camera.x = 900;
    G.camera.y = 450;
    G.shot.need = 70;
  } else if (name === 'drive') {
    // Night drive downtown in the sport car, wanted 2 stars, traffic around.
    G.mode = 'play';
    G.time = 22.0;
    const car = createCar(G, 'sport', 1000, 600, 0, { driver: 'player' });
    G.cars.push(car);
    p.inCar = car.id;
    p.x = car.x;
    p.y = car.y;
    G.heat = 210;
    G.wanted = 2;
    for (let i = 0; i < 6; i += 1) spawnTrafficCar(G, p.x, p.y);
    // Mission 2's objective reads well over a driving shot.
    startMission(G, 1);
    G.camera.x = p.x - 640;
    G.camera.y = p.y - 360;
    G.shot.need = 150;
  } else if (name === 'chase') {
    // Three-star police chase at night, cruisers on the tail.
    G.mode = 'play';
    G.time = 21.0;
    const car = createCar(G, 'sport', 1400, 1000, 0, { driver: 'player' });
    G.cars.push(car);
    p.inCar = car.id;
    p.x = car.x;
    p.y = car.y;
    // Mission 4's objective fits a chase; set the heat after it (it adds
    // 320 of its own, and we want exactly 3 stars, not 5).
    startMission(G, 3);
    G.heat = 320;
    G.wanted = 3;
    for (let i = 0; i < 2; i += 1) {
      const cruiser = createCar(G, 'cruiser', car.x - 140 - i * 70, car.y + (i === 0 ? -30 : 30), 0, { driver: 'police' });
      cruiser.speed = 380;
      G.cars.push(cruiser);
    }
    for (let i = 0; i < 4; i += 1) spawnTrafficCar(G, p.x, p.y);
    G.camera.x = p.x - 640;
    G.camera.y = p.y - 360;
    G.shot.need = 170;
  } else if (name === 'mission') {
    // The harbor heist: mission 8, Deke on foot with a pistol, guards ahead.
    G.mode = 'play';
    G.time = 17.6;
    // Deke stands mid-frame (world x 640 centres him on screen); the
    // guards hold the dock to his left, marker and all.
    p.x = 640;
    p.y = 1380;
    p.weapon = 'pistol';
    p.ammo = 48;
    startMission(G, 7);
    // Pull the guards into a visible cluster west of Deke.
    for (const e of G.enemies) {
      e.x = 380 + (e.x % 140);
      e.y = 1340 + (e.y % 80);
    }
    G.camera.x = p.x - 640;
    G.camera.y = p.y - 360;
    G.shot.need = 110;
  }
  window.__shotReady = false;
}

// Drive the scripted inputs for one frame. Returns true when the shot is
// ready to capture.
export function tickShot(G, dt) {
  const s = G.shot;
  if (!s || s.ready) return s?.ready ?? false;
  s.frames += 1;
  const input = G.input;
  // Pin the wanted heat for the driving shots so the star count in the
  // screenshot is exactly the one the shot is about (heat decays when the
  // player is unseen, which would drop a star mid-shot).
  if (s.name === 'drive') G.heat = 210;
  if (s.name === 'chase') G.heat = 320;
  if (s.name === 'start') {
    // Slow pan across downtown at sunset.
    G.camera.x = 900 + Math.sin(s.frames / 90) * 120;
    G.camera.y = 450 + Math.cos(s.frames / 120) * 60;
  } else if (s.name === 'drive' || s.name === 'chase') {
    // Hold the gas and steer gently down the road.
    input.setVirtual('KeyW', true);
    if (s.frames > 60 && s.frames < 90) input.setVirtual('KeyA', true);
    else input.setVirtual('KeyA', false);
    if (s.name === 'chase' && s.frames === 100) {
      // A near-miss spark burst sells the chase.
      const pc = G.cars.find((c) => c.id === G.player.inCar);
      if (pc) burst(G, pc.x + 30, pc.y + 14, { count: 10, speedMin: 80, speedMax: 220, life: 0.4, size: 3, color: '#ffb347' });
    }
  } else if (s.name === 'mission') {
    // Aim at the nearest guard and fire once for a muzzle flash.
    const e = G.enemies.find((en) => en.hp > 0);
    if (e && s.frames > 40 && s.frames < 46) {
      const a = Math.atan2(e.y - G.player.y, e.x - G.player.x);
      G.player.aimAngle = a;
      G.player.angle = a;
      input.mouseX = G.player.x - G.camera.x + Math.cos(a) * 200;
      input.mouseY = G.player.y - G.camera.y + Math.sin(a) * 200;
      input.mouseDown = true;
    } else {
      input.mouseDown = false;
    }
  }
  if (s.frames >= s.need) {
    s.ready = true;
    input.clearVirtual();
    input.mouseDown = false;
    window.__shotReady = true;
  }
  return s.ready;
}
