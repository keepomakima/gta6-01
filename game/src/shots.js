// NEON TIDE v4 — shots: deterministic autopilot for the 4 screenshots.
// One job: put the game in a staged, action-filled state per ?shot=, drive it
// forward with fixed fake input, then flag window.__shotReady.
// The cover (1-chase) is a night police chase with the helicopter — never a menu.
import { PLACES } from './config.js';
import { makeCar } from './entities.js';
import { startMission, setDialog } from './missions.js';
import { addWanted, spawnFootCop, spawnCruiser } from './police.js';

function putPlayerInCar(G, type, x, y, angle) {
  const car = makeCar(type, x, y, angle, 'player');
  car.hp = 999; car.maxHp = 999; // staged shot car: survives the warm-up chase
  G.cars.push(car);
  const p = G.player;
  p.inCar = car;
  p.onFoot = false;
  p.x = x; p.y = y; p.angle = angle;
  car.speed = 200;
  G.cam.x = Math.max(0, Math.min(2600 - 1280, x - 640));
  G.cam.y = Math.max(0, Math.min(1800 - 720, y - 360));
  return car;
}

function putPlayerOnFoot(G, x, y) {
  const p = G.player;
  p.inCar = null; p.onFoot = true;
  p.x = x; p.y = y;
  G.cam.x = Math.max(0, Math.min(2600 - 1280, x - 640));
  G.cam.y = Math.max(0, Math.min(1800 - 720, y - 360));
}

function armPlayer(G) {
  const p = G.player;
  p.owned.smg = true;
  p.owned.shotgun = true;
  p.ammo.smg = 96;
  p.ammo.shotgun = 24;
  p.ammo.pistol = 72;
  p.weapon = 'smg';
  p.money = 12450;
}

function forcePolice(G, cops, cruisers) {
  for (let i = 0; i < cops; i += 1) {
    const a = (i / Math.max(1, cops)) * Math.PI * 2;
    spawnFootCop(G, G.player.x + Math.cos(a) * 300, G.player.y + Math.sin(a) * 300);
  }
  for (let i = 0; i < cruisers; i += 1) spawnCruiser(G);
}

export function setupShot(G, name) {
  G.mode = 'play';
  G.audio.muted = true;
  armPlayer(G);
  let keys = [];
  let frames = 90;

  if (name === 'chase') {
    // COVER: night neon downtown, 5-star chase, heli spotlight, full HUD.
    // Mission 4 (Lose the Heat) so the warm-up drive cannot complete a mission.
    G.clock = 21.5;
    putPlayerInCar(G, 'sport', 1020, 820, 0);
    startMission(G, 4);
    addWanted(G, 2);
    forcePolice(G, 3, 1);
    G.heli.active = true;
    G.heli.x = G.player.x + 120;
    G.heli.y = G.player.y - 140;
    G.heli.spotOn = true;
    setDialog(G, 'Madame Kestrel', 'BOSS', 'Five stars, Deke. Lose them all — the whole port is watching.', '#ffd166');
    keys = ['w'];
    frames = 110;
    G.shotPopup = { text: 'NEAR MISS +$250', color: '#7dff8a' };
  } else if (name === 'drive') {
    // Sunset beachfront cruise in the Tide GT, race mission, drift popup.
    G.clock = 17.8;
    putPlayerInCar(G, 'sport', 2220, 1200, -Math.PI / 2);
    startMission(G, 9);
    setDialog(G, 'Rook', 'RACER', 'Three gates, beachfront to harbor. Loser buys the drinks, Deke.', '#ff7ad9');
    keys = ['w'];
    frames = 90;
    G.shotPopup = { text: 'DRIFT x2', color: '#ffd166' };
  } else if (name === 'mission') {
    // Harbor heist: combat at the Port Vault, mission marker, dialog.
    G.clock = 10.5;
    putPlayerOnFoot(G, 380, 1500);
    startMission(G, 11);
    addWanted(G, 2);
    forcePolice(G, 1, 0);
    setDialog(G, 'Vex', 'FIXER', 'Four guards on the vault. Clean and quiet — or loud. Your call.', '#39c6ff');
    keys = [];
    frames = 70;
  } else if (name === 'heist') {
    // Downtown night, 4-star escape with roadblock + heli.
    // Start far west on the 1120 road so the getaway cannot reach the garage
    // during the warm-up and finish mission 11 early.
    G.clock = 20.5;
    putPlayerInCar(G, 'armored', 220, 1120, 0);
    startMission(G, 11);
    G.mission.stage = 1;
    G.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Vex Garage' };
    addWanted(G, 4);
    forcePolice(G, 2, 2);
    G.heli.active = true;
    G.heli.x = G.player.x + 150;
    G.heli.y = G.player.y - 120;
    G.heli.spotOn = true;
    setDialog(G, 'Madame Kestrel', 'BOSS', 'Every cop in Solano is coming. Drive like the tide itself.', '#ffd166');
    keys = ['w'];
    frames = 140;
  } else {
    // Unknown shot name: plain free roam so the page still renders.
    G.clock = 13.0;
    putPlayerOnFoot(G, 620, 300);
    startMission(G, 1);
    keys = [];
    frames = 30;
  }

  G.shot = { keys, frames, done: false, elapsed: 0 };
  for (const k of keys) G.input.fakeDown(k);
  return G.shot;
}

// Called once per frame from the main loop while a shot is warming up.
// Returns true the moment the frame is ready to capture.
export function stepShot(G) {
  const s = G.shot;
  if (!s || s.done) return false;
  s.elapsed += 1;
  // Re-fire the score popup just before capture, high above the player so
  // it clears the dialog box at the bottom of the screen.
  if (G.shotPopup && s.elapsed === s.frames - 2) {
    G.particles.popup(G.player.x, G.player.y - 120, G.shotPopup.text, G.shotPopup.color, true);
  }
  if (s.elapsed >= s.frames) {
    for (const k of s.keys) G.input.fakeUp(k);
    s.done = true;
    window.__shotReady = true;
    return true;
  }
  return false;
}
