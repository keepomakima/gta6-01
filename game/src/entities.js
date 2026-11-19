// NEON TIDE v7-coverfix — entities.js (structural pass)
// Factories for the player, cars, pedestrians and enemies. All state is
// plain data; rendering and behaviour live in their own modules.
import { CAR_TYPES, PED_SHIRTS, PED_PANTS, PED_SKINS } from './config.js';

let nextId = 1;

function randomPick(arr) {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

export function makeCar(type, x, z, heading = 0, paint = null) {
  const t = CAR_TYPES[type] ? CAR_TYPES[type] : CAR_TYPES.sedan;
  return {
    id: nextId++, type: type, x: x, z: z, heading: heading, speed: 0,
    cond: t.hp, maxCond: t.hp, color: paint !== null && paint !== undefined ? paint : t.color,
    ai: null, // null = parked/player-driven; 'traffic' | 'cruiser' | 'taxi'
    driver: null, smoke: 0, nos: 0,
  };
}

export function makePlayer(x, z) {
  return {
    id: nextId++, x: x, z: z, heading: 0, speed: 0,
    onFoot: true, health: 100, armor: 0,
    money: 250, weapon: 'pistol', ammo: { smg: 0, pistol: 200 },
    car: null, lastShotAt: -10, lastDamageAt: -10,
  };
}

export function makePed(x, z) {
  return {
    id: nextId++, x: x, z: z, heading: Math.random() * Math.PI * 2,
    speed: 6 + Math.random() * 6, flee: 0, panic: 0,
    shirt: randomPick(PED_SHIRTS),
    pants: randomPick(PED_PANTS),
    skin: randomPick(PED_SKINS),
    walkPhase: Math.random() * Math.PI * 2,
    walkSpeed: 5 + Math.random() * 5,
    onSidewalk: Math.random() < 0.7,
  };
}

export function makeEnemy(x, z, opts = {}) {
  const hp = opts.hp !== undefined && opts.hp !== null ? opts.hp : 60;
  return {
    id: nextId++, x: x, z: z, heading: 0,
    hp: hp, maxHp: hp,
    kind: opts.kind ? opts.kind : 'gang',
    name: opts.name ? opts.name : 'Rival',
    dmg: opts.dmg !== undefined && opts.dmg !== null ? opts.dmg : 6,
    shootEvery: opts.shootEvery !== undefined && opts.shootEvery !== null ? opts.shootEvery : 1.6,
    shootTimer: 1 + Math.random(),
    speed: opts.speed !== undefined && opts.speed !== null ? opts.speed : 22,
    homeX: x, homeZ: z, // idle enemies hold their post beyond 320 units
    coneDir: opts.coneDir !== undefined && opts.coneDir !== null ? opts.coneDir : 0,
    coneLen: 70, coneHalf: 0.42,
    frozen: false,
  };
}

export function makeCrate(x, z, label = 'Stash') {
  return { id: nextId++, x: x, z: z, label: label, taken: false };
}

export function makeMarker(x, z, label, color = 0xffd21a) {
  return { x: x, z: z, label: label, color: color, pulse: 0 };
}
