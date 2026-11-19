// NEON TIDE v7 "Golden Hour" — missions.js
// v7: every mission start shows a spoken briefing line (cutscene.js) with a
// character portrait; the finale plays the Rook cutscene when the game is won.
import { makeEnemy, makeCrate, makeMarker } from './entities.js';
import { addWanted } from './police.js';
import { missionBriefing, startCutscene, FINALE_SCENES } from './cutscene.js';

export const MISSIONS = [
  { name: 'Welcome Back', brief: 'Walk to Kestrel Club and meet Madame Kestrel.', reward: 500,
    steps: [{ type: 'go', x: 0, z: 100, label: 'Kestrel Club' }] },
  { name: 'Hot Wheels', brief: 'Steal the Neon GT and bring it to Rosa\'s Garage.', reward: 1200,
    steps: [
      { type: 'steal', carType: 'sport', label: 'Steal the Neon GT' },
      { type: 'drive', x: 400, z: 200, label: "Rosa's Garage" },
    ] },
  { name: 'Harbor Run', brief: 'Drive the package to the Harbor Docks before the timer runs out.', reward: 2000,
    steps: [{ type: 'drive', x: -800, z: 300, label: 'Harbor Docks', timer: 90 }] },
  { name: 'Lose the Heat', brief: 'You are wanted 3 stars. Break line of sight and lose the cops.', reward: 1500,
    steps: [{ type: 'escape', wanted: 0, label: 'Lose the cops', setWanted: 3 }] },
  { name: 'Street Fight', brief: 'Clear the rival gang off the corner at Old Town.', reward: 2500,
    steps: [{ type: 'kill', n: 4, at: { x: -200, z: 300 }, label: 'Clear the corner' }] },
  { name: 'Payback', brief: 'Grab the rival stash, then drive it to the drop.', reward: 3000,
    steps: [
      { type: 'collect', n: 2, at: [{ x: 200, z: -200 }, { x: 200, z: 0 }], label: 'Grab the stash' },
      { type: 'drive', x: 0, z: -400, label: 'Drop point' },
    ] },
  { name: 'The Setup', brief: 'Tail the courier without being spotted. Stay close, stay quiet.', reward: 2500,
    steps: [{ type: 'tail', target: { x: -600, z: 0 }, path: [[-600, 0], [-600, 400], [-200, 400], [-200, 0]], need: 15, grace: 20, label: 'Tail the courier' }] },
  { name: 'Dockside Score', brief: 'Collect three crates from the Harbor Docks.', reward: 3500,
    steps: [{ type: 'collect', n: 3, at: [{ x: -800, z: 300 }, { x: -800, z: 100 }, { x: -800, z: 500 }], label: 'Collect the crates' }] },
  { name: 'Harbor Brawl', brief: 'Five rivals hold the west docks. Take them out.', reward: 3000,
    steps: [{ type: 'kill', n: 5, at: { x: -1000, z: 300 }, label: 'Clear the docks' }] },
  { name: 'Neon Sprint', brief: 'Race the checkpoints across town before the timer runs out.', reward: 2500,
    steps: [{ type: 'race', gates: [[0, 0], [400, 0], [400, 400], [-400, 400]], timer: 75, label: 'Race the gates' }] },
  { name: 'Vault Job', brief: 'Take out the vault guards, grab the cash, drive it home.', reward: 5000,
    steps: [
      { type: 'kill', n: 5, at: { x: 800, z: 300 }, label: 'Vault guards' },
      { type: 'collect', n: 1, at: [{ x: 800, z: 300 }], label: 'Grab the cash' },
      { type: 'drive', x: 0, z: 0, label: 'Getaway' },
    ] },
  { name: 'VIP Ride', brief: 'Drive the client to Beachfront. No scratches, no cops.', reward: 3000,
    steps: [{ type: 'drive', x: 1000, z: 300, label: 'Beachfront drop', timer: 80 }] },
  { name: 'Midnight Run', brief: 'Getaway chain: three stops, 90 seconds, no stopping.', reward: 4000,
    steps: [{ type: 'race', gates: [[600, -600], [-600, -600], [0, 600]], timer: 90, label: 'Midnight Run' }] },
  { name: 'Silent Pier', brief: 'Slip past the sentries on the pier. Stay out of their vision cones.', reward: 3500,
    steps: [{ type: 'stealth', x: -1050, z: 700, label: 'Reach the end of the pier' }] },
  { name: 'Neon Mile', brief: 'Hit the TIDE Casino for $4,000, then lose the 4-star heat at the Airfield.', reward: 4000,
    steps: [
      { type: 'collect', n: 1, at: [{ x: 200, z: 400 }], label: 'Grab the casino cash' },
      { type: 'drive', x: 800, z: -600, label: 'Escape to the Airfield', setWanted: 4 },
    ] },
  { name: 'Harbor Storm', brief: 'A storm hit the harbor and the rivals moved in. Clear six of them.', reward: 5000,
    steps: [{ type: 'kill', n: 6, at: { x: -800, z: -300 }, label: 'Clear the storm docks', rain: 0.8 }] },
  { name: 'The Broker', brief: 'Vex, the Broker, runs the east docks. End him.', reward: 6000,
    steps: [{ type: 'boss', name: 'Vex', hp: 260, at: { x: 0, z: 600 }, guards: 2, label: 'Take down Vex' }] },
  { name: 'King of Port Solano', brief: 'Rook Reborn holds the Neon Mile with four guards. End it, then vanish at 5 stars.', reward: 8000,
    steps: [
      { type: 'boss', name: 'Rook Reborn', hp: 320, at: { x: 400, z: 600 }, guards: 4, label: 'Take down Rook Reborn' },
      { type: 'drive', x: 0, z: 0, label: 'Vanish downtown', setWanted: 5 },
    ] },
];

