// NEON TIDE v7-coverfix — helicopter.js (structural pass)
// AIR-1, the police helicopter: it comes up at wanted 4-5, shadows the
// player from 52 units up with its spotlight cone, and leaves when the
// heat drops. Staged shots park it by hand (parkHeli) instead — the
// cover needs the body in frame over the road, not circling overhead.
// The spotlight geometry lives in render.js; this module only moves the
// dot on the map. Parked helis can be yawed: the mesh faces north by
// default, which shows the rotor end-on from a west-facing chase camera.
import { WANTED } from './config.js';

// Ease one coordinate toward its target: a fixed fraction per second,
// capped so a big frame step never teleports the heli.
function easeToward(value, target, dt, rate) {
  const step = Math.min(1, dt * rate);
  return value + (target - value) * step;
}

export function updateHeli(S, dt) {
  if (S.shotMode) return; // staged frames freeze the heli where parked
  const H = S.heli;
  if (S.wanted < WANTED.heliAt) {
    H.active = false;
    return;
  }
  H.active = true;
  H.targetX = S.player.x;
  H.targetZ = S.player.z;
  H.x = easeToward(H.x, H.targetX, dt, 0.8);
  H.z = easeToward(H.z, H.targetZ, dt, 0.8);
  H.y = easeToward(H.y, 52, dt, 0.8);
  H.rotor += dt * 22;
  H.strobe += dt;
  if (H.strobe >= 1) H.strobe -= 1;
}

// Park the heli at a fixed point for a staged screenshot: x/z on the
// map, y the altitude, yaw the facing (radians, 0 = north). The render
// loop turns the mesh to the parked yaw.
export function parkHeli(S, x, z, y, yaw = 0) {
  const H = S.heli;
  H.active = true;
  H.x = x;
  H.z = z;
  H.y = y;
  H.targetX = x;
  H.targetZ = z;
  H.rotor = 0.4;
  H.yaw = yaw;
}

export function hideHeli(S) { S.heli.active = false; }

// Where the spotlight falls: a cone from the heli body straight down to
// the street below it.
export function heliSpot(S) {
  const H = S.heli;
  return H.active
    ? { x: H.x, y: H.y, z: H.z, groundX: H.x, groundZ: H.z, radius: 6, len: 28 }
    : null;
}
