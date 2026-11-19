// NEON TIDE v7 "Golden Hour" — shops.js
import { PLACES } from './config.js';
import { buyUpgrade, serviceCar } from './garage.js';

export function nearestInteractable(S) {
  const P = S.player;
  const cands = [
    { kind: 'garage', x: PLACES.garage.x, z: PLACES.garage.z, r: 26 },
    { kind: 'gunshop', x: PLACES.gunshop.x, z: PLACES.gunshop.z, r: 26 },
    { kind: 'safehouse', x: PLACES.safehouse1.x, z: PLACES.safehouse1.z, r: 22 },
    { kind: 'safehouse', x: PLACES.safehouse2.x, z: PLACES.safehouse2.z, r: 22 },
  ];
  for (const c of cands) {
    const d = Math.hypot(P.x - c.x, P.z - c.z);
    if (d < c.r) return c;
  }
  return null;
}

export function handleInteract(S) {
  const P = S.player;
  const shop = nearestInteractable(S);
  if (shop) {
    if (P.car) {
      exitCar(S);
      return true;
    }
    S.ui.shop = shop.kind;
    S.ui.screen = 'shop';
    return true;
  }
  return false;
}

export function exitCar(S) {
  const P = S.player;
  if (!P.car) return;
  const car = P.car;
  P.car = null;
  P.onFoot = true;
  P.x = car.x + Math.sin(car.heading + Math.PI / 2) * 4;
  P.z = car.z + Math.cos(car.heading + Math.PI / 2) * 4;
  P.speed = 0;
  car.speed = 0;
}

export function enterCar(S, car) {
  const P = S.player;
  P.car = car;
  P.onFoot = false;
  P.speed = 0;
  car.speed = 0;
  car.nos = S.garage.nosTank;
  if (car.ai === 'traffic' && car.driver) car.driver = null;
}

export function shopBuy(S, item) {
  const P = S.player;
  if (S.ui.shop === 'gunshop') {
    if (item === 'smg' && P.money >= 1200 && P.weapon !== 'smg') {
      P.money -= 1200; P.weapon = 'smg'; P.ammo.smg = 240; return 'Tide SMG bought';
    }
    if (item === 'ammo' && P.money >= 200) {
      P.money -= 200; P.ammo.pistol += 60; P.ammo.smg += 120; return 'Ammo restocked';
    }
    if (item === 'armor' && P.money >= 400) {
      P.money -= 400; P.armor = 100; return 'Body armor fitted';
    }
  }
  if (S.ui.shop === 'garage') {
    if (item === 'service' && serviceCar(S)) return 'Car serviced, NOS refilled';
    if (['engine', 'grip', 'armor', 'nos'].includes(item) && buyUpgrade(S, item)) {
      return `${item} upgraded to Lv${S.garage[item]}`;
    }
  }
  if (S.ui.shop === 'safehouse') {
    if (item === 'heal') { P.health = 100; return 'Rested — health full'; }
    if (item === 'save') { S.saveSoon = true; return 'Progress saved'; }
  }
  return null;
}

export function interactPrompt(S) {
  const P = S.player;
  const shop = nearestInteractable(S);
  if (shop) {
    if (P.car) return 'Press E — exit car';
    if (shop.kind === 'garage') return "Press E — Rosa's Garage";
    if (shop.kind === 'gunshop') return 'Press E — Ironworks Arms';
    return 'Press E — Safehouse';
  }
  if (P.car) return 'Press E — exit car';
  return 'Press E — enter car';
}
