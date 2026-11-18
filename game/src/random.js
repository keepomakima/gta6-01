// NEON TIDE v6-rebuild-2 — random.js
// Deterministic seeded RNG (mulberry32) so the city, traffic and screenshots
// are identical on every run from the same seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) { this.next = mulberry32(seed); }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  // Deterministic shuffle (Fisher-Yates) for spawn orders.
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// Small helpers shared by traffic and the playtest: pick a random road point
// and a random heading aligned to the road grid.
export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const line = rng.int(-5, 5) * 200;
  const along = rng.range(-1000, 1000);
  return vertical ? { x: line, z: along } : { x: along, z: line };
}

export function roadHeading(x, z) {
  // Headings aligned to the nearest road axis.
  const rx = Math.round(x / 200) * 200;
  const rz = Math.round(z / 200) * 200;
  return Math.abs(x - rx) < Math.abs(z - rz) ? 0 : Math.PI / 2;
}
