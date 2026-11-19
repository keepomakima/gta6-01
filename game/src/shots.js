// NEON TIDE v7 "Golden Hour" — shots.js
// Deterministic screenshot autopilot: ?shot=<name>&seed=20261123 sets up a
// v7 shots are all golden-hour staged: the cover faces the low western sun
// so the amber disc, long shadows and warm fog are in frame, and every shot
// has pedestrians on the sidewalks (v6r2's city looked empty).
import { startMission } from './missions.js';
import { parkHeli } from './helicopter.js';
import { makeCar, makePed } from './entities.js';
import { startCutscene } from './cutscene.js';

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

// A few pedestrians placed on the sidewalk near the shot so the frame is
// visibly alive (random spawns are never guaranteed to be in frame).
function stagePeds(S, spots) {
  for (const [x, z, heading] of spots) {
    const ped = makePed(x, z);
    ped.heading = heading;
    S.peds.push(ped);
  }
}

function freezeShot(S) {
  S.shotMode = true;
  S.missions.frozen = true;
  S.lastSeenAt = S.time;
}

export function applyShot(S, name) {
  const P = S.player;
  S.weather.autoRain = false;
  if (name === 'goldenchase') {
    // COVER: golden-hour chase facing the low western sun — amber disc in
    // the sky, long shadows, wanted 5, heli + spotlight, spike strip,
    // roadblock ahead, NOS Lv2, M15 in progress, peds on the sidewalks.
    S.weather.clock = 17.8;
    S.weather.rain = 0;
    S.garage.nos = 2; S.garage.nosTank = 160;
    // Heading -1.82 (slightly north of due west) angles the chase camera
    // so the low western sun disc sits in frame above the skyline instead
    // of hiding behind the tower on the right.
    putInCar(S, 'sport', 0, 0, -1.82);
    P.car.nos = 160;
    S.wanted = 5;
    S.lastSeenAt = S.time;
    S.missions.index = 14; S.missions.mode = 'playing'; S.missions.step = 1;
    S.shotHideBeacon = true; // the Airfield beacon is 800+ units away and
    parkHeli(S, -60, 40, 26);
    S.spike = { x: -55, z: 0, until: S.time + 60 };
    S.roadblock = [
      makeCar('cruiser', -90, -14, Math.PI),
      makeCar('cruiser', -90, 14, Math.PI),
    ];
    S.cruisers.push(makeCar('cruiser', -45, -35, -0.4));
    S.cruisers.push(makeCar('cruiser', -45, 35, 0.3));
    stagePeds(S, [[16, 18, 0], [-16, -18, Math.PI], [24, -16, Math.PI / 2], [-30, 18, 0]]);
    snapBehind(S, 0, 0, -1.82, 15, 8);
    freezeShot(S);
  } else if (name === 'neonmile') {
    // Dusk on the Neon Mile: motor Tide Runner 900 + rider in front of the
    // TIDE casino pylon, neon signs lit, pedestrians on the plaza.
    S.weather.clock = 17.9;
    S.weather.rain = 0;
    S.garage.nos = 2; S.garage.nosTank = 160;
    putInCar(S, 'bike', 300, 580, Math.PI);
    P.x = 300; P.z = 580; P.heading = Math.PI;
    P.car.x = 300; P.car.z = 580; P.car.heading = Math.PI;
    S.wanted = 3;
    S.lastSeenAt = S.time;
    startMission(S, 14); // M15 Neon Mile: objective line + casino cash
    S.shotHideBeacon = true;
    parkHeli(S, 310, 545, 30); // between camera and pylon, in frame
    stagePeds(S, [[280, 560, 0.5], [320, 565, -0.5], [290, 600, Math.PI], [330, 595, 0]]);
    snapBehind(S, 300, 580, Math.PI, 9, 5.5);
    freezeShot(S);
  } else if (name === 'beachfront') {
    // Golden hour on the Beachfront boardwalk: Deke on foot facing SOUTH
    // (+z) toward the palms, the beach and the sea; the skyline is behind
    // the camera and the golden sky fills the frame ahead.
    S.weather.clock = 17.6;
    S.weather.rain = 0;
    P.onFoot = true; P.car = null;
    P.x = 600; P.z = 680; P.heading = 0;
    S.parked.push(makeCar('sport', 620, 660, Math.PI / 2));
    S.wanted = 1;
    S.lastSeenAt = S.time;
    startMission(S, 11); // M12 VIP Ride: Beachfront drop
    S.shotHideBeacon = true;
    stagePeds(S, [[580, 700, 0.3], [615, 705, -0.4], [640, 695, Math.PI], [570, 690, 1.2]]);
    snapBehind(S, 600, 680, 0, 11, 6);
    freezeShot(S);
  } else if (name === 'piercutscene') {
    // Stealth + story: the pier at dusk with Madame Kestrel's cutscene
    // portrait panel on screen, DETECTED 35%, sentry + vision cone close
    // in frame. Player stands 9 units from sentry 2 (-1000, 690) so the
    // sentry reads at human scale instead of a speck on the horizon.
    S.weather.clock = 18.2;
    S.weather.rain = 0;
    P.onFoot = true; P.car = null;
    P.x = -992; P.z = 686; P.heading = -1.107;
    startMission(S, 13);
    S.missions.detection = 35;
    S.shotHideBeacon = true; // beacon would cover the pier shot
    startCutscene(S, [{ who: 'kestrel', text: '"Quiet now. The sentries watch the pier."' }]);
    snapBehind(S, -992, 686, -1.107, 10, 6);
    freezeShot(S);
  }
  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames >= 6) { window.__shotReady = true; return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
