// NEON TIDE v5 — police helicopter AIR-1. Active at wanted 4-5: it flies
// above the player, sweeps a spotlight, and keeps the heat from cooling
// while it watches. Pure pursuit pressure; it never shoots.
import { dist, angleDiff } from './random.js';

export function updateHeli(g, dt) {
  const heli = g.heli;
  const want = g.wanted >= 4 && g.mode === 'play';
  heli.active = want;
  if (!want) return;
  const p = g.player;
  const d = dist(heli.x, heli.y, p.x, p.y);
  const a = Math.atan2(p.y - heli.y, p.x - heli.x);
  heli.angle += angleDiff(heli.angle, a) * Math.min(1, dt * 1.5);
  const speed = d > 260 ? 320 : 140;
  heli.x += Math.cos(heli.angle) * speed * dt;
  heli.y += Math.sin(heli.angle) * speed * dt;
  heli.x = Math.max(60, Math.min(2340, heli.x));
  heli.y = Math.max(60, Math.min(1540, heli.y));
  heli.spotA = a + Math.sin(g.time * 1.4) * 0.25;
  heli.spotOn = d < 700;
  // AIR-1 watching means the heat never cools off on its own.
  if (heli.spotOn) g.wantedQuietT = 0;
}