export function createMissions() {
  return {
    index: -1, step: 0, mode: 'idle', // idle | playing | complete | failed | won
    failed: false, frozen: false,
    timer: 0, killsAtStart: 0, tailTime: 0, tailGrace: 0,
    detection: 0, crates: [], gates: [], gateIndex: 0,
    target: null, boss: null, marker: null, dialog: null,
    completedCount: 0,
  };
}

export function startMission(S, i) {
  const M = S.missions;
  S.enemies = [];
  M.index = i; M.step = 0; M.mode = 'playing';
  M.failed = false; M.frozen = false;
  M.detection = 0; M.tailTime = 0; M.tailGrace = 0;
  M.crates = []; M.gates = []; M.gateIndex = 0;
  M.target = null; M.boss = null;
  setupStep(S);
  // v7: a spoken briefing line with the character portrait, plus the plain
  // mission line the HUD dialog already showed.
  missionBriefing(S, i);
  if (!S.dialog) S.dialog = { text: `${MISSIONS[i].name}: ${MISSIONS[i].brief}`, until: S.time + 6 };
}

function setupStep(S) {
  const M = S.missions;
  const def = MISSIONS[M.index];
  const step = def.steps[M.step];
  M.marker = null;
  if (!step) return;
  if (step.setWanted) addWanted(S, step.setWanted - S.wanted);
  if (step.timer) M.timer = step.timer;
  if (step.rain !== undefined) S.weather.rain = step.rain;
  if (step.type === 'kill') {
    M.killsAtStart = S.killsTotal;
    const base = step.at;
    S.enemies = S.enemies.filter((e) => e.kind !== 'gang');
    for (let k = 0; k < step.n; k++) {
      S.enemies.push(makeEnemy(base.x + (k % 3) * 14 - 14, base.z + Math.floor(k / 3) * 14, { hp: 60 }));
    }
    M.marker = makeMarker(base.x, base.z, step.label);
  } else if (step.type === 'collect') {
    M.crates = step.at.map((p) => makeCrate(p.x, p.z));
    M.marker = makeMarker(step.at[0].x, step.at[0].z, step.label);
  } else if (step.type === 'race') {
    M.gates = step.gates.slice();
    M.gateIndex = 0;
    M.marker = makeMarker(M.gates[0][0], M.gates[0][1], step.label);
  } else if (step.type === 'tail') {
    M.tailTime = 0; M.tailGrace = step.grace ?? 20;
    M.target = { x: step.target.x, z: step.target.z, path: step.path, leg: 0, speed: 26 };
    M.marker = makeMarker(step.target.x, step.target.z, step.label);
  } else if (step.type === 'stealth') {
    M.detection = 0;
    S.enemies = S.enemies.filter((e) => e.kind !== 'sentry');
    const spots = [[-1020, 660, 0.6], [-1000, 690, -0.4], [-1040, 720, 1.2]];
    for (const [x, z, dir] of spots) {
      S.enemies.push(makeEnemy(x, z, { kind: 'sentry', hp: 60, coneDir: dir, dmg: 4 }));
    }
    M.marker = makeMarker(step.x, step.z, step.label);
  } else if (step.type === 'boss') {
    M.killsAtStart = S.killsTotal;
    const boss = makeEnemy(step.at.x, step.at.z, { kind: 'boss', hp: step.hp, name: step.name, dmg: 10, shootEvery: 1.1, speed: 30 });
    M.boss = boss;
    S.enemies.push(boss);
    for (let k = 0; k < (step.guards || 0); k++) {
      S.enemies.push(makeEnemy(step.at.x + 20 + k * 12, step.at.z + 18, { hp: 60 }));
    }
    M.marker = makeMarker(step.at.x, step.at.z, step.label);
  } else if (step.x !== undefined) {
    M.marker = makeMarker(step.x, step.z, step.label);
  }
}

export function completeStep(S) {
  const M = S.missions;
  M.failed = false;
  const def = MISSIONS[M.index];
  M.step += 1;
  if (M.step >= def.steps.length) {
    completeMission(S);
  } else {
    M.mode = 'playing';
    setupStep(S);
  }
}

