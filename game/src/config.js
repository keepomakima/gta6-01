// NEON TIDE — config.js
// Semua konstanta dunia Port Solano: ukuran kota, jalan, distrik, kendaraan,
// senjata, toko, dan definisi 12 misi. Satu sumber kebenaran untuk modul lain.
// Revisi: DEBT_TOTAL dipakai HUD untuk sisa utang; PLACES dijamin di jalan.
export const WORLD_W = 2400;
export const WORLD_H = 1600;
export const ROAD_HALF = 45;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const SAVE_KEY = 'neon-tide-v4-save';
export const DEBT_TOTAL = 50000;

// Jalan vertikal dan horizontal (sumbu tengah). Blok kota ada di antaranya.
export const ROADS_V = [320, 620, 920, 1220, 1520, 1820, 2120];
export const ROADS_H = [220, 420, 620, 820, 1020, 1220, 1420];

// Lima distrik Port Solano, dipakai HUD (nama distrik) dan warna tanah.
export const DISTRICTS = [
  { name: 'Downtown', x0: 920, y0: 175, x1: 1865, y1: 865, ground: '#3a3348' },
  { name: 'Harbor', x0: 0, y0: 1375, x1: 2400, y1: 1600, ground: '#33302e' },
  { name: 'Beachfront', x0: 2075, y0: 0, x1: 2400, y1: 1600, ground: '#c2a878' },
  { name: 'Old Town', x0: 575, y0: 865, x1: 1220, y1: 1375, ground: '#4a3f35' },
  { name: 'Suburbs', x0: 0, y0: 0, x1: 2400, y1: 1600, ground: '#37452f' },
];

// Lima tipe mobil: kecepatan, akselerasi, handling, warna, ukuran.
export const CAR_TYPES = {
  sedan:   { label: 'Solano Sedan',  top: 380, accel: 260, turn: 2.6, len: 46, wid: 22, color: '#7fa8c9', hp: 100 },
  taxi:    { label: 'Harbor Taxi',   top: 360, accel: 250, turn: 2.7, len: 46, wid: 22, color: '#f2c230', hp: 100 },
  sport:   { label: 'Vortex GT',     top: 540, accel: 420, turn: 3.4, len: 48, wid: 22, color: '#ff2e88', hp: 90 },
  truck:   { label: 'Dock Hauler',   top: 300, accel: 180, turn: 2.0, len: 58, wid: 26, color: '#8a7f6a', hp: 160 },
  cruiser: { label: 'PSPD Cruiser',  top: 470, accel: 360, turn: 3.1, len: 48, wid: 22, color: '#1c2733', hp: 120 },
};

// Empat senjata: slot 1 tinju, 2 pistol, 3 SMG, 4 shotgun.
export const WEAPONS = {
  fists:   { slot: 1, label: 'Fists',    dmg: 12, rate: 2.2, range: 42,  auto: false, ammo: Infinity },
  pistol:  { slot: 2, label: 'P9 Pistol', dmg: 20, rate: 5.0, range: 430, auto: false, ammo: 120 },
  smg:     { slot: 3, label: 'VK-9 SMG',  dmg: 12, rate: 10.0, range: 380, auto: true,  ammo: 240 },
  shotgun: { slot: 4, label: 'Riot 12',   dmg: 9,  rate: 1.3, range: 300, auto: false, ammo: 40, pellets: 6 },
};

// Barang toko senjata Ironworks Arms.
export const SHOP_ITEMS = [
  { id: 'smg',     label: 'VK-9 SMG',        price: 1200, desc: 'Full-auto, 10 tembakan/detik' },
  { id: 'shotgun', label: 'Riot 12 Shotgun', price: 900,  desc: '6 peluru sekali tembak, jarak dekat' },
  { id: 'ammo',    label: 'Ammo Box',        price: 250,  desc: '+120 peluru pistol / +240 SMG' },
  { id: 'armor',   label: 'Kevlar Vest',     price: 600,  desc: 'Armor penuh 100' },
];

