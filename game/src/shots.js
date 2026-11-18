// NEON TIDE v6-rebuild-2 — shots.js
// Deterministic screenshot autopilot: ?shot=<name>&seed=20261121 sets up a
// staged scene, freezes the mission engine and the police (shotMode), snaps
// the chase camera, and flags window.__shotReady when the frame is ready.
// Lessons from the earlier v6 attempts, applied here from the start:
//  - snap the camera in applyShot (the camera lerps in slowly at ~0.2x
//    headless game time, so an unsnapped first frame is dark and far away);
//  - set lastSeenAt = S.time and shotMode so the wanted level does not
//    decay during the shot;
//  - parkHeli(S, x, z, y) — height LAST;
//  - casino pylon is 3x22 on the front side; waypoint beacon 26 tall;
//  - pier deck is 0.4 thick; stealth shot freezes missions with detection 35.
import { startMission } from './missions.js';
import { parkHeli } from './helicopter.js';
import { makeCar } from './entities.js';

function snapBehind(S, x, z, heading, back = 16, up = 8.5) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  S.camSnap = {
    pos: { x: x - fx * back, y: up, z: z - fz * back },
    look: { x: x + fx * 10, y: 1.5, z: z + fz * 10 },
  };
}

function putInCar(S, type, x, z, heading) {
  const car = makeCar(type, x, z, heading);
  S.player.car = car;
  S.player.onFoot = false;
  S.player.x = x; S.player.z = z; S.player.heading = heading;
  car.nos = S.garage.nosTank;
  return car;
}

function freezeShot(S) {
  S.shotMode = true;
  S.missions.frozen = true;
  S.lastSeenAt = S.time;
}

export function applyShot(S, name) {
  const P = S.player;
  S.weather.autoRain = false;
  if (name === 'stormchase') {
    // COVER: night rain chase, wanted 5, heli + spotlight, spike strip,
    // roadblock ahead, NOS Lv2, M15 in progress.
    S.weather.clock = 22.5;
    S.weather.rain = 0.9;
    S.garage.nos = 2; S.garage.nosTank = 160;
    putInCar(S, 'sport', 0, 0, 0);
    P.car.nos = 160;
    S.wanted = 5;
    S.lastSeenAt = S.time;
    S.missions.index = 14; S.missions.mode = 'playing'; S.missions.step = 1;
    S.shotHideBeacon = true; // the Airfield beacon is 800+ units away and
    // renders as a stray yellow streak across the sky
    parkHeli(S, 12, 60, 26);
    S.spike = { x: 0, z: 55, until: S.time + 60 };
    S.roadblock = [
      makeCar('cruiser', -14, 90, Math.PI / 2),
      makeCar('cruiser', 14, 90, Math.PI / 2),
    ];
    S.cruisers.push(makeCar('cruiser', -35, 45, 0.4));
    S.cruisers.push(makeCar('cruiser', 35, 50, -0.3));
    snapBehind(S, 0, 0, 0, 18, 9);
    freezeShot(S);
  } else if (name === 'neontide') {
    // Motor Tide Runner 900 + rider in front of the TIDE casino pylon.
    S.weather.clock = 21.0;
    S.weather.rain = 0.35;
    S.garage.nos = 2; S.garage.nosTank = 160;
    // Park the bike on the casino plaza's south side (300,580), facing -z
    // toward the casino: the pylon stands on the casino's south face
    // (z=541) and is only visible from this side, not from the road at z=420.
    putInCar(S, 'bike', 300, 580, Math.PI);
    P.x = 300; P.z = 580; P.heading = Math.PI;
    P.car.x = 300; P.car.z = 580; P.car.heading = Math.PI;
    S.wanted = 4;
    S.lastSeenAt = S.time;
    startMission(S, 14); // M15 Neon Mile: objective line + casino cash
    S.shotHideBeacon = true;
    parkHeli(S, 310, 545, 30); // between camera and pylon, in frame
    snapBehind(S, 300, 580, Math.PI, 14, 7);
    freezeShot(S);
  } else if (name === 'runway') {
    // Day: sport ON the runway next to the parked plane, cruiser closing in.
    // Shot from the west looking east down the runway; the plane's bright
    // (non-metallic) fuselage now reads even on its shadow side.
    S.weather.clock = 11.0;
    S.weather.rain = 0;
    putInCar(S, 'sport', 780, -620, Math.PI / 2);
    P.car.heading = Math.PI / 2;
    P.heading = Math.PI / 2;
    S.wanted = 2;
    S.lastSeenAt = S.time;
    S.cruisers.push(makeCar('cruiser', 830, -660, -0.5));
    startMission(S, 12);
    S.missions.timer = 63;
    S.shotHideBeacon = true; // gate-1 beacon is behind the car, a stray streak
    snapBehind(S, 780, -620, Math.PI / 2, 18, 9);
    freezeShot(S);
  } else if (name === 'pier') {
    // Stealth: player close to sentry 2, inside the pier, DETECTED 35%.
    // Sentry 2 stands at (-1000,690); the player at (-980,680) faces it
    // (heading -1.1) so the sentry and its cone are in frame, while the
    // player stays outside every cone (detection frozen at 35).
    S.weather.clock = 20.0;
    S.weather.rain = 0;
    P.onFoot = true; P.car = null;
    P.x = -980; P.z = 680; P.heading = -1.1;
    startMission(S, 13);
    S.missions.detection = 35;
    S.shotHideBeacon = true; // beacon would cover the pier shot
    S.dialog = { text: 'Madame Kestrel: "Quiet now. The sentries watch the pier."', until: S.time + 60 };
    snapBehind(S, -980, 680, -1.1, 12, 7);
    freezeShot(S);
  }
  // Let a few frames render, then flag readiness for the screenshot tool.
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 6) { window.__shotReady = true; return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
