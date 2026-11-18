// NEON TIDE — shops.js
// Toko senjata Ironworks Arms (baru v4) + 2 safehouse (baru v4).
// Toko: beli SMG / shotgun / ammo / armor dengan uang. Safehouse: heal penuh,
// save ke localStorage, dan perbaiki mobil (garasi).
import { SHOP_ITEMS, PLACES, WEAPONS } from './config.js';
import { dist } from './random.js';

export function makeShop() {
  return { open: false, selected: 0, message: '' };
}

// Buka toko bila pemain dekat Ironworks Arms (E). Return true bila terbuka.
export function tryOpenShop(G) {
  const p = G.player;
  if (dist(p.x, p.y, PLACES.gunShop.x, PLACES.gunShop.y) < 95) {
    G.shop.open = true;
    G.shop.selected = 0;
    G.shop.message = 'Selamat datang di Ironworks Arms.';
    G.audio.sfx('shop');
    return true;
  }
  return false;
}

// Beli item yang sedang dipilih (Enter di toko). Revisi: beli senjata langsung
// mengganti senjata aktif supaya bisa dipakai di combat tanpa buka menu lagi.
export function buySelected(G) {
  const p = G.player;
  const item = SHOP_ITEMS[G.shop.selected];
  if (!item) return;
  if (p.money < item.price) {
    G.shop.message = 'Uang tidak cukup untuk ' + item.label + '.';
    G.audio.sfx('fail');
    return;
  }
  p.money -= item.price;
  if (item.id === 'smg' || item.id === 'shotgun') {
    p.owned[item.id] = true;
    p.ammo[item.id] = WEAPONS[item.id].ammo;
    p.weapon = item.id;
    G.shop.message = item.label + ' dibeli! Tekan ' + WEAPONS[item.id].slot + ' untuk memakai.';
  } else if (item.id === 'ammo') {
    p.ammo.pistol += 120;
    p.ammo.smg += 240;
    p.ammo.shotgun += 40;
    G.shop.message = 'Ammo box dibeli: semua senjata terisi.';
  } else if (item.id === 'armor') {
    p.armor = 100;
    G.shop.message = 'Kevlar vest dipakai. Armor 100.';
  }
  G.audio.sfx('pickup');
}

// Coba pakai safehouse (E): heal + save + perbaiki mobil. Return true bila kena.
export function tryUseSafehouse(G) {
  const p = G.player;
  for (const key of ['safehouse1', 'safehouse2']) {
    const s = PLACES[key];
    if (dist(p.x, p.y, s.x, s.y) < 95) {
      p.hp = 100;
      p.armor = Math.max(p.armor, 50);
      if (p.inCar) p.inCar.cond = 100;
      G.saveGame();
      G.dialog = { name: 'Deke Marlowe', role: 'Protagonis', text: 'Safehouse — ' + s.label + '. HP pulih, game tersimpan, mobil diperbaiki.', t: 0 };
      G.audio.sfx('save');
      return true;
    }
  }
  return false;
}

// Apakah pemain sedang dekat toko / safehouse (untuk prompt E di HUD)?
export function nearbyInteractable(G) {
  const p = G.player;
  if (dist(p.x, p.y, PLACES.gunShop.x, PLACES.gunShop.y) < 95) return 'Toko Senjata — tekan E';
  for (const key of ['safehouse1', 'safehouse2']) {
    if (dist(p.x, p.y, PLACES[key].x, PLACES[key].y) < 95) return 'Safehouse — tekan E (heal + save)';
  }
  return null;
}
