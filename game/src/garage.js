// NEON TIDE v5 — garage.js (BARU v5)
// Garasi Rosa: upgrade mobil (Engine / Grip Tires / Car Armor / NOS Kit,
// level 0..3) + isi ulang NOS + perbaiki mobil. Dibuka dengan E di dekat
// garasi (1420,820). Upgrade tersimpan di save (player.upgrades).
// Revisi v5.2: beli NOS mengisi tangki penuh; serviceCar (tombol S) gratis.
import { UPGRADES, PLACES } from './config.js';
import { dist } from './random.js';

export function makeGarage() {
  return { open: false, selected: 0, message: '', tab: 'upgrade' };
}

// Buka garasi bila pemain dekat Rosa's Garage (E). Return true bila terbuka.
export function tryOpenGarage(G) {
  const p = G.player;
  if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 110) {
    G.garage.open = true;
    G.garage.selected = 0;
    G.garage.message = "Rosa's Garage — upgrade mobilmu, Deke.";
    G.audio.sfx('shop');
    return true;
  }
  return false;
}

// Beli / naikkan level upgrade yang dipilih. NOS terisi penuh saat dibeli.
export function buyUpgrade(G) {
  const p = G.player;
  const keys = Object.keys(UPGRADES);
  const key = keys[G.garage.selected];
  const up = UPGRADES[key];
  const lvl = p.upgrades[key];
  if (lvl >= 3) {
    G.garage.message = up.name + ' sudah MAX level 3.';
    return;
  }
  const price = up.costs[lvl];
  if (p.money < price) {
    G.garage.message = 'Uang tidak cukup untuk ' + up.name + ' Lv' + (lvl + 1) + ' ($' + price + ').';
    G.audio.sfx('fail');
    return;
  }
  p.money -= price;
  p.upgrades[key] = lvl + 1;
  if (key === 'nos') {
    p.nosMax = up.cap[lvl + 1];
    p.nos = p.nosMax;
  }
  if (key === 'armor' && p.inCar) p.inCar.maxCond = Math.round(100 * up.mult[lvl + 1]);
  G.garage.message = up.name + ' naik ke Lv' + (lvl + 1) + '! ' + up.desc;
  G.audio.sfx('pickup');
  G.saveGame();
}

// Isi ulang NOS (gratis di garasi) + perbaiki mobil. Dipanggil dari menu garasi.
export function serviceCar(G) {
  const p = G.player;
  p.nos = p.nosMax;
  if (p.inCar) p.inCar.cond = 100;
  G.garage.message = 'NOS terisi penuh, mobil diperbaiki. Siap ngebut!';
  G.audio.sfx('save');
}

// Prompt E untuk garasi (dipakai HUD).
export function garagePrompt(G) {
  const p = G.player;
  if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 110) return "Rosa's Garage — tekan E (upgrade + NOS)";
  return null;
}
