// NEON TIDE v6 — deterministic shot autopilot. ?shot=<name>&seed=1 builds a
// fixed scene (seeded RNG, fixed clock/rain/wanted), poses the chase camera
// and, after a few rendered frames, raises window.__shotReady. The four
// shots cover the cover chase, the casino, the airfield and the stealth pier.
export const SHOTS = {
  rainchase: { label: 'Night rain chase — wanted 5, heli AIR-1, spike strip' },
  casino: { label: 'Neon Mile casino — Tide Runner 900, wanted 4' },
  airfield: { label: 'Runway 27 — sport with NOS Lv3, Midnight Run timer' },
  stealth: { label: 'Silent Pier — on foot inside a sentry vision cone' },
};

export function applyShot(game, name) {
  const g = game;
  g.startNewGame();
  if (name === 'rainchase') {
    g.weather.timeOfDay = 21.5;
    g.weather.rainAuto = false; g.weather.setRain(0.9);
    g.giveCar('sport');
    g.state.upgrades.nos = 2; g.garage.applyToCar(g.player.car);
    g.player.car.nos = g.player.car.nosMax;
    g.teleport(0, 100);
    g.player.car.heading = Math.PI; // facing north up the avenue
    g.setWanted(5);
    g.missions.startMission(14); // M15 Neon Mile escape leg
    g.police.update(0.1, g.time);
    g.police.update(0.1, g.time);
    // Stage the chase in frame: the car faces -Z (heading PI), so "ahead"
    // is decreasing z. Heli 65 ahead with its spotlight, a spike strip
    // 50 ahead and a roadblock 90 ahead, cruisers behind.
    if (g.police.heli) {
      g.police.holdHeli = true;
      const h = g.police.heli;
      h.x = 0; h.z = 20; h.y = 28; // 80 ahead, low enough to stay in frame
      h.group.position.set(h.x, h.y, h.z);
      h.group.rotation.y = Math.PI;
    }
    g.police._spawnSpike(0, 50, 0);
    g.police._spawnRoadblock(0, 10, 0);
    return { camDist: 13, camHeight: 6 };
  }
  if (name === 'casino') {
    g.weather.timeOfDay = 20.5;
    g.weather.rainAuto = false; g.weather.setRain(0.35);
    g.giveCar('bike');
    g.teleport(200, 220); // on the Neon Mile road, clear lane to the pylons
    g.player.car.heading = -0.32; // facing the (160,340) pylon, 126 ahead
    g.setWanted(4);
    g.missions.startMission(14);
    return { camDist: 14, camHeight: 6 };
  }
  if (name === 'airfield') {
    g.weather.timeOfDay = 17.0;
    g.weather.rainAuto = false; g.weather.setRain(0);
    g.giveCar('sport');
    g.state.upgrades.nos = 3; g.garage.applyToCar(g.player.car);
    g.player.car.nos = g.player.car.nosMax;
    g.teleport(-980, -550); // west end of Runway 27, plane ahead-right
    g.player.car.heading = Math.PI / 2;
    g.missions.startMission(12); // M13 Midnight Run
    g.setWanted(2);
    return { camDist: 16, camHeight: 6.5 };
  }
  if (name === 'stealth') {
    g.weather.timeOfDay = 23.0;
    g.weather.rainAuto = false; g.weather.setRain(0.15);
    g.teleport(-952, 678); // 12 from sentry 3, inside its cone, both in frame
    g.player.heading = 0.17; // facing the sentry
    g.missions.startMission(13); // M14 Silent Pier
    g.missions.update(0.1);
    g.missions.detection = 35;
    g.missions.frozen = true; // hold the frame: no fail, no detection creep
    return { camDist: 11, camHeight: 5.5 };
  }
  return { camDist: 15, camHeight: 7 };
}
