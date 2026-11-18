// NEON TIDE v5 — deterministic screenshot scenes. Each scene builds a
// fixed game state from the URL (?shot=<scene>&seed=20261118), lets the
// main loop run a few frames, then sets window.__shotReady. No randomness
// leaks in: the seed drives every choice here.
import { makeRng, range } from './random.js';
import { makeCar } from './entities.js';
import { makeEnemy } from './entities.js';
import { LANDMARKS } from './world.js';
import { startMission } from './missions.js';
import { setRain } from './weather.js';

export const SHOT_SCENES = ['rainchase', 'casino', 'airport', 'stealth'];

export function setupShot(g, scene, seed) {
  const rng = makeRng(seed || 20261118);
  g.shotMode = scene;
  g.mode = 'play';
  g.clock = 21.5; // night, neon on
  g.day = 1;
  if (scene === 'rainchase') {
    // Cover: heavy rain, 5 stars, AIR-1 spotlight, spike strip, roadblock,
    // NOS Lv2, Mission 15 escape in progress.
    g.upgrades = { engine: 2, grip: 2, armor: 2, nos: 2 };
    g.nosMax = 100; g.nos = 62;
    g.money = 12840;
    setRain(g.weather, 0.9);
    startMission(g, 15);
    g.mission.stage = 1;
    g.mission.target = { ...LANDMARKS.airfield, label: 'Escape — Airfield' };
    g.wanted = 5;
    const car = makeCar('sport', 1200, 800, 0, false);
    car.speed = 420;
    g.cars.push(car);
    g.player.x = 1200; g.player.y = 800;
    g.enterCar(car);
    g.heli.active = true; g.heli.x = 1150; g.heli.y = 700; g.heli.spotOn = true;
    g.spikes.push({ x: 1420, y: 800, angle: 0, t: 14 });
    g.spikeSeen = true;
    g.roadblocks.push({ x: 1560, y: 800, angle: Math.PI / 2, t: 12 });
    g.cops.push({ x: 1080, y: 760, speed: 265, hp: 50, fireT: 2 });
    g.cruisers.push(Object.assign(makeCar('cruiser', 1050, 840, 0, false), { pitT: 0 }));
    g.cruisers.push(Object.assign(makeCar('cruiser', 1380, 760, Math.PI, false), { pitT: 0 }));
    g.dialog = { name: 'Madame Kestrel', text: '$4,000 in hand. Four stars on you — fly to the Airfield!', t: 5 };
  } else if (scene === 'casino') {
    // The Tide Runner 900 outside the Neon Mile casinos, wanted 4, light rain.
    g.upgrades = { engine: 1, grip: 1, armor: 1, nos: 1 };
    g.nosMax = 100; g.nos = 100;
    g.money = 9400;
    setRain(g.weather, 0.35);
    startMission(g, 15);
    g.wanted = 4;
    const bike = makeCar('bike', 1200, 1440, -Math.PI / 2, false);
    bike.speed = 120;
    g.cars.push(bike);
    g.player.x = 1200; g.player.y = 1440;
    g.enterCar(bike);
    g.heli.active = true; g.heli.x = 1250; g.heli.y = 1350; g.heli.spotOn = true;
    g.cops.push({ x: 1120, y: 1400, speed: 265, hp: 50, fireT: 2 });
    g.dialog = { name: 'Deke Marlowe', text: 'Neon Mile. Three casinos, one score.', t: 5 };
  } else if (scene === 'airport') {
    // Sport car flat out on Runway 27, NOS Lv3, Mission 13 timer running.
    g.upgrades = { engine: 3, grip: 2, armor: 2, nos: 3 };
    g.nosMax = 100; g.nos = 88;
    g.money = 15200;
    setRain(g.weather, 0);
    g.clock = 18.5; // sunset over the runway
    startMission(g, 13);
    g.mission.data.timer = 47;
    g.mission.data.stop = 1;
    g.mission.target = { x: 1200, y: 1500, label: 'Stop 2/3 — 47s' };
    const car = makeCar('sport', 2050, 1000, 0, false);
    car.speed = 520;
    g.cars.push(car);
    g.player.x = 2050; g.player.y = 1000;
    g.enterCar(car);
    g.wanted = 2;
    g.cruisers.push(Object.assign(makeCar('cruiser', 1900, 1000, 0, false), { pitT: 0 }));
  } else if (scene === 'stealth') {
    // On foot at the pier: sentry cones sweeping, detection meter live.
    g.upgrades = { engine: 0, grip: 0, armor: 0, nos: 0 };
    g.money = 6100;
    setRain(g.weather, 0.15);
    g.clock = 20.0;
    startMission(g, 14);
    g.mission.data.detection = 38;
    g.player.x = 520; g.player.y = 1420;
    g.player.hp = 100;
    g.wanted = 0;
    g.dialog = { name: 'Madame Kestrel', text: 'Silent Pier. Stay out of the cones.', t: 5 };
  }
  // A few ambient cars and pedestrians so every shot feels alive.
  for (let i = 0; i < 4; i++) {
    const t = ['sedan', 'taxi', 'sport', 'truck'][i % 4];
    const c = makeCar(t, 900 + range(rng, -300, 600), 500 + range(rng, -200, 600), range(rng, 0, Math.PI * 2), true);
    g.cars.push(c);
  }
  g.cam.x = Math.max(0, Math.min(2400 - 1280, g.player.x - 640));
  g.cam.y = Math.max(0, Math.min(1600 - 720, g.player.y - 360));
}
