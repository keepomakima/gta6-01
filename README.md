# Neon Tide — Golden Hour

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/keepomakima/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/keepomakima/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game set in Port Solano at golden hour, built for the
make.fun "Make GTA 6" bounty. You are Deke Marlowe, back in town and
$50,000 in debt to Madame Kestrel. The only way out is through her jobs —
eighteen of them, from a first car theft to a final showdown with Rook
Reborn.

The city is rendered in 3D (three.js, WebGL2) under a low western sun:
eight districts with lit windows, rooftop props, neon signs in Neon Mile,
palm-lined Beachfront, and a harbor that never really sleeps. Thirty-four
pedestrians walk the streets with their own routines, twenty traffic cars
share the roads, and the PSPD answers trouble with cruisers, roadblocks,
spike strips, PIT maneuvers, and the AIR-1 helicopter once your wanted
level climbs toward five stars.

## Playing

No build step and no install. From the repo root:

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome.

### Controls

| Input | Does |
|-------|------|
| WASD | Move on foot / drive |
| Mouse | Aim — click to shoot |
| E | Enter or exit a car |
| 1 / 2 / 3 | Switch weapon |
| Shift | NOS boost in a car, sprint on foot |
| Space | Handbrake |
| R | Change radio station |
| Esc | Pause |
| Enter | Start the next mission / advance a cutscene |

## The story in eighteen jobs

| # | Job | The work |
|---|-----|----------|
| 1 | Welcome Back | Walk to the Kestrel Club |
| 2 | Hot Wheels | Steal the Neon GT |
| 3 | Harbor Run | A delivery against the clock |
| 4 | Lose the Heat | Escape a 3-star wanted level |
| 5 | Street Fight | Clear the corner |
| 6 | Payback | Grab the stash, then get away |
| 7 | The Setup | Tail the courier |
| 8 | Dockside Score | Collect the crates |
| 9 | Harbor Brawl | Clear the docks |
| 10 | Neon Sprint | A checkpoint race |
| 11 | Vault Job | Get past the guards, take the cash, escape |
| 12 | VIP Ride | Drive the client to Beachfront |
| 13 | Midnight Run | Three stops in ninety seconds |
| 14 | Silent Pier | Stealth past sentries and vision cones |
| 15 | Neon Mile | Rob the casino, then run for the Airfield |
| 16 | Harbor Storm | Clear the docks in the storm |
| 17 | The Broker | Take down boss Vex |
| 18 | King of Port Solano | Boss Rook Reborn — vanish once the heat hits five stars |

## What else is in the city

- An intro cutscene, a briefing panel with character portraits before
  every mission, and a finale cutscene.
- A garage where cars can be upgraded, including NOS; the Tide Runner 900
  motorcycle; rain weather; a gun shop; two safehouses; three procedural
  radio stations; and saves that keep your progress.
- Heat Wave, an endless survival mode against escalating police pressure.

The four dossier frames are staged through `shots.json` — each entry
names the shot query the game loads in shot mode, so the screenshots can
be retaken exactly.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dy7a168m&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
