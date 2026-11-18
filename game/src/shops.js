// NEON TIDE v4 — shops: the Ironworks gun shop and the safehouses.
// One job: spending money on guns/ammo/armor, and healing + saving + swapping
// cars at a safehouse.
import { SHOP_ITEMS, WEAPONS, GUN_SHOP, SAFEHOUSES } from './config.js';

export function nearGunShop(G) {
  return Math.hypot(G.player.x - GUN_SHOP.x, G.player.y - GUN_SHOP.y) < 70;
}

export function nearSafehouse(G) {
  for (const s of SAFEHOUSES) {
    if (Math.hypot(G.player.x - s.x, G.player.y - s.y) < 70) return s;
  }
  return null;
}

export function openShop(G) {
  G.shopOpen = true;
  G.shopSel = 0;
  G.audio.sfx('door');
}

// Shared ammo grant: shop purchases and (via combat drops) pickups both flow here.
export function giveAmmo(G, weapon, n) {
  G.player.ammo[weapon] = (G.player.ammo[weapon] ?? 0) + n;
  return G.player.ammo[weapon];
}

export function closeShop(G) { G.shopOpen = false; }

export function buySelected(G) {
  const p = G.player;
  const item = SHOP_ITEMS[G.shopSel];
  if (!item) return 'NO ITEM';
  if (p.money < item.price) return 'NOT ENOUGH CASH';
  if (item.id === 'smg' || item.id === 'shotgun') {
    if (p.owned[item.id]) return 'ALREADY OWNED';
    p.money -= item.price;
    p.owned[item.id] = true;
    p.ammo[item.id] = WEAPONS[item.id].mag * 2;
    p.weapon = item.id;
    G.audio.sfx('cash');
    return `${WEAPONS[item.id].name.toUpperCase()} BOUGHT`;
  }
  if (item.id === 'ammo') {
    if (p.weapon === 'fists') return 'EQUIP A GUN FIRST';
    p.money -= item.price;
    giveAmmo(G, p.weapon, 48);
    G.audio.sfx('cash');
    return '+48 AMMO';
  }
  if (item.id === 'armor') {
    if (p.armor >= 100) return 'ARMOR FULL';
    p.money -= item.price;
    p.armor = Math.min(100, p.armor + 50);
    G.audio.sfx('cash');
    return '+50 ARMOR';
  }
  return 'SOLD';
}

export function shopItems() { return SHOP_ITEMS; }

// Safehouse: heal to full, save the game, and swap the garage car.
export function useSafehouse(G, house) {
  const p = G.player;
  p.hp = 100;
  p.armor = Math.max(p.armor, 50);
  G.saveGame();
  G.particles.popup(p.x, p.y - 40, `${house.name.toUpperCase()} — HEALED + SAVED`, '#7dff8a', true);
  G.audio.sfx('mission');
  return house;
}

export function cycleGarageCar(G) {
  // The garage holds one car per mission milestone; cycling swaps the car
  // parked outside the safehouse.
  const unlocked = ['sedan'];
  if (G.missionsDone >= 2) unlocked.push('sport');
  if (G.missionsDone >= 6) unlocked.push('truck');
  if (G.missionsDone >= 9) unlocked.push('taxi');
  G.garageIdx = ((G.garageIdx ?? 0) + 1) % unlocked.length;
  return unlocked[G.garageIdx];
}
