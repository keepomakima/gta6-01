// NEON TIDE v5 — random.js
// RNG deterministik (mulberry32) supaya autopilot screenshot dan dunia kota
// selalu sama untuk seed yang sama. Ditulis fresh untuk v5.
// Revisi v5.2: angleDiff/angleLerp dipakai belok cruiser + heli yang mulus.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededValue(seed, min, max) {
  const r = mulberry32(seed);
  return min + r() * (max - min);
}
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}
export function dist(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
// Selisih sudut terpendek (radian) — untuk belok mobil/polisi yang mulus.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) { return a + angleDiff(a, b) * t; }
