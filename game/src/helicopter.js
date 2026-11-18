// NEON TIDE v6-rebuild-2 — helicopter.js
// AIR-1, the PSPD helicopter: spawns at wanted 4-5, hovers above the player
// with a visible spotlight cone on the ground. Frozen in shot mode.
// parkHeli(S, x, z, y) — argument order is x, z, y (height last).
import { WANTED } from './config.js';

export function updateHeli(S, dt) {
  if (S.shotMode) return;
  const H = S.heli;
  if (S.wanted >= WANTED.heliAt) {
    H.active = true;
    H.targetX = S.player.x;
    H.targetZ = S.player.z;
    H.x += (H.targetX - H.x) * Math.min(1, dt * 0.8);
    H.z += (H.targetZ - H.z) * Math.min(1, dt * 0.8);
    H.y += (52 - H.y) * Math.min(1, dt * 0.8);
    H.rotor += dt * 22;
    H.strobe = (H.strobe + dt) % 1;
  } else {
    H.active = false;
  }
}

// Park the heli at a fixed spot for a staged screenshot.
// NOTE: arguments are (x, z, y) — height LAST. An earlier build passed
// (x, y, z) and parked the heli 232 units up in the sky.
export function parkHeli(S, x, z, y) {
  const H = S.heli;
  H.active = true;
  H.x = x; H.z = z; H.y = y;
  H.targetX = x; H.targetZ = z;
  H.rotor = 0.4;
}

export function hideHeli(S) { S.heli.active = false; }

// Spotlight cone geometry the renderer draws: apex at the heli, base circle
// on the ground below it (radius 6, length 28 in the v6 shot tuning).
export function heliSpot(S) {
  const H = S.heli;
  if (!H.active) return null;
  return { x: H.x, y: H.y, z: H.z, groundX: H.x, groundZ: H.z, radius: 6, len: 28 };
}
