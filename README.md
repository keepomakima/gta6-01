# Neon Tide — Golden Hour

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/keepomakima/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/keepomakima/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in 3D, set in the coastal city of Port Solano at golden hour. You are Deke Marlowe, a driver who owes $50,000 to Madame Kestrel — and the whole city is the board you play on to pay it back.

Built with three.js (WebGL2) and a third-person chase camera. The city spans 8 districts: windowed facades, rooftop props, palm trees, billboards, working traffic lights, pedestrians with a walk cycle, and dense, varied traffic with headlights. Any car on the street can be stolen and driven.

## Play

```bash
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

| Key | Action |
| --- | --- |
| WASD | Move on foot / drive |
| E | Enter or exit a car |
| Mouse + click | Aim and shoot |
| 1 / 2 / 3 | Switch weapon |
| Shift | Sprint on foot / NOS while driving |
| Space | Handbrake |
| R | Change radio station |
| Esc | Pause |
| Enter | Start the next mission / advance a cutscene |

## The story

Eighteen story missions follow Deke's climb out of debt. Each mission opens with a briefing cutscene and ends with a payoff that chips away at the $50,000 he owes Madame Kestrel. Cutscenes — intro, briefings, and the finale — are staged with character portraits.

| # | Mission |
| --- | --- |
| 1 | Welcome Back |
| 2 | Hot Wheels |
| 3 | Harbor Run |
| 4 | Lose the Heat |
| 5 | Street Fight |
| 6 | Payback |
| 7 | The Setup |
| 8 | Dockside Score |
| 9 | Harbor Brawl |
| 10 | Neon Sprint |
| 11 | Vault Job |
| 12 | VIP Ride |
| 13 | Midnight Run |
| 14 | Silent Pier |
| 15 | Neon Mile |
| 16 | Harbor Storm |
| 17 | The Broker |
| 18 | King of Port Solano |

## Systems

- **Wanted level 0–5 stars.** The PSPD responds with cruisers, roadblocks, spike strips, PIT maneuvers, and the police helicopter AIR-1 at high heat.
- **Driving.** Steal any car, outrun the law, and use NOS for a burst of speed. The Tide Runner 900 motorcycle is available for fast getaways.
- **Garage upgrades.** Spend mission earnings on upgrades, including NOS.
- **Combat.** Three weapons, switchable with 1/2/3, plus a weapon shop to stock up.
- **Weather.** Golden-hour sun, and rain that changes how the city looks and feels.
- **Safehouses.** Two safehouses across the city.
- **Radio.** Three procedural radio stations, switchable with R.
- **Save.** Progress is saved between sessions.
- **Heat Wave.** An endless mode for chasing high scores once the story is done.

## Screenshots

Staged shots are listed in `shots.json` (seed 20261123): a five-star golden-hour chase with heli AIR-1, Neon Mile at night, the beachfront at golden hour, and the pier cutscene with Madame Kestrel.

---

Built for the make.fun gta6-01 bounty — [make.fun](https://make.fun/bounty/gta6-01?ref=dy7a168m).
