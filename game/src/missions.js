// NEON TIDE missions: 8 sequential story jobs. A mission is a list of stages;
// each stage is one small objective (go somewhere, steal a car, deliver on a
// timer, lose the heat, clear enemies, hold a spot, tail a courier). The engine
// tracks the current stage, its timer and its progress, and pays on completion.
import { MISSIONS, PLACES, VEHICLES } from './config.js';
import { addHeat, makeCar, spawnEnemies, spawnPickup, wantedLevel } from './entities.js';

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

export function createMissions(G) {
  const M = {
    index: 0,            // 0-based into MISSIONS; 8 means the story is done
    stage: 0,
    timer: 0,            // seconds left on a timed stage (0 = no timer)
    holdT: 0,            // seconds held inside a hold marker
    killsAtStart: 0,
    followT: 0,          // seconds the tail has held
    followSeen: 0,       // seconds too close to the courier
    followLost: 0,       // seconds too far from the courier
    targetCar: null,
    dialogQueue: [],
    dialogT: 0,
    done: false,
    failed: null,
  };

  function current() { return MISSIONS[M.index]; }
  function stageDef() { return current() ? current().stages[M.stage] : null; }

  function startMission(i) {
    M.index = i;
    M.stage = 0;
    M.timer = 0;
    M.holdT = 0;
    M.killsAtStart = G.missionKills;
    M.followT = 0; M.followSeen = 0; M.followLost = 0;
    M.targetCar = null;
    M.failed = null;
    const m = current();
    if (!m) { M.done = true; return; }
    M.dialogQueue = m.dialog.map(([who, text]) => ({ who, text }));
    M.dialogT = 0;
    G.feed.push(`Mission ${m.id}: ${m.title} — ${m.brief}`);
    enterStage();
  }

  function enterStage() {
    const s = stageDef();
    if (!s) return;
    M.holdT = 0;
    M.timer = s.timer || 0;
    if (s.type === 'heat') {
      // Mission 4: the heat starts at 3 stars.
      G.player.heat = 120;
      G.feed.push('Wanted level 3 stars — lose the PSPD!');
    }
    if (s.type === 'kill') {
      M.killsAtStart = G.missionKills;
      const at = PLACES[s.area];
      spawnEnemies(G, at.x, at.y, s.count, s.count >= 6 ? 70 : 60);
    }
    if (s.type === 'follow') {
      const car = makeCar(G, 'sedan', PLACES.followStart.x, PLACES.followStart.y, 0, 'courier');
      car.axis = 'h'; car.road = PLACES.followStart.y; car.dir = 1;
      car.targetSpeed = 130; car.speed = 130;
      G.cars.push(car);
      M.targetCar = car;
      G.feed.push('The courier is moving — tail him, don\'t get spotted.');
    }
    if (s.type === 'driveTo' || s.type === 'deliver') {
      G.feed.push(stageText());
    }
  }

  function stageText() {
    const s = stageDef();
    if (!s) return '';
    if (s.type === 'kill') {
      const done = G.missionKills - M.killsAtStart;
      return s.text.replace(/\(\d+\/\d+\)/, `(${Math.min(done, s.count)}/${s.count})`);
    }
    return s.text;
  }

  function completeStage() {
    M.stage += 1;
    const m = current();
    if (M.stage >= m.stages.length) {
      completeMission();
      return;
    }
    G.audio.pickup();
    enterStage();
  }

  function completeMission() {
    const m = current();
    G.player.money += m.reward;
    G.earned += m.reward;
    G.debtPaid += m.reward;
    G.audio.fanfare();
    G.feed.push(`Mission complete: ${m.title} — +$${m.reward}. Debt left: $${Math.max(0, 50000 - G.debtPaid)}.`);
    spawnPickup(G, 'health', G.player.x + 40, G.player.y, 0);
    G.saveGame();
    M.index += 1;
    if (M.index >= MISSIONS.length) {
      M.done = true;
      G.storyDone = true;
      G.feed.push('STORY COMPLETE — the debt is paid. Port Solano is yours, Deke.');
      return;
    }
    startMission(M.index);
  }

  function failMission(reason) {
    if (M.failed) return; // already failing — the restart is scheduled
    M.failed = reason;
    G.audio.fail();
    G.feed.push(`Mission failed: ${reason}. Restarting the mission.`);
    // Reset the stage's side effects, then restart the same mission.
    for (const e of G.enemies) e.dead = true;
    if (M.targetCar) {
      G.cars = G.cars.filter((c) => c !== M.targetCar);
      M.targetCar = null;
    }
    G.player.heat = Math.min(G.player.heat, 59);
    setTimeout(() => { M.failed = null; startMission(M.index); }, 100);
  }

  function marker() {
    const s = stageDef();
    if (!s || !s.at) return null;
    const at = PLACES[s.at];
    return { x: at.x, y: at.y, label: at.label, radius: s.radius || 80 };
  }

  function objectiveText() {
    if (M.done) return 'Story complete — free roam Port Solano.';
    const m = current();
    let text = `M${m.id} ${m.title}: ${stageText()}`;
    if (M.timer > 0) text += ` — ${Math.ceil(M.timer)}s`;
    if (stageDef() && stageDef().type === 'hold' && M.holdT > 0) text += ` (${M.holdT.toFixed(1)}s)`;
    return text;
  }

  function update(dt) {
    // Dialog lines show one at a time for a few seconds each.
    if (M.dialogQueue.length > 0) {
      M.dialogT += dt;
      if (M.dialogT > 4.5) {
        M.dialogQueue.shift();
        M.dialogT = 0;
      }
    }
    if (M.done || !current() || M.failed) return;
    const s = stageDef();
    if (!s) return;
    const p = G.player;

    if (M.timer > 0) {
      M.timer -= dt;
      if (M.timer <= 0) { failMission('Out of time.'); return; }
    }

    const at = s.at ? PLACES[s.at] : null;
    const d = at ? dist(p.x, p.y, at.x, at.y) : Infinity;

    switch (s.type) {
      case 'goto':
      case 'deliver':
        if (d < (s.radius || 80)) completeStage();
        break;
      case 'steal':
        if (G.flags.stoleMissionCar) {
          G.flags.stoleMissionCar = false;
          completeStage();
        }
        break;
      case 'driveTo':
        if (d < (s.radius || 80) && p.car) completeStage();
        break;
      case 'heat':
        if (wantedLevel(p.heat) === 0) completeStage();
        break;
      case 'kill': {
        const done = G.missionKills - M.killsAtStart;
        if (done >= s.count) completeStage();
        break;
      }
      case 'hold':
        if (d < (s.radius || 70)) {
          M.holdT += dt;
          if (M.holdT >= (s.hold || 3)) completeStage();
        } else {
          M.holdT = Math.max(0, M.holdT - dt * 2);
        }
        break;
      case 'follow': {
        const car = M.targetCar;
        if (!car || car.hp <= 0) { failMission('The courier got away.'); return; }
        const cd = dist(p.x, p.y, car.x, car.y);
        if (cd < 70) {
          M.followSeen += dt;
          if (M.followSeen > 2) { failMission('Spotted — the courier made you.'); return; }
        } else {
          M.followSeen = Math.max(0, M.followSeen - dt);
        }
        if (cd > 460) {
          M.followLost += dt;
          if (M.followLost > 5) { failMission('You lost the courier.'); return; }
        } else {
          M.followLost = Math.max(0, M.followLost - dt);
        }
        if (cd >= 70 && cd <= 460) M.followT += dt;
        if (M.followT >= (s.duration || 45)) {
          G.cars = G.cars.filter((c) => c !== car);
          M.targetCar = null;
          completeStage();
        }
        break;
      }
      default:
        break;
    }
  }

  return {
    M, startMission, update, marker, objectiveText,
    get current() { return current(); },
    get stageDef() { return stageDef(); },
  };
}
