// NEON TIDE v7-coverfix — weather.js
// Rain intensity 0-1 and the day/night clock. The game opens at golden
// hour (17:48) — the warm low sun the v7 look is built around — and the
// clock drifts slowly from there. Rain still comes automatically at night.
import { GOLDEN_HOUR } from './config.js';

export function createWeather() {
  return { rain: 0, clock: GOLDEN_HOUR.clock, autoRain: true };
}

export function updateWeather(S, dt) {
  const W = S.weather;
  W.clock = (W.clock + dt / 480 * 24) % 24;
  if (W.autoRain) {
    const night = W.clock > 19 || W.clock < 6;
    const target = night ? 0.35 : 0;
    W.rain += (target - W.rain) * Math.min(1, dt * 0.05);
  }
  W.rain = Math.max(0, Math.min(1, W.rain));
}

export function clockString(S) {
  const c = S.weather.clock;
  const h = Math.floor(c), m = Math.floor((c - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isNight(S) {
  const c = S.weather.clock;
  return c > 18.5 || c < 6.5;
}

export function isGoldenHour(S) {
  const c = S.weather.clock;
  return c >= 16.5 && c <= 19;
}

// Sun / hemisphere intensities the renderer reads. Golden hour is warm
// and bright (amber sun 1.5, warm sky); night stays deliberately bright
// (hemi 1.05, sun 0.45) — an earlier build's night was so dark the
// screenshots read as a black frame.
export function lightLevels(S) {
  if (isNight(S)) return { hemi: 1.05, sun: 0.45, sky: 0x0b0b1c, ground: 0x2a2a3a, sunColor: 0x8899ff, golden: false };
  if (isGoldenHour(S)) {
    return { hemi: 1.0, sun: 1.5, sky: 0xe8975a, ground: 0x5a3a2a, sunColor: GOLDEN_HOUR.sunColor, golden: true };
  }
  const dusk = S.weather.clock > 19 && S.weather.clock < 20;
  if (dusk) return { hemi: 0.9, sun: 0.9, sky: 0x3a2a4a, ground: 0x3a2a2a, sunColor: 0xff8a5a, golden: false };
  return { hemi: 1.0, sun: 1.5, sky: 0x87b5e0, ground: 0x4a4a3a, sunColor: 0xffe2b0, golden: false };
}
