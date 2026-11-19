// NEON TIDE v7 "Golden Hour" — helicopter.js
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

export function parkHeli(S, x, z, y) {
  const H = S.heli;
  H.active = true;
  H.x = x; H.z = z; H.y = y;
  H.targetX = x; H.targetZ = z;
  H.rotor = 0.4;
}

export function hideHeli(S) { S.heli.active = false; }

export function heliSpot(S) {
  const H = S.heli;
  if (!H.active) return null;
  return { x: H.x, y: H.y, z: H.z, groundX: H.x, groundZ: H.z, radius: 6, len: 28 };
}
