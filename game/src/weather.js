// NEON TIDE v6-rebuild-2 — weather.js
// Rain intensity 0-1 and the day/night clock. Rain comes automatically at
// night; the player can also set it from the pause menu (debug / playtest).
export function createWeather() {
  return { rain: 0, clock: 19.5, // start at dusk, the city's best light
    autoRain: true };
}

export function updateWeather(S, dt) {
  const W = S.weather;
  // Game clock: a full day in ~8 real minutes at 1x.
  W.clock = (W.clock + dt / 480 * 24) % 24;
  if (W.autoRain) {
    const night = W.clock > 19 || W.clock < 6;
    const target = night ? 0.35 : 0;
    W.rain += (target - W.rain) * Math.min(1, dt * 0.05);
  }
  W.rain = Math.max(0, Math.min(1, W.rain));
}

export function isNight(S) {
  const c = S.weather.clock;
  return c > 18.5 || c < 6.5;
}

// Sun / hemisphere intensities the renderer reads. Night is deliberately
// bright (hemi 1.05, sun 0.45) — an earlier build's night was so dark the
// buildings were black silhouettes.
export function lightLevels(S) {
  if (isNight(S)) return { hemi: 1.05, sun: 0.45, sky: 0x0b0b1c, ground: 0x2a2a3a };
  const dusk = S.weather.clock > 16.5 && S.weather.clock < 19;
  if (dusk) return { hemi: 0.9, sun: 1.1, sky: 0x2a1a3a, ground: 0x3a2a2a };
  return { hemi: 1.0, sun: 1.5, sky: 0x87b5e0, ground: 0x4a4a3a };
}

// Formatted in-game clock for the HUD ("21:40").
export function clockString(S) {
  const c = S.weather.clock;
  const h = Math.floor(c), m = Math.floor((c - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
