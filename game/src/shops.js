// NEON TIDE v7-coverfix — shops.js (structural pass)
// The places Deke can walk into: Rosa's Garage (upgrades + service),
// Ironworks Arms (SMG, ammo, armor) and the two safehouses (heal + save).
// Pressing E near one opens it — from a car, E exits first.
import { PLACES } from './config.js';
import { buyUpgrade, serviceCar } from './garage.js';

const SHOP_SPOTS = [
  { r: 26, z: PLACES.garage.z, x: PLACES.garage.x, kind: 'garage' },
  { r: 26, z: PLACES.gunshop.z, x: PLACES.gunshop.x, kind: 'gunshop' },
  { r: 22, z: PLACES.safehouse1.z, x: PLACES.safehouse1.x, kind: 'safehouse' },
  { r: 22, z: PLACES.safehouse2.z, x: PLACES.safehouse2.x, kind: 'safehouse' },
];

export function nearestInteractable(S) {
  const P = S.player;
  return SHOP_SPOTS.find((c) => Math.hypot(P.x - c.x, P.z - c.z) < c.r) || null;
}

export function handleInteract(S) {
  const P = S.player;
  const shop = nearestInteractable(S);
  if (!shop) return false;
  if (P.car) {
    exitCar(S);
    return true;
  }
  S.ui.shop = shop.kind;
  S.ui.screen = 'shop';
  return true;
}

// Step out on the driver's side, car stopped.
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

// Slide in: the car takes the garage NOS level, and a stolen traffic car
// loses its driver.
export function enterCar(S, car) {
  const P = S.player;
  P.car = car;
  P.onFoot = false;
  P.speed = 0;
  car.speed = 0;
  car.nos = S.garage.nosTank;
  if (car.ai === 'traffic') {
    if (car.driver) car.driver = null;
  }
}

export function shopBuy(S, item) {
  const P = S.player;
  switch (S.ui.shop) {
    case 'gunshop':
      switch (item) {
        case 'smg':
          if (P.money >= 1200 && P.weapon !== 'smg') {
            P.money -= 1200;
            P.weapon = 'smg';
            P.ammo.smg = 240;
            return 'Tide SMG bought';
          }
          break;
        case 'ammo':
          if (P.money >= 200) {
            P.money -= 200;
            P.ammo.pistol += 60;
            P.ammo.smg += 120;
            return 'Ammo restocked';
          }
          break;
        case 'armor':
          if (P.money >= 400) {
            P.money -= 400;
            P.armor = 100;
            return 'Body armor fitted';
          }
          break;
        default:
          break;
      }
      break;
    case 'garage':
      if (item === 'service' && serviceCar(S)) return 'Car serviced, NOS refilled';
      if ((item === 'engine' || item === 'grip' || item === 'armor' || item === 'nos') && buyUpgrade(S, item)) {
        return `${item} upgraded to Lv${S.garage[item]}`;
      }
      break;
    case 'safehouse':
      if (item === 'heal') { P.health = 100; return 'Rested — health full'; }
      if (item === 'save') { S.saveSoon = true; return 'Progress saved'; }
      break;
    default:
      break;
  }
  return null;
}

export function interactPrompt(S) {
  const P = S.player;
  const shop = nearestInteractable(S);
  const NAMES = {
    garage: "Press E — Rosa's Garage",
    gunshop: 'Press E — Ironworks Arms',
    safehouse: 'Press E — Safehouse',
  };
  if (!shop) {
    if (P.car) return 'Press E — exit car';
    return 'Press E — enter car';
  }
  if (P.car) return 'Press E — exit car';
  return NAMES[shop.kind];
}
