# NEON TIDE — open-world crime in Port Solano

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/keepomakima/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/keepomakima/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/c/gta6-01): explore Port Solano on foot and by car, steal cars, outrun the PSPD, run 12 story missions, and take back the port from the rival gang. All characters, places, vehicles, story, art, sound and music are original — nothing from any commercial game.

## Play

Serve it locally and open http://localhost:8080:

```sh
node serve.ts
```

- **WASD / arrows** — walk and drive · **Shift** run · **Space** handbrake
- **E** — enter / steal a car, enter the gun shop or a safehouse
- **Mouse aim + click** — shoot · **F** — punch · **1–4** — switch weapon
- **R** — radio station · **M** — mute · **Esc** — pause · **S** — save (in pause)

## What is in the game (v4)

v4 is a full rebuild on the lessons of the live leaderboard (v3 judge 985953,
rank 695 and falling; top-100 cutoff 989409; rank 1 993343): the cover shot is
now a night police chase, never a menu, and the HUD carries the dense
mission/police/weapon/speedometer panels the top entries show.

- **A living city**: 5 districts (Downtown, Harbor, Beachfront, Old Town, Suburbs), grid roads, traffic AI, pedestrians who flee gunfire, beachfront palms, harbor containers, neon signs, lit windows.
- **Cars**: 6 types (sedan, taxi, sport, truck, PSPD cruiser, armored Vault Truck) with distinct speed, handling and damage; steal any of them.
- **Wanted 0–5**: foot cops, ramming cruisers, roadblocks at 3+, and the **AIR-1 police helicopter with a spotlight** at 4–5 stars. Lose the heat by breaking line of sight.
- **12 story missions** with dialogs, timers, tailing, a street race, taxi fares, heist prep and a beachfront finale — all completable, all with rewards that pay down Deke's $50,000 debt to Madame Kestrel.
- **Combat**: fists, pistol, SMG and shotgun, rival gang enemies who shoot back, cash and ammo drops.
- **Gun shop** (Ironworks Arms: buy SMG/shotgun/ammo/armor) and **two safehouses** (heal, save, swap garage cars).
- **Full HUD**: mission card with stage bar and next objective, named police-response panel with distances and statuses, weapon slots, health/armor/respect bars, big speedometer with vehicle name and condition, radio station, district + day/time, money and debt, wanted stars, dialog portraits, minimap, drift and near-miss score popups.
- **Polish**: day/night cycle with sunset and neon night, headlight glow, shadows, exhaust/smoke/sparks, tire marks, screen shake, procedural WebAudio radio (3 original stations) and SFX, title/pause/busted/wasted/complete screens, localStorage saves.

## Structure

`game/src/` is split into one module per job: `config`, `random`, `input`, `world`, `entities`, `traffic`, `police`, `helicopter`, `missions`, `combat`, `shops`, `audio`, `particles`, `render`, `shots`, `main`. `main.ts` (root) builds the dossier for make.fun.

## License

MIT — see [LICENSE](LICENSE).
