// NEON TIDE v6-rebuild-2 — entities.js
// Factories for the player, cars, pedestrians and enemies. All state is plain
// data; rendering and behaviour live in their own modules.
import { CAR_TYPES, WEAPONS } from './config.js';

let nextId = 1;

export function makePlayer(x, z) {
  return {
    id: nextId++, x, z, heading: 0, speed: 0,
    onFoot: true, health: 100, armor: 0,
    money: 250, weapon: 'pistol', ammo: { pistol: 200, smg: 0 },
    car: null, lastShotAt: -10, lastDamageAt: -10,
  };
}

export function makeCar(type, x, z, heading = 0) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: nextId++, type, x, z, heading, speed: 0,
    cond: t.hp, maxCond: t.hp, color: t.color,
    ai: null, // null = parked/player-driven; 'traffic' | 'cruiser' | 'taxi'
    driver: null, smoke: 0, nos: 0,
  };
}

export function makePed(x, z) {
  return {
    id: nextId++, x, z, heading: Math.random() * Math.PI * 2,
    speed: 6 + Math.random() * 6, flee: 0, panic: 0,
  };
}

// Enemies: gang members, vault guards, sentries and bosses. `kind` drives
// behaviour in combat.js: 'gang' | 'guard' | 'sentry' | 'boss'.
export function makeEnemy(x, z, opts = {}) {
  return {
    id: nextId++, x, z, heading: 0,
    hp: opts.hp ?? 60, maxHp: opts.hp ?? 60,
    kind: opts.kind || 'gang',
    name: opts.name || 'Rival',
    dmg: opts.dmg ?? 6, shootEvery: opts.shootEvery ?? 1.6,
    shootTimer: 1 + Math.random(), speed: opts.speed ?? 22,
    homeX: x, homeZ: z, // idle enemies hold their post beyond 320 units
    coneDir: opts.coneDir ?? 0, coneLen: 70, coneHalf: 0.42,
    frozen: false,
  };
}

// A collectable crate / stash / package lying on the road.
export function makeCrate(x, z, label = 'Stash') {
  return { id: nextId++, x, z, label, taken: false };
}

// Waypoint / objective marker used by missions and the HUD minimap.
export function makeMarker(x, z, label, color = 0xffd21a) {
  return { x, z, label, color, pulse: 0 };
}
