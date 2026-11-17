# NEON TIDE — an open-world crime story in Port Solano

[![Make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/keepomakima/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/keepomakima/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An entry for [make.fun's "Make GTA 6" bounty](https://make.fun/c/gta6-01): a complete
open-world crime game that runs in a desktop browser from static files, with no
network requests.

Deke Marlowe is back in Port Solano and owes Madame Kestrel $50,000. The city is
the only way out: steal cars, outrun the PSPD, run eight story missions, and take
the harbor back from the Tidebreakers.

## Screenshots

Four screenshots taken from the game itself, in `screenshots/` — the title
screen over Port Solano at dusk, night driving in the Vortex GT, a four-star
police chase, and the harbor heist finale.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

- **Move** WASD / arrows, **run** Shift
- **E** enter / exit a car, **Space** handbrake
- **Mouse** aim, **click** shoot, **F** punch, **1/2** switch weapon, **R** radio station
- **Esc / P** pause (progress saves after every mission)

## What is in the game

- A city to explore on foot and by car: Downtown, Old Town, Harbor, Beachfront and Suburbs, with a day/night cycle
- 5 vehicle types (sedan, taxi, sport, truck, PSPD cruiser) with different handling, damage and smoke
- Traffic and pedestrians with AI; pedestrians flee gunfire and crashes
- Car theft: parked cars are free, occupied ones lose their driver — the police notice
- Wanted level 0–5 stars with foot police, pursuing cruisers and roadblocks at 3+ stars; Busted and Wasted respawns
- 8 sequential story missions with dialogue, timers, a tailing job and a harbor heist finale
- Combat: fists and a pistol, gang members who shoot back, health / armor / ammo pickups
- HUD with health, money, debt tracker, wanted stars, weapon, clock and a live minimap
- Title screen, pause, localStorage saves, procedural WebAudio sound effects and three original radio stations
- Particles: exhaust, muzzle flash, crash sparks, skid marks; screen shake; headlights at night

Everything is original: the city, characters, vehicles, story, art and music are
all made for this game. No assets from Rockstar Games or any other commercial title.
