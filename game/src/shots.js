// Screenshot scenes behind ?shot=start|drive|chase|mission. Each one stages a
// real game state (title at dusk, night driving, a police chase, a harbor
// firefight), then runs the real simulation forward a fixed number of steps
// with a deterministic autopilot, so the frame is what playing looks like and
// the same seed always gives the same frame.
import { PLACES } from './config.js';
import { makeCar, spawnEnemies } from './entities.js';

const FRAMES = 300; // 5 seconds at 60 steps a second

// A loop of waypoints around downtown for the driving autopilot.
const DRIVE_LOOP = [
  { x: 640, y: 520 }, { x: 1440, y: 520 }, { x: 1440, y: 1120 },
  { x: 640, y: 1120 }, { x: 640, y: 520 },
];

function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

export function setupShot(G, name) {
  const p = G.player;
  G.shot = { name, frames: FRAMES, wp: 0 };
  if (name === 'start') {
    // Title screen over the city at dusk.
    G.clock = 18 * 60 + 30;
    p.x = PLACES.club.x;
    p.y = PLACES.club.y + 80;
    p.angle = 0;
    G.camera.x = p.x;
    G.camera.y = p.y;
    G.mode = 'title';
    return 'title';
  }
  if (name === 'drive') {
    // Night drive in the Vortex GT through downtown, wanted 2 stars.
    G.clock = 22 * 60;
    p.x = 640; p.y = 520;
    const car = makeCar(G, 'sport', 640, 520, 0, 'player');
    G.cars.push(car);
    p.car = car;
    p.heat = 60;
    G.camera.x = p.x; G.camera.y = p.y;
    G.mode = 'play';
    return 'play';
  }
  if (name === 'chase') {
    // Three-star chase: cruisers on the tail, a roadblock ahead, crash sparks.
    G.clock = 21 * 60 + 30;
    p.x = 1040; p.y = 820;
    const car = makeCar(G, 'sport', 1040, 820, 0, 'player');
    // Staged chase: the car is tough enough to survive five seconds of ramming.
    car.hp = 400;
    car.maxHp = 400;
    G.cars.push(car);
    p.car = car;
    p.heat = 130;
    for (let i = 0; i < 2; i += 1) {
      const cop = makeCar(G, 'cruiser', 1040 - 90 - i * 70, 820 + (i ? 26 : -26), 0, 'cop');
      cop.targetSpeed = 400;
      G.cars.push(cop);
      G.cops.push({ kind: 'cruiser', car: cop, x: cop.x, y: cop.y, angle: 0, hp: 140, bustT: 0, down: false });
    }
    G.particles.crash(1040 + 60, 820 - 30);
    G.camera.x = p.x; G.camera.y = p.y;
    G.mode = 'play';
    return 'play';
  }
  // mission: harbor firefight at golden hour, mission 8 in progress.
  G.clock = 16 * 60 + 40;
  p.x = PLACES.harbor.x;
  p.y = PLACES.harbor.y + 140;
  p.weapon = 'pistol';
  p.ammo = 96;
  G.missions.startMission(7);
  // Jump straight to the kill stage.
  G.missions.M.stage = 1;
  G.missions.M.killsAtStart = G.missionKills;
  spawnEnemies(G, PLACES.harbor.x, PLACES.harbor.y, 6, 70);
  G.camera.x = p.x; G.camera.y = p.y;
  G.mode = 'play';
  return 'play';
}

// Drive the car toward the next waypoint on the downtown loop, swerving around
// traffic directly ahead instead of ramming it.
function driveAutopilot(G, input) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const wp = DRIVE_LOOP[G.shot.wp % DRIVE_LOOP.length];
  const d = Math.hypot(wp.x - car.x, wp.y - car.y);
  if (d < 90) G.shot.wp += 1;
  let tx = wp.x;
  let ty = wp.y;
  // Is a car sitting in our lane ahead? Swerve to the side with more room.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let blocked = false;
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (ahead > 0 && ahead < 150 && side < 34) { blocked = true; break; }
  }
  if (blocked) {
    const side = (G.shot.frames % 120 < 60) ? 1 : -1;
    tx = car.x + fx * 160 - fy * 52 * side;
    ty = car.y + fy * 160 + fx * 52 * side;
  }
  const want = angleTo(car.x, car.y, tx, ty);
  let diff = ((want - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  input.held.up = true;
  input.held.left = diff < -0.08;
  input.held.right = diff > 0.08;
  input.held.down = false;
}

// On foot in the harbor: aim at the nearest living enemy and fire.
function combatAutopilot(G, input) {
  const p = G.player;
  let best = null;
  let bestD = Infinity;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) {
    p.angle = angleTo(p.x, p.y, best.x, best.y);
    if (G.shot.frames % 20 === 0) {
      // Simulate a mouse click at the enemy.
      G.shootAt = { x: best.x, y: best.y };
    }
  }
}

// One autopilot step. Returns true when the scene is ready to capture.
export function shotStep(G, input) {
  const shot = G.shot;
  if (!shot) return false;
  if (shot.name === 'drive' || shot.name === 'chase') driveAutopilot(G, input);
  else if (shot.name === 'mission') combatAutopilot(G, input);
  shot.frames -= 1;
  if (shot.frames <= 0) {
    window.__shotReady = true;
    return true;
  }
  return false;
}
