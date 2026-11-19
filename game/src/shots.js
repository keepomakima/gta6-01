// NEON TIDE v7-coverfix — shots.js (structural pass)
// Deterministic screenshot autopilot: ?shot=<name>&seed=20261123 stages a
// frozen golden-hour frame and flags it ready after a few frames. The
// render loop HOLDS the staged camera while shotMode is on, so these
// framings are exact: a low tight chase camera, the heli parked over
// the road corridor in frame, cruisers and the roadblock pulled close.
import { startMission } from './missions.js';
import { parkHeli } from './helicopter.js';
import { makeCar, makePed } from './entities.js';
import { startCutscene } from './cutscene.js';

// Staged camera: `back` units behind the subject along its heading, `up`
// high, looking `ahead` units past it at height `lookY`.
function frameShot(S, x, z, heading, back, up, ahead, lookY) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const pos = { x: x - fx * back, y: up, z: z - fz * back };
  const look = { x: x + fx * ahead, y: lookY, z: z + fz * ahead };
  S.camSnap = { pos: pos, look: look };
}

function putInCar(S, type, x, z, heading) {
  const car = makeCar(type, x, z, heading);
  car.nos = S.garage.nosTank;
  S.player.x = x;
  S.player.z = z;
  S.player.heading = heading;
  S.player.car = car;
  S.player.onFoot = false;
  return car;
}

// Peds on the sidewalk near the shot so the frame reads as a living
// street (random spawns are never guaranteed to be in frame).
function stagePeds(S, spots) {
  spots.forEach(([x, z, heading]) => {
    const ped = makePed(x, z);
    ped.heading = heading;
    S.peds.push(ped);
  });
}

function freezeShot(S) {
  S.lastSeenAt = S.time;
  S.missions.frozen = true;
  S.shotMode = true;
}

export function applyShot(S, name) {
  const P = S.player;
  S.weather.autoRain = false;
  switch (name) {
    case 'goldenchase': {
      // COVER — low tight chase (11 back, 4.6 up), heli parked over the
      // road at height 22 yawed toward the lens, roadblock at 68.
      S.weather.clock = 17.8;
      S.weather.rain = 0;
      S.garage.nos = 2;
      S.garage.nosTank = 160;
      putInCar(S, 'sport', 0, 0, -1.885);
      P.car.nos = 160;
      S.wanted = 5;
      S.lastSeenAt = S.time;
      S.missions.index = 14;
      S.missions.mode = 'playing';
      S.missions.step = 1;
      S.shotHideBeacon = true; // the Airfield beacon is 800+ units away
      parkHeli(S, -38, 0, 22, 1.0);
      S.spike = { x: -34, z: 0, until: S.time + 60 };
      S.roadblock = [
        makeCar('cruiser', -68, -12, Math.PI),
        makeCar('cruiser', -68, 12, Math.PI),
      ];
      S.cruisers.push(makeCar('cruiser', -26, -6, 1.3), makeCar('cruiser', -30, 7, 1.8));
      stagePeds(S, [[-40, 16, 0], [-20, -16, Math.PI], [-52, 18, 0], [-34, -14, Math.PI]]);
      frameShot(S, 0, 0, -1.885, 11, 4.6, 12, 4.2);
      freezeShot(S);
      break;
    }
    case 'neonmile': {
      // Dusk on the Neon Mile: bike + rider before the TIDE casino
      // pylon, heli at height 16 over the open plaza, upper right.
      S.weather.clock = 17.9;
      S.weather.rain = 0;
      S.garage.nos = 2;
      S.garage.nosTank = 160;
      putInCar(S, 'bike', 300, 580, Math.PI);
      S.wanted = 3;
      S.lastSeenAt = S.time;
      startMission(S, 14); // M15 Neon Mile: objective line + casino cash
      S.shotHideBeacon = true;
      parkHeli(S, 312, 556, 16); // open plaza, clear of the pylon at (300, 541)
      stagePeds(S, [[282, 562, 0.5], [318, 566, -0.5], [292, 574, Math.PI], [328, 570, 0]]);
      frameShot(S, 300, 580, Math.PI, 12, 6.5, 12, 5.5);
      freezeShot(S);
      break;
    }
    case 'beachfront': {
      // Golden hour on the boardwalk: Deke on foot facing SOUTH (+z),
      // sport car ahead-right on the boardwalk at (618, 700).
      S.weather.clock = 17.6;
      S.weather.rain = 0;
      P.onFoot = true;
      P.car = null;
      P.x = 600;
      P.z = 680;
      P.heading = 0;
      S.parked.push(makeCar('sport', 618, 700, Math.PI / 2));
      S.wanted = 1;
      S.lastSeenAt = S.time;
      startMission(S, 11); // M12 VIP Ride: Beachfront drop
      S.shotHideBeacon = true;
      stagePeds(S, [[588, 700, 0.3], [615, 705, -0.4], [632, 695, Math.PI], [578, 690, 1.2]]);
      frameShot(S, 600, 680, 0, 9, 5, 10, 3.5);
      freezeShot(S);
      break;
    }
    case 'piercutscene': {
      // Stealth + story: the pier at dusk, Kestrel's cutscene panel,
      // DETECTED 35%, heading -1.45 so the whole sun disc fits.
      S.weather.clock = 18.2;
      S.weather.rain = 0;
      P.onFoot = true;
      P.car = null;
      P.x = -992;
      P.z = 686;
      P.heading = -1.45;
      startMission(S, 13);
      S.missions.detection = 35;
      S.shotHideBeacon = true; // beacon would cover the pier shot
      startCutscene(S, [{ who: 'kestrel', text: '"Quiet now. The sentries watch the pier."' }]);
      frameShot(S, -992, 686, -1.45, 10, 5.5, 10, 3);
      freezeShot(S);
      break;
    }
    default:
      break;
  }
  let frames = 0;
  function tick() {
    frames += 1;
    if (frames >= 6) { window.__shotReady = true; return; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
