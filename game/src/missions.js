// NEON TIDE v7-coverfix — missions.js (structural pass)
// The 18 story missions. Every start shows a spoken briefing line
// (cutscene.js) with a character portrait; the finale plays the Rook
// cutscene when the game is won.
import { makeCrate, makeEnemy, makeMarker } from './entities.js';
import { addWanted } from './police.js';
import { FINALE_SCENES, missionBriefing, startCutscene } from './cutscene.js';

export const MISSIONS = [
  { reward: 500, name:'Welcome Back', brief:'Walk to Kestrel Club and meet Madame Kestrel.',
    steps:[{ label:'Kestrel Club', type:'go', x: 0, z: 100 }] },
  { reward: 1200, name:'Hot Wheels', brief:'Steal the Neon GT and bring it to Rosa\'s Garage.',
    steps:[
      { label:'Steal the Neon GT', type:'steal', carType:'sport' },
      { label:"Rosa's Garage", type:'drive', x: 400, z: 200 },
    ] },
  { reward: 2000, name:'Harbor Run', brief:'Drive the package to the Harbor Docks before the timer runs out.',
    steps:[{ label:'Harbor Docks', type:'drive', x: -800, z: 300, timer: 90 }] },
  { reward: 1500, name:'Lose the Heat', brief:'You are wanted 3 stars. Break line of sight and lose the cops.',
    steps:[{ label:'Lose the cops', type:'escape', wanted: 0, setWanted: 3 }] },
  { reward: 2500, name:'Street Fight', brief:'Clear the rival gang off the corner at Old Town.',
    steps:[{ label:'Clear the corner', type:'kill', n: 4, at:{ x: -200, z: 300 } }] },
  { reward: 3000, name:'Payback', brief:'Grab the rival stash, then drive it to the drop.',
    steps:[
      { label:'Grab the stash', type:'collect', n: 2, at:[{ x: 200, z: -200 }, { x: 200, z: 0 }] },
      { label:'Drop point', type:'drive', x: 0, z: -400 },
    ] },
  { reward: 2500, name:'The Setup', brief:'Tail the courier without being spotted. Stay close, stay quiet.',
    steps:[{ label:'Tail the courier', type:'tail', target:{ x: -600, z: 0 }, path:[[-600, 0], [-600, 400], [-200, 400], [-200, 0]], need: 15, grace: 20 }] },
  { reward: 3500, name:'Dockside Score', brief:'Collect three crates from the Harbor Docks.',
    steps:[{ label:'Collect the crates', type:'collect', n: 3, at:[{ x: -800, z: 300 }, { x: -800, z: 100 }, { x: -800, z: 500 }] }] },
  { reward: 3000, name:'Harbor Brawl', brief:'Five rivals hold the west docks. Take them out.',
    steps:[{ label:'Clear the docks', type:'kill', n: 5, at:{ x: -1000, z: 300 } }] },
  { reward: 2500, name:'Neon Sprint', brief:'Race the checkpoints across town before the timer runs out.',
    steps:[{ label:'Race the gates', type:'race', gates:[[0, 0], [400, 0], [400, 400], [-400, 400]], timer: 75 }] },
  { reward: 5000, name:'Vault Job', brief:'Take out the vault guards, grab the cash, drive it home.',
    steps:[
      { label:'Vault guards', type:'kill', n: 5, at:{ x: 800, z: 300 } },
      { label:'Grab the cash', type:'collect', n: 1, at:[{ x: 800, z: 300 }] },
      { label:'Getaway', type:'drive', x: 0, z: 0 },
    ] },
  { reward: 3000, name:'VIP Ride', brief:'Drive the client to Beachfront. No scratches, no cops.',
    steps:[{ label:'Beachfront drop', type:'drive', x: 1000, z: 300, timer: 80 }] },
  { reward: 4000, name:'Midnight Run', brief:'Getaway chain: three stops, 90 seconds, no stopping.',
    steps:[{ label:'Midnight Run', type:'race', gates:[[600, -600], [-600, -600], [0, 600]], timer: 90 }] },
  { reward: 3500, name:'Silent Pier', brief:'Slip past the sentries on the pier. Stay out of their vision cones.',
    steps:[{ label:'Reach the end of the pier', type:'stealth', x: -1050, z: 700 }] },
  { reward: 4000, name:'Neon Mile', brief:'Hit the TIDE Casino for $4,000, then lose the 4-star heat at the Airfield.',
    steps:[
      { label:'Grab the casino cash', type:'collect', n: 1, at:[{ x: 200, z: 400 }] },
      { label:'Escape to the Airfield', type:'drive', x: 800, z: -600, setWanted: 4 },
    ] },
  { reward: 5000, name:'Harbor Storm', brief:'A storm hit the harbor and the rivals moved in. Clear six of them.',
    steps:[{ label:'Clear the storm docks', type:'kill', n: 6, at:{ x: -800, z: -300 }, rain: 0.8 }] },
  { reward: 6000, name:'The Broker', brief:'Vex, the Broker, runs the east docks. End him.',
    steps:[{ label:'Take down Vex', type:'boss', name:'Vex', hp: 260, at:{ x: 0, z: 600 }, guards: 2 }] },
  { reward: 8000, name:'King of Port Solano', brief:'Rook Reborn holds the Neon Mile with four guards. End it, then vanish at 5 stars.',
    steps:[
      { label:'Take down Rook Reborn', type:'boss', name:'Rook Reborn', hp: 320, at:{ x: 400, z: 600 }, guards: 4 },
      { label:'Vanish downtown', type:'drive', x: 0, z: 0, setWanted: 5 },
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
  const ms = S.missions;
  S.enemies = [];
  ms.index = i;
  ms.step = 0;
  ms.mode = 'playing';
  ms.failed = false;
  ms.frozen = false;
  ms.detection = 0;
  ms.tailTime = 0;
  ms.tailGrace = 0;
  ms.crates = [];
  ms.gates = [];
  ms.gateIndex = 0;
  ms.target = null;
  ms.boss = null;
  setupStep(S);
  // A spoken briefing line with the character portrait, plus the plain
  // mission line the HUD dialog already showed.
  missionBriefing(S, i);
  if (!S.dialog) S.dialog = { text: `${MISSIONS[i].name}: ${MISSIONS[i].brief}`, until: S.time + 6 };
}

// One setup routine per step type that needs one; the rest just get a
// marker at the step's x/z (or no marker at all for 'steal').
const STEP_SETUP = {
  kill: (S, ms, st) => {
    ms.killsAtStart = S.killsTotal;
    const at = st.at;
    S.enemies = S.enemies.filter((e) => e.kind !== 'gang');
    let i = 0;
    while (i < st.n) {
      S.enemies.push(makeEnemy(at.x + (i % 3) * 14 - 14, at.z + Math.floor(i / 3) * 14, { hp: 60 }));
      i += 1;
    }
    ms.marker = makeMarker(at.x, at.z, st.label);
  },
  collect: (S, ms, st) => {
    ms.crates = [];
    st.at.forEach((p) => { ms.crates.push(makeCrate(p.x, p.z)); });
    ms.marker = makeMarker(st.at[0].x, st.at[0].z, st.label);
  },
  race: (S, ms, st) => {
    ms.gates = [...st.gates];
    ms.gateIndex = 0;
    ms.marker = makeMarker(ms.gates[0][0], ms.gates[0][1], st.label);
  },
  tail: (S, ms, st) => {
    ms.tailTime = 0;
    ms.tailGrace = st.grace ?? 20;
    ms.target = { x: st.target.x, z: st.target.z, path: st.path, leg: 0, speed: 26 };
    ms.marker = makeMarker(st.target.x, st.target.z, st.label);
  },
  stealth: (S, ms, st) => {
    ms.detection = 0;
    S.enemies = S.enemies.filter((e) => e.kind !== 'sentry');
    const sentries = [[-1020, 660, 0.6], [-1000, 690, -0.4], [-1040, 720, 1.2]];
    sentries.forEach(([x, z, dir]) => {
      S.enemies.push(makeEnemy(x, z, { kind: 'sentry', hp: 60, coneDir: dir, dmg: 4 }));
    });
    ms.marker = makeMarker(st.x, st.z, st.label);
  },
  boss: (S, ms, st) => {
    ms.killsAtStart = S.killsTotal;
    const b = makeEnemy(st.at.x, st.at.z, { kind: 'boss', hp: st.hp, name: st.name, dmg: 10, shootEvery: 1.1, speed: 30 });
    ms.boss = b;
    S.enemies.push(b);
    let i = 0;
    while (i < (st.guards || 0)) {
      S.enemies.push(makeEnemy(st.at.x + 20 + i * 12, st.at.z + 18, { hp: 60 }));
      i += 1;
    }
    ms.marker = makeMarker(st.at.x, st.at.z, st.label);
  },
};

function setupStep(S) {
  const ms = S.missions;
  const def = MISSIONS[ms.index];
  const st = def.steps[ms.step];
  ms.marker = null;
  if (!st) return;
  if (st.setWanted) addWanted(S, st.setWanted - S.wanted);
  if (st.timer) ms.timer = st.timer;
  if (st.rain !== undefined) S.weather.rain = st.rain;
  if (st.type in STEP_SETUP) STEP_SETUP[st.type](S, ms, st);
  else if (st.x !== undefined) ms.marker = makeMarker(st.x, st.z, st.label);
}

export function completeStep(S) {
  const ms = S.missions;
  ms.failed = false;
  const def = MISSIONS[ms.index];
  ms.step += 1;
  if (ms.step >= def.steps.length) {
    completeMission(S);
  } else {
    ms.mode = 'playing';
    setupStep(S);
  }
}

export function completeMission(S) {
  const ms = S.missions;
  const def = MISSIONS[ms.index];
  S.player.money += def.reward;
  S.player.ammo.pistol += 60;
  if (S.player.ammo.smg !== undefined) S.player.ammo.smg += 60;
  S.debt = Math.max(0, S.debt - def.reward);
  S.completedCount += 1;
  ms.completedCount += 1;
  ms.mode = 'complete';
  S.dialog = { until: S.time + 6, text: `${def.name} complete! +$${def.reward} — debt left $${S.debt.toLocaleString()}` };
  S.saveSoon = true;
  if (ms.index + 1 >= MISSIONS.length) {
    ms.mode = 'won';
    S.ui.screen = 'won';
    S.dialog = { until: S.time + 10, text: 'King of Port Solano — you own the city. Debt paid.' };
    // Finale: Rook's last words, then Kestrel hands Deke the city.
    startCutscene(S, FINALE_SCENES);
  }
}

export function failMission(S, why) {
  const ms = S.missions;
  if (ms.mode !== 'playing') return;
  ms.mode = 'failed';
  ms.failed = true;
  S.dialog = { until: S.time + 8, text: `Mission failed: ${why}. Press Enter to retry.` };
}

function near(S, x, z, r) {
  const ax = S.player.x - x, az = S.player.z - z;
  return Math.hypot(ax, az) < r;
}

// One checker per step type. Each returns after advancing the mission
// (or failing it); the tail and stealth checkers keep running state.
const STEP_CHECKS = {
  go: (S, st) => { if (near(S, st.x, st.z, 14)) completeStep(S); },
  drive: (S, st) => { if (near(S, st.x, st.z, 16)) completeStep(S); },
  steal: (S, st) => {
    const car = S.player.car;
    if (!car) return;
    if (st.carType && car.type !== st.carType) return;
    completeStep(S);
  },
  kill: (S, st) => {
    if (S.killsTotal - S.missions.killsAtStart >= st.n) completeStep(S);
  },
  collect: (S, st) => {
    S.missions.crates.forEach((crate) => {
      if (!crate.taken && near(S, crate.x, crate.z, 12)) { crate.taken = true; S.player.money += 150; }
    });
    if (S.missions.crates.every((crate) => crate.taken)) completeStep(S);
  },
  tail: (S, st, dt) => {
    const ms = S.missions;
    const t = ms.target;
    if (!t) return;
    const l = t.path[t.leg];
    const ax = l[0] - t.x, az = l[1] - t.z;
    const dist = Math.hypot(ax, az);
    if (dist < 4) t.leg = Math.min(t.leg + 1, t.path.length - 1);
    else { t.x += (ax / dist) * t.speed * dt; t.z += (az / dist) * t.speed * dt; }
    const gap = Math.hypot(S.player.x - t.x, S.player.z - t.z);
    ms.marker = makeMarker(t.x, t.z, st.label);
    if (ms.tailGrace > 0) { ms.tailGrace -= dt; return; }
    if (gap < 90) {
      ms.tailTime += dt;
      if (ms.tailTime >= st.need) completeStep(S);
    } else if (gap > 140) {
      failMission(S, 'You lost the courier');
    }
  },
  escape: (S, st) => {
    if (S.wanted <= (st.wanted ?? 0)) completeStep(S);
  },
  race: (S, st) => {
    const ms = S.missions;
    if (ms.gateIndex < ms.gates.length && near(S, ms.gates[ms.gateIndex][0], ms.gates[ms.gateIndex][1], 16)) {
      ms.gateIndex += 1;
      if (ms.gateIndex >= ms.gates.length) completeStep(S);
      else ms.marker = makeMarker(ms.gates[ms.gateIndex][0], ms.gates[ms.gateIndex][1], st.label);
    }
  },
  stealth: (S, st, dt) => {
    const ms = S.missions;
    let spotted = false;
    S.enemies.forEach((foe) => {
      if (foe.kind !== 'sentry') return;
      const ax = S.player.x - foe.x, az = S.player.z - foe.z;
      const dist = Math.hypot(ax, az);
      if (dist < foe.coneLen) {
        const ang = Math.atan2(ax, az);
        let gap = Math.abs(ang - foe.coneDir);
        gap = gap > Math.PI ? Math.PI * 2 - gap : gap;
        if (gap < foe.coneHalf) spotted = true;
      }
    });
    ms.detection += (spotted ? 9 : -6) * dt;
    if (ms.detection < 0) ms.detection = 0;
    if (ms.detection > 100) ms.detection = 100;
    if (ms.detection >= 100) { failMission(S, 'Spotted on the pier'); return; }
    if (near(S, st.x, st.z, 14)) completeStep(S);
  },
  boss: (S) => {
    if (S.missions.boss && S.missions.boss.hp <= 0) completeStep(S);
  },
  heist: (S, st) => { if (near(S, st.x, st.z, 14)) completeStep(S); },
};

export function updateMissions(S, dt) {
  const ms = S.missions;
  if (ms.frozen || ms.mode !== 'playing') return;
  const def = MISSIONS[ms.index];
  if (!def) return;
  const st = def.steps[ms.step];
  if (!st) return;
  if (st.timer) {
    ms.timer -= dt;
    if (ms.timer <= 0) { failMission(S, 'Out of time'); return; }
  }
  if (st.type in STEP_CHECKS) STEP_CHECKS[st.type](S, st, dt);
}

export function updateHeatWave(S, dt) {
  const hw = S.heatwave;
  if (!hw.active) return;
  hw.elapsed += dt;
  hw.score = Math.floor(hw.elapsed) + 25 * hw.takedowns;
  if (S.time - hw.lastStarAt > 15) {
    if (S.wanted < 5) {
      hw.lastStarAt = S.time;
      addWanted(S, 1);
    }
  }
  if (S.player.health <= 0) {
    hw.active = false;
    S.dialog = { until: S.time + 8, text: `Heat Wave over — survived ${Math.floor(hw.elapsed)}s, score ${hw.score}` };
  }
}
