// NEON TIDE — random.js
// RNG deterministik (mulberry32) supaya autopilot screenshot dan dunia kota
// selalu sama untuk seed yang sama. Dipakai world gen, traffic, dan shots.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RNG sekali pakai untuk satu nilai acak dari seed.
export function seededValue(seed, min, max) {
  const r = mulberry32(seed);
  return min + r() * (max - min);
}

// Pilih satu elemen array dengan RNG yang diberikan.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Acak bilangan bulat [min, max] dengan RNG yang diberikan.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Acak desimal [min, max) dengan RNG yang diberikan.
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Jarak euclid dua titik. Dipakai hampir semua sistem (misi, polisi, combat).
export function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Batasi nilai ke interval [lo, hi].
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Interpolasi linear.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
