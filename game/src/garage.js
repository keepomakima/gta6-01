// NEON TIDE v6 — Rosa's Garage upgrades + NOS, and the Ironworks Arms gun
// shop. Upgrades apply to the player's current car (Engine / Grip / Armor /
// NOS Kit, levels 0-3); NOS boosts top speed 1.45x while Shift is held and
// drains 34/s. The garage also repairs and refills NOS.
import { UPGRADES, NOS_DRAIN } from './config.js';

export class Garage {
  constructor(state) {
    this.state = state; // {money, upgrades, player}
  }

  price(kind) {
    const lv = this.state.upgrades[kind];
    if (lv >= 3) return null;
    return UPGRADES[kind].prices[lv];
  }

  buy(kind) {
    const lv = this.state.upgrades[kind];
    if (lv >= 3) return false;
    const cost = UPGRADES[kind].prices[lv];
    if (this.state.money < cost) return false;
    this.state.money -= cost;
    this.state.upgrades[kind] = lv + 1;
    this._applyToCar();
    return true;
  }

  _applyToCar() {
    const car = this.state.player.car;
    if (!car) return;
    car.upgrades = { ...this.state.upgrades };
    car.nosMax = UPGRADES.nos.nosMax[this.state.upgrades.nos];
    if (car.nos > car.nosMax) car.nos = car.nosMax;
  }

  // Called when the player enters any car: upgrades travel with the player.
  applyToCar(car) {
    car.upgrades = { ...this.state.upgrades };
    car.nosMax = UPGRADES.nos.nosMax[this.state.upgrades.nos];
    if (car.nos <= 0) car.nos = car.nosMax;
  }

  service() {
    // Full repair + NOS refill for $150.
    if (this.state.money < 150) return false;
    this.state.money -= 150;
    const car = this.state.player.car;
    if (car) car.repair();
    return true;
  }
}

export const GUNSHOP = {
  items: [
    { id: 'smg', label: 'SMG', price: 800 },
    { id: 'ammo-pistol', label: 'Pistol ammo x24', price: 120 },
    { id: 'ammo-smg', label: 'SMG ammo x40', price: 200 },
    { id: 'armor', label: 'Body armor (+50)', price: 350 },
  ],
  buy(state, combat, id) {
    const item = this.items.find((i) => i.id === id);
    if (!item || state.money < item.price) return false;
    if (id === 'smg' && state.weapons.includes('smg')) return false;
    state.money -= item.price;
    if (id === 'smg') { state.weapons.push('smg'); combat.ammo.smg += 40; }
    if (id === 'ammo-pistol') combat.ammo.pistol += 24;
    if (id === 'ammo-smg') combat.ammo.smg += 40;
    if (id === 'armor') state.player.armor = Math.min(100, state.player.armor + 50);
    return true;
  },
};
