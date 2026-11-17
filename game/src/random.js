// Seeded random numbers for NEON TIDE. Same seed, same city, same traffic —
// that is what makes the screenshot scenes repeatable frame for frame.
// Splitmix32: cheap, fast, and good enough for placement and AI jitter.
export function createRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  function next() {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(a, b) { return a + next() * (b - a); },
    int(a, b) { return Math.floor(a + next() * (b - a + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
  };
}
