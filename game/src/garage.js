// NEON TIDE v6-rebuild-2 — garage.js
// Rosa's Garage upgrades: Engine / Grip Tires / Car Armor / NOS Kit, levels
// 0-3 each. NOS: hold Shift while driving for a 1.45x boost that drains the
// tank at 34/s; the tank refills at the garage (service).
import { UPGRADES, NOS_BOOST, NOS_DRAIN } from './config.js';

export function createGarage() {
  return { engine: 0, grip: 0, armor: 0, nos: 0, nosTank: 0 };
}

export function upgradeCost(key, level) {
  return UPGRADES[key].costs[level + 1] ?? null;
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

export function serviceCar(S) {
  const P = S.player;
  if (!P.car) return false;
  if (S.player.money < 150) return false;
  S.player.money -= 150;
  P.car.cond = P.car.maxCond * UPGRADES.armor.hpMul[S.garage.armor];
  G_nosRefill(S);
  return true;
}

function G_nosRefill(S) {
  S.garage.nosTank = UPGRADES.nos.cap[S.garage.nos];
  if (S.player.car) S.player.car.nos = S.garage.nosTank;
}

// Effective top speed / turn for the player's current car.
export function carTopSpeed(S, base) {
  let top = base * UPGRADES.engine.topMul[S.garage.engine];
  const car = S.player.car;
  if (car && car.tireBurstUntil && S.time < car.tireBurstUntil) top *= 0.45;
  return top;
}

export function carTurnRate(S, base) {
  return base * UPGRADES.grip.turnMul[S.garage.grip];
}

// NOS drain while boosting; returns the boost multiplier for this frame.
export function nosBoost(S, boosting, dt) {
  const car = S.player.car;
  if (!car || S.garage.nos === 0) return 1;
  if (boosting && car.nos > 0) {
    car.nos = Math.max(0, car.nos - NOS_DRAIN * dt);
    S.garage.nosTank = car.nos;
    S.nosFlame = true;
    return NOS_BOOST;
  }
  S.nosFlame = false;
  return 1;
}

// Sync the NOS tank onto a freshly entered car.
export function syncNosToCar(S) {
  if (S.player.car) S.player.car.nos = S.garage.nosTank;
}
