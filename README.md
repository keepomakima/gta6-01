# NEON TIDE — Open-World Crime in Port Solano

[![make.fun](https://make.fun/c/gta6-01/badge.svg)](https://make.fun/c/gta6-01)
[![gta6-01](https://make.fun/c/gta6-01/badge-entries.svg)](https://make.fun/c/gta6-01)
[![play](https://make.fun/c/gta6-01/badge-play.svg)](https://make.fun/c/gta6-01)

Entry untuk bounty **Make GTA 6** di [make.fun](https://make.fun/c/gta6-01) — game
open-world crime 2D top-down yang sepenuhnya orisinal: kota fiktif Port Solano,
bukan aset Rockstar.

## Cerita

Deke Marlowe pulang ke Port Solano dengan utang **$50.000** pada Madame Kestrel,
bos kriminal pelabuhan. Lunasi utang lewat 12 misi, rebut pelabuhan dari geng
rival Tide Rats, dan kalahkan Boss Rook di finale.

## Yang bisa dimainkan (v4)

- **Kota 2400×1600, 5 distrik** — Downtown, Harbor, Beachfront, Old Town, Suburbs
- **Jalan kaki + 5 tipe mobil** — sedan, taksi, sport, truk, cruiser polisi (E naik/turun, Space handbrake, kerusakan + asap)
- **Traffic + pejalan kaki AI** — mobil ikut jalan, pejalan kaki lari saat ada tembakan
- **Curi mobil** — sopir lari; wanted naik bila polisi melihat
- **Wanted 0–5 bintang** — foot cop, cruiser, roadblock (3★+), **helikopter AIR-1 dengan spotlight (4★+)**
- **12 misi berurutan** — dari Welcome Back sampai finale Tide Turns, dengan dialog, timer, dan reward
- **Combat** — tinju + pistol / SMG / shotgun (aim mouse), musuh menembak balik, drop uang/ammo/armor
- **Toko senjata Ironworks Arms** — beli SMG, shotgun, ammo, armor
- **2 safehouse** — heal, save, perbaiki mobil
- **HUD overhaul** — mission card + progress, panel police response, 4 slot senjata, bar HP/armor/respect, speedometer besar, minimap, dialog karakter berpotret
- **Siang/malam, radio WebAudio 3 station, partikel, bekas ban, SFX, save localStorage**

## Kontrol

WASD/arrows jalan & mengemudi · Shift lari · E naik mobil / interaksi · Space handbrake ·
Mouse aim · Klik tembak · 1–4 ganti senjata · R ganti radio · Esc pause

## Jalankan

```sh
node serve.ts
# buka http://localhost:8080
```

Game statis di bawah `game/`, tanpa build step, tanpa network request.

## Lisensi

MIT — lihat `LICENSE`.
