// NEON TIDE v7 "Golden Hour" — entities.js
// Factories for the player, cars, pedestrians and enemies. All state is
// plain data; rendering and behaviour live in their own modules.
// v7: pedestrians carry shirt / pants / skin colours and a walk phase so
// the living city is visibly varied; traffic cars can take a paint colour.
import { CAR_TYPES, PED_SHIRTS, PED_PANTS, PED_SKINS } from './config.js';

let nextId = 1;

export function makePlayer(x, z) {
  return {
    id: nextId++, x, z, heading: 0, speed: 0,
    onFoot: true, health: 100, armor: 0,
    money: 250, weapon: 'pistol', ammo: { pistol: 200, smg: 0 },
    car: null, lastShotAt: -10, lastDamageAt: -10,
  };
}

export function makeCar(type, x, z, heading = 0, paint = null) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: nextId++, type, x, z, heading, speed: 0,
    cond: t.hp, maxCond: t.hp, color: paint ?? t.color,
    ai: null, // null = parked/player-driven; 'traffic' | 'cruiser' | 'taxi'
    driver: null, smoke: 0, nos: 0,
  };
}

export function makePed(x, z) {
  return {
    id: nextId++, x, z, heading: Math.random() * Math.PI * 2,
    speed: 6 + Math.random() * 6, flee: 0, panic: 0,
    // v7 living-city look: varied clothes, skin and a walk-cycle phase.
    shirt: PED_SHIRTS[Math.floor(Math.random() * PED_SHIRTS.length)],
    pants: PED_PANTS[Math.floor(Math.random() * PED_PANTS.length)],
    skin: PED_SKINS[Math.floor(Math.random() * PED_SKINS.length)],
    walkPhase: Math.random() * Math.PI * 2,
    walkSpeed: 5 + Math.random() * 5,
    onSidewalk: Math.random() < 0.7,
  };
}

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

export function makeCrate(x, z, label = 'Stash') {
  return { id: nextId++, x, z, label, taken: false };
}

export function makeMarker(x, z, label, color = 0xffd21a) {
  return { x, z, label, color, pulse: 0 };
}
