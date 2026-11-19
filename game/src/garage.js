// NEON TIDE v7-coverfix — garage.js (structural pass)
// Rosa's Garage: four upgrade tracks (engine, grip, armor, NOS), each
// 0..3, bought with cash. The garage state rides in the save.
import { UPGRADES, NOS_BOOST, NOS_DRAIN } from './config.js';

export function createGarage() {
  return { engine: 0, grip: 0, armor: 0, nos: 0, nosTank: 0 };
}

export function upgradeCost(key, level) {
  const c = UPGRADES[key].costs[level + 1];
  return c === undefined ? null : c;
}

export function buyUpgrade(S, key) {
  const G = S.garage;
  const level = G[key];
  if (level >= 3) return false;
  const cost = UPGRADES[key].costs[level + 1];
  if (S.player.money < cost) return false;
  S.player.money -= cost;
  G[key] = level + 1;
  if (key === 'nos') G.nosTank = UPGRADES.nos.cap[G.nos];
  return true;
}

// Full service: $150 restores the car to its (armor-upgraded) max
// condition and refills the NOS tank.
export function serviceCar(S) {
  const P = S.player;
  if (!P.car) return false;
  if (S.player.money < 150) return false;
  S.player.money -= 150;
  P.car.cond = P.car.maxCond * UPGRADES.armor.hpMul[S.garage.armor];
  refillNosTank(S);
  return true;
}

function refillNosTank(S) {
  S.garage.nosTank = UPGRADES.nos.cap[S.garage.nos];
  if (S.player.car) S.player.car.nos = S.garage.nosTank;
}

// Top speed: engine multiplier, halved while the tires are shredded.
export function carTopSpeed(S, base) {
  let top = base * UPGRADES.engine.topMul[S.garage.engine];
  const car = S.player.car;
  if (car) {
    if (car.tireBurstUntil && S.time < car.tireBurstUntil) top *= 0.45;
  }
  return top;
}

export function carTurnRate(S, base) {
  return base * UPGRADES.grip.turnMul[S.garage.grip];
}

// NOS: holding the boost key drains the tank and multiplies accel.
export function nosBoost(S, boosting, dt) {
  const car = S.player.car;
  if (!car) return 1;
  if (S.garage.nos === 0) return 1;
  if (boosting && car.nos > 0) {
    car.nos -= NOS_DRAIN * dt;
    if (car.nos < 0) car.nos = 0;
    S.garage.nosTank = car.nos;
    S.nosFlame = true;
    return NOS_BOOST;
  }
  S.nosFlame = false;
  return 1;
}

export function syncNosToCar(S) {
  if (S.player.car) S.player.car.nos = S.garage.nosTank;
}
