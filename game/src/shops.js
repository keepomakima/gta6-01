// NEON TIDE v5 — Ironworks Arms gun shop. First menu item is the SMG.
// ArrowUp/Down to pick, Enter to buy, Escape to leave. Ammo and armor
// are consumables; guns stay owned forever.
import { SHOP_ITEMS } from './config.js';

export function openShop(g) {
  if (g.shopOpen) return;
  g.shopOpen = true;
  g.shopSel = 0;
  g.mode = 'pause';
}

export function closeShop(g) {
  g.shopOpen = false;
  g.mode = 'play';
}

export function shopKey(g, code) {
  if (code === 'ArrowDown') g.shopSel = (g.shopSel + 1) % SHOP_ITEMS.length;
  else if (code === 'ArrowUp') g.shopSel = (g.shopSel + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
  else if (code === 'Enter') buyShopItem(g);
  else if (code === 'Escape') closeShop(g);
}

export function buyShopItem(g) {
  const item = SHOP_ITEMS[g.shopSel];
  if (g.money < item.price) { g.popup(`Need $${item.price} for ${item.label}`); return false; }
  if ((item.id === 'smg' || item.id === 'shotgun') && g.owned[item.id]) {
    g.popup(`You already own the ${item.label}`);
    return false;
  }
  g.money -= item.price;
  if (item.id === 'ammo') {
    g.player.ammo.pistol += 120;
    g.player.ammo.smg += 120;
    g.player.ammo.shotgun += 40;
  } else if (item.id === 'armor') {
    g.player.armor = Math.min(100, g.player.armor + 50);
  } else {
    g.owned[item.id] = true;
    g.player.weapon = item.id;
    g.player.ammo[item.id] = 60;
  }
  g.popup(`${item.label} bought — $${item.price}`);
  g.audio.pickup();
  return true;
}