// Titik-titik penting di peta (semua di jalan / area terbuka, bukan gedung).
export const PLACES = {
  spawn:        { x: 620, y: 700, label: 'Deke\u2019s Apartment' },
  club:         { x: 620, y: 300, label: 'Kestrel Club' },
  garage:       { x: 1420, y: 820, label: 'Rosa\u2019s Garage' },
  harborDrop:   { x: 420, y: 1420, label: 'Harbor Pier 9' },
  stashHouse:   { x: 1820, y: 1220, label: 'Rival Stash House' },
  rivalCorner:  { x: 1000, y: 1000, label: 'Rival Corner' },
  tailStart:    { x: 920, y: 620, label: 'Tail Start' },
  taxiStand:    { x: 620, y: 820, label: 'Taxi Stand' },
  fareA:        { x: 1820, y: 420, label: 'Fare A — Marina' },
  fareB:        { x: 620, y: 820, label: 'Fare B — Taxi Stand' },
  fareC:        { x: 420, y: 1120, label: 'Fare C — Palm Court' },
  raceGates:    [{ x: 2220, y: 220 }, { x: 2220, y: 1420 }, { x: 620, y: 1420 }],
  crateSpots:   [{ x: 1780, y: 1380 }, { x: 1900, y: 1460 }, { x: 1840, y: 1560 }],
  vault:        { x: 320, y: 1560, label: 'Harbor Vault' },
  bossArena:    { x: 2380, y: 1300, label: 'Rook\u2019s Beach House' },
  gunShop:      { x: 1150, y: 640, label: 'Ironworks Arms' },
  safehouse1:   { x: 420, y: 420, label: 'Safehouse — Palm Court' },
  safehouse2:   { x: 2220, y: 620, label: 'Safehouse — Beachfront' },
  policeStation:{ x: 620, y: 900, label: 'PSPD Central' },
  hospital:     { x: 1520, y: 220, label: 'Solano General' },
};

// Daftar 12 misi berurutan: judul, pemberi, dan hadiah dolar.
export const MISSION_DEFS = [
  { id: 1,  title: 'Welcome Back',    giver: 'Madame Kestrel', reward: 500,  brief: 'Jalan kaki ke Kestrel Club. Kestrel menunggumu.' },
  { id: 2,  title: 'Hot Wheels',      giver: 'Rosa',           reward: 800,  brief: 'Curi mobil sport dan antar ke garasi Rosa.' },
  { id: 3,  title: 'Harbor Run',      giver: 'Madame Kestrel', reward: 1200, brief: 'Antar paket ke Pier 9 sebelum timer habis.' },
  { id: 4,  title: 'Lose the Heat',   giver: 'Deke',           reward: 1000, brief: 'Hilangkan wanted 3 bintang. Kabur dari pandangan polisi.' },
  { id: 5,  title: 'Street Fight',    giver: 'Rosa',           reward: 1500, brief: 'Bersihkan Rival Corner dari geng Tide Rats.' },
  { id: 6,  title: 'Payback',         giver: 'Madame Kestrel', reward: 2000, brief: 'Rampok stash house rival, lalu kabur ke garasi.' },
  { id: 7,  title: 'The Setup',       giver: 'Kestrel',        reward: 1800, brief: 'Ikuti target tanpa ketahuan. Jangan terlalu dekat.' },
  { id: 8,  title: 'Side Hustle',     giver: 'Rosa',           reward: 1400, brief: 'Jadi sopir taksi: antar 3 penumpang.' },
  { id: 9,  title: 'Street Race',     giver: 'Vex',            reward: 2200, brief: 'Balapan liar: lewati 3 gate secepatnya.' },
  { id: 10, title: 'Heist Prep',      giver: 'Madame Kestrel', reward: 1600, brief: 'Kumpulkan 3 crate peralatan di pelabuhan.' },
  { id: 11, title: 'The Big One',     giver: 'Madame Kestrel', reward: 5000, brief: 'Heist pelabuhan: lumpuhkan penjaga vault, kabur ke garasi.' },
  { id: 12, title: 'Tide Turns',      giver: 'Deke',           reward: 8000, brief: 'Finale: kalahkan Boss Rook di beach house-nya.' },
];

// Warna palet sunset / neon Port Solano.
export const PALETTE = {
  skyDay: '#f2a65a', skyDusk: '#e2607a', skyNight: '#141126',
  road: '#2b2b33', roadLine: '#c9c25a', sidewalk: '#55505e',
  neonPink: '#ff2e88', neonCyan: '#22e6ff', neonGold: '#ffc233',
};
