// NEON TIDE v5 — Rosa's Garage: Engine / Grip Tires / Car Armor / NOS Kit,
// levels 0-3. Bought with cash; buying a level also services the car
// (full repair + NOS refill). Menu: ArrowUp/Down to pick, Enter to buy,
// Escape to leave. The first thing the garage does on open is service.
import { UPGRADES, NOS_TANK } from './config.js';

export function openGarage(g) {
  if (g.garageOpen) return;
  g.garageOpen = true;
  g.garageSel = 0;
  g.mode = 'pause';
  // Service: repair the player's car and refill the NOS tank.
  if (g.player.car) g.player.car.cond = g.player.car.maxHp || 100;
  if ((g.upgrades.nos || 0) > 0) g.nos = NOS_TANK;
  g.popup("Rosa's Garage — serviced");
}

export function closeGarage(g) {
  g.garageOpen = false;
  g.mode = 'play';
}

export function garageKey(g, code) {
  if (code === 'ArrowDown') g.garageSel = (g.garageSel + 1) % UPGRADES.length;
  else if (code === 'ArrowUp') g.garageSel = (g.garageSel + UPGRADES.length - 1) % UPGRADES.length;
  else if (code === 'Enter') buyUpgrade(g);
  else if (code === 'Escape') closeGarage(g);
}

export function buyUpgrade(g) {
  const item = UPGRADES[g.garageSel];
  const lvl = g.upgrades[item.id] || 0;
  if (lvl >= 3) { g.popup(`${item.label} is already MAX`); return false; }
  const price = item.costs[lvl];
  if (g.money < price) { g.popup(`Need $${price} for ${item.label} Lv${lvl + 1}`); return false; }
  g.money -= price;
  g.upgrades[item.id] = lvl + 1;
  if (item.id === 'nos') {
    g.nosMax = NOS_TANK;
    g.nos = NOS_TANK;
  }
  if (g.player.car) g.player.car.cond = 100;
  g.popup(`${item.label} Lv${lvl + 1} installed — $${price}`);
  g.audio.pickup();
  return true;
}

// Effective upgrade multipliers are computed in entities.carStats.
export function upgradeSummary(g) {
  return UPGRADES.map((u) => `${u.label} Lv${g.upgrades[u.id] || 0}`).join(' · ');
}