export function completeMission(S) {
  const M = S.missions;
  const def = MISSIONS[M.index];
  S.player.money += def.reward;
  S.player.ammo.pistol += 60;
  if (S.player.ammo.smg !== undefined) S.player.ammo.smg += 60;
  S.debt = Math.max(0, S.debt - def.reward);
  S.completedCount += 1;
  M.completedCount += 1;
  M.mode = 'complete';
  S.dialog = { text: `${def.name} complete! +$${def.reward} — debt left $${S.debt.toLocaleString()}`, until: S.time + 6 };
  S.saveSoon = true;
  if (M.index >= MISSIONS.length - 1) {
    M.mode = 'won';
    S.ui.screen = 'won';
    S.dialog = { text: 'King of Port Solano — you own the city. Debt paid.', until: S.time + 10 };
    // v7 finale: Rook's last words, then Kestrel hands Deke the city.
    startCutscene(S, FINALE_SCENES);
  }
}

export function failMission(S, why) {
  const M = S.missions;
  if (M.mode !== 'playing') return;
  M.mode = 'failed';
  M.failed = true;
  S.dialog = { text: `Mission failed: ${why}. Press Enter to retry.`, until: S.time + 8 };
}

function near(S, x, z, r) {
  const dx = S.player.x - x, dz = S.player.z - z;
  return dx * dx + dz * dz < r * r;
}

export function updateMissions(S, dt) {
  const M = S.missions;
  if (M.frozen || M.mode !== 'playing') return;
  const def = MISSIONS[M.index];
  if (!def) return;
  const step = def.steps[M.step];
  if (!step) return;
  if (step.timer) {
    M.timer -= dt;
    if (M.timer <= 0) { failMission(S, 'Out of time'); return; }
  }
  switch (step.type) {
    case 'go':
      if (near(S, step.x, step.z, 14)) completeStep(S);
      break;
    case 'drive':
      if (near(S, step.x, step.z, 16)) completeStep(S);
      break;
    case 'steal': {
      const car = S.player.car;
      if (car && (step.carType ? car.type === step.carType : true)) completeStep(S);
      break;
    }
    case 'kill':
      if (S.killsTotal - M.killsAtStart >= step.n) completeStep(S);
      break;
    case 'collect': {
      for (const c of M.crates) {
        if (!c.taken && near(S, c.x, c.z, 12)) { c.taken = true; S.player.money += 150; }
      }
      if (M.crates.every((c) => c.taken)) completeStep(S);
      break;
    }
    case 'tail': {
      const T = M.target;
      if (T) {
        const leg = T.path[T.leg];
        const dx = leg[0] - T.x, dz = leg[1] - T.z;
        const d = Math.hypot(dx, dz);
        if (d < 4) T.leg = Math.min(T.leg + 1, T.path.length - 1);
        else { T.x += (dx / d) * T.speed * dt; T.z += (dz / d) * T.speed * dt; }
        const pd = Math.hypot(S.player.x - T.x, S.player.z - T.z);
        M.marker = makeMarker(T.x, T.z, step.label);
        if (M.tailGrace > 0) { M.tailGrace -= dt; break; }
        if (pd < 90) {
          M.tailTime += dt;
          if (M.tailTime >= step.need) completeStep(S);
        } else if (pd > 140) {
          failMission(S, 'You lost the courier');
        }
      }
      break;
    }
    case 'escape':
      if (S.wanted <= (step.wanted ?? 0)) completeStep(S);
      break;
    case 'race': {
      const g = M.gates[M.gateIndex];
      if (g && near(S, g[0], g[1], 16)) {
        M.gateIndex += 1;
        if (M.gateIndex >= M.gates.length) completeStep(S);
        else M.marker = makeMarker(M.gates[M.gateIndex][0], M.gates[M.gateIndex][1], step.label);
      }
      break;
    }
    case 'stealth': {
      let seen = false;
      for (const e of S.enemies) {
        if (e.kind !== 'sentry') continue;
        const dx = S.player.x - e.x, dz = S.player.z - e.z;
        const d = Math.hypot(dx, dz);
        if (d < e.coneLen) {
          const ang = Math.atan2(dx, dz);
          let diff = Math.abs(ang - e.coneDir);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < e.coneHalf) seen = true;
        }
      }
      M.detection = Math.max(0, Math.min(100, M.detection + (seen ? 9 : -6) * dt));
      if (M.detection >= 100) { failMission(S, 'Spotted on the pier'); return; }
      if (near(S, step.x, step.z, 14)) completeStep(S);
      break;
    }
    case 'boss':
      if (M.boss && M.boss.hp <= 0) completeStep(S);
      break;
    case 'heist':
      if (near(S, step.x, step.z, 14)) completeStep(S);
      break;
    default:
      break;
  }
}

export function updateHeatWave(S, dt) {
  const H = S.heatwave;
  if (!H.active) return;
  H.elapsed += dt;
  H.score = Math.floor(H.elapsed) + 25 * H.takedowns;
  if (S.time - H.lastStarAt > 15 && S.wanted < 5) {
    H.lastStarAt = S.time;
    addWanted(S, 1);
  }
  if (S.player.health <= 0) {
    H.active = false;
    S.dialog = { text: `Heat Wave over — survived ${Math.floor(H.elapsed)}s, score ${H.score}`, until: S.time + 8 };
  }
}
