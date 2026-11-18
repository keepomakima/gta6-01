// NEON TIDE v5 — all 15 missions. Each mission is a small state machine:
// startMission sets the stage, updateMission advances it, completeMission
// pays out and moves on. Timers fail and restart their mission; combat
// missions are balanced to be winnable on foot (see ENEMY_DMG).
import { MISSIONS, ENEMY_HP, BOSS_HP, MISSION_TIMERS, SENTRY_RANGE, SENTRY_HALF_ANGLE, DETECT_RATE, DETECT_FALL } from './config.js';
import { LANDMARKS, SENTRY_POSTS } from './world.js';
import { makeEnemy } from './entities.js';
import { dist, angleDiff } from './random.js';
import { addWanted } from './police.js';

const near = (g, x, y, r) => dist(g.player.x, g.player.y, x, y) < r;

function say(g, name, text) {
  g.dialog = { name, text, t: 5 };
  g.popup(`${name}: ${text}`);
}

export function startMission(g, n) {
  const m = g.mission;
  m.idx = n; m.stage = 0; m.data = {}; m.target = null; m.done = false;
  const def = MISSIONS[n - 1];
  g.popup(`MISSION ${n}/15 — ${def.title}`);
  switch (n) {
    case 1:
      m.target = { ...LANDMARKS.club, label: 'Kestrel Club' };
      say(g, 'Madame Kestrel', 'Deke. You owe me $50,000. Walk to my club — now.');
      break;
    case 2:
      m.target = { ...LANDMARKS.garage, label: "Rosa's Garage" };
      say(g, 'Madame Kestrel', 'Steal a sport car. Bring it to Rosa\'s Garage.');
      break;
    case 3:
      m.data.timer = MISSION_TIMERS.m3;
      m.target = { ...LANDMARKS.harbor, label: 'Harbor Docks' };
      say(g, 'Madame Kestrel', 'Package to the Harbor. 120 seconds. Don\'t dawdle.');
      break;
    case 4:
      m.target = { x: 1200, y: 500, label: 'Lose the cops' };
      addWanted(g, 3, 'the heat is on');
      say(g, 'Rosa', 'Three stars, Deke. Break line of sight until it cools off.');
      break;
    case 5: {
      m.target = { ...LANDMARKS.gangCorner, label: '5th & Main' };
      // Gang holds the open plaza south of the corner — clear ground, no
      // building edges between the player and the shooters.
      const spots = [[950, 1030], [1070, 1050], [1000, 1100], [930, 1080]];
      g.enemies = spots.map(([x, y]) => makeEnemy(x, y, { hp: ENEMY_HP }));
      say(g, 'Madame Kestrel', 'Rival gang owns 5th & Main. Clear the corner.');
      break;
    }
    case 6:
      m.target = { ...LANDMARKS.stash, label: 'Stash House' };
      say(g, 'Rosa', 'Hit the stash house, then bring the take to my garage.');
      break;
    case 7: {
      m.data.followT = 0;
      m.data.target = { x: 1500, y: 500, tx: 1500, ty: 500, angle: 0 };
      m.data.wps = [[1500, 500], [1500, 1100], [900, 1100], [900, 500]];
      m.data.wp = 0;
      m.target = { x: 1500, y: 500, label: 'Tail the target' };
      say(g, 'Madame Kestrel', 'Follow him. Close enough to see, far enough to stay invisible.');
      break;
    }
    case 8:
      m.data.fares = [[1820, 420], [620, 820], [420, 1120]];
      m.data.fare = 0;
      m.target = { x: 1820, y: 420, label: 'Fare 1/3' };
      say(g, 'Rosa', 'Drive the taxi. Three fares. The meter is running.');
      break;
    case 9:
      m.data.timer = MISSION_TIMERS.m9;
      m.data.gates = [[2220, 220], [2220, 1420], [620, 1420]];
      m.data.gate = 0;
      m.target = { x: 2220, y: 220, label: 'Gate 1/3' };
      say(g, 'Rosa', 'Three gates, one winner. Go!');
      break;
    case 10:
      m.data.crates = [[1780, 1380], [1900, 1460], [1840, 1560]];
      m.data.crate = 0;
      m.target = { x: 1780, y: 1380, label: 'Crate 1/3' };
      say(g, 'Madame Kestrel', 'Three gear crates at the east docks. Collect them all.');
      break;
    case 11: {
      m.target = { ...LANDMARKS.vault, label: 'Rival Vault' };
      const spots = [[280, 1500], [380, 1520], [260, 1580], [400, 1580], [320, 1470]];
      g.enemies = spots.map(([x, y]) => makeEnemy(x, y, { hp: ENEMY_HP, guard: true }));
      say(g, 'Madame Kestrel', 'The vault. Five guards. Drop them, then run to the garage.');
      break;
    }
    case 12: {
      m.target = { ...LANDMARKS.bossYard, label: 'East Yard' };
      // Boss and guards hold open ground east of the sheds — nobody spawns
      // inside a building or exactly on top of the player's arrival point.
      const boss = makeEnemy(2340, 1260, { hp: BOSS_HP, boss: true });
      const guards = [[2340, 1240], [2300, 1340], [2380, 1360]].map(([x, y]) => makeEnemy(x, y, { hp: ENEMY_HP, guard: true }));
      g.enemies = [boss, ...guards];
      say(g, 'Boss Rook', 'So the rat came home. Boys — kill him.');
      break;
    }
    case 13:
      m.data.timer = MISSION_TIMERS.m13;
      m.data.stops = [[2015, 1120], [1200, 1500], [620, 300]];
      m.data.stop = 0;
      m.target = { x: 2015, y: 1120, label: 'Stop 1/3 — 90s' };
      say(g, 'Rosa', 'Midnight Run: three stops, ninety seconds. Drive like the tide.');
      break;
    case 14: {
      m.data.detection = 0;
      m.data.sentries = SENTRY_POSTS.map((s) => ({ ...s }));
      m.target = { ...LANDMARKS.pier, label: 'Pier Office' };
      say(g, 'Madame Kestrel', 'Silent Pier. Sentries watch the docks — stay out of their cones.');
      break;
    }
    case 15:
      m.target = { ...LANDMARKS.casino, label: 'Neon Mile Casino' };
      say(g, 'Madame Kestrel', 'The Neon Mile casino. Take the $4,000, then vanish to the Airfield.');
      break;
  }
}

export function completeMission(g) {
  const n = g.mission.idx;
  const def = MISSIONS[n - 1];
  g.money += def.reward;
  g.missionsDone = Math.max(g.missionsDone, n);
  g.popup(`MISSION COMPLETE — ${def.title} +$${def.reward}`);
  g.audio.fanfare();
  g.save();
  if (n >= 15) {
    // The finale pays once and stays done: free-roam after the ending
    // must not re-trigger the escape (and re-pay) on every airfield visit.
    g.mission.done = true;
    g.mode = 'complete';
    g.save();
    return;
  }
  startMission(g, n + 1);
}

export function failMission(g, why) {
  g.popup(`MISSION FAILED — ${why}. Try again.`);
  startMission(g, g.mission.idx);
}

function tickTimer(g, dt) {
  const m = g.mission;
  if (m.data.timer === undefined) return false;
  m.data.timer -= dt;
  if (m.data.timer <= 0) { failMission(g, 'time ran out'); return true; }
  return false;
}

export function updateMissions(g, dt) {
  if (g.mode !== 'play' || g.mission.done) return;
  const m = g.mission;
  const n = m.idx;
  switch (n) {
    case 1:
      if (near(g, LANDMARKS.club.x, LANDMARKS.club.y, 90)) completeMission(g);
      break;
    case 2:
      // Deliver the car: arrive at the garage and bring it to a stop.
      // (A fast drive-by down the road does not count as a delivery.)
      if (g.player.inCar && g.player.car && Math.abs(g.player.car.speed) < 120
        && near(g, LANDMARKS.garage.x, LANDMARKS.garage.y, 110)) completeMission(g);
      break;
    case 3:
      if (tickTimer(g, dt)) break;
      if (g.player.inCar && g.player.car && Math.abs(g.player.car.speed) < 120
        && near(g, LANDMARKS.harbor.x, LANDMARKS.harbor.y, 110)) completeMission(g);
      break;
    case 4:
      if (g.wanted <= 0) completeMission(g);
      break;
    case 5:
      if (g.enemies.length && g.enemies.every((e) => !e.alive)) completeMission(g);
      break;
    case 6:
      if (m.stage === 0 && near(g, LANDMARKS.stash.x, LANDMARKS.stash.y, 100)) {
        m.stage = 1;
        m.target = { ...LANDMARKS.garage, label: "Rosa's Garage" };
        g.money += 1500;
        addWanted(g, 2, 'the stash alarm');
        say(g, 'Rosa', 'Got it. Now bring it home — the alarm is up!');
      } else if (m.stage === 1 && near(g, LANDMARKS.garage.x, LANDMARKS.garage.y, 110)) {
        completeMission(g);
      }
      break;
    case 7: {
      const t = m.data.target;
      const wps = m.data.wps;
      const [wx, wy] = wps[m.data.wp];
      const d = dist(t.x, t.y, wx, wy);
      if (d < 20) m.data.wp = (m.data.wp + 1) % wps.length;
      else {
        const a = Math.atan2(wy - t.y, wx - t.x);
        t.angle = a;
        t.x += Math.cos(a) * 85 * dt;
        t.y += Math.sin(a) * 85 * dt;
      }
      m.target = { x: t.x, y: t.y, label: 'Tail the target' };
      const pd = dist(g.player.x, g.player.y, t.x, t.y);
      if (pd < 60) {
        m.data.followT = Math.max(0, m.data.followT - dt * 2);
        g.popup('TOO CLOSE — back off!');
      } else if (pd < 320) {
        m.data.followT += dt;
      }
      if (m.data.followT >= 25) completeMission(g);
      break;
    }
    case 8: {
      const fares = m.data.fares;
      const [fx, fy] = fares[m.data.fare];
      if (g.player.inCar && g.player.car && g.player.car.type === 'taxi' && near(g, fx, fy, 100)) {
        g.money += 400;
        g.popup(`Fare ${m.data.fare + 1}/3 — +$400`);
        m.data.fare++;
        if (m.data.fare >= fares.length) completeMission(g);
        else {
          const [nx, ny] = fares[m.data.fare];
          m.target = { x: nx, y: ny, label: `Fare ${m.data.fare + 1}/3` };
        }
      }
      break;
    }
    case 9: {
      if (tickTimer(g, dt)) break;
      const gates = m.data.gates;
      const [gx, gy] = gates[m.data.gate];
      if (g.player.inCar && near(g, gx, gy, 110)) {
        m.data.gate++;
        if (m.data.gate >= gates.length) completeMission(g);
        else {
          const [nx, ny] = gates[m.data.gate];
          m.target = { x: nx, y: ny, label: `Gate ${m.data.gate + 1}/3` };
        }
      }
      break;
    }
    case 10: {
      const crates = m.data.crates;
      const [cx, cy] = crates[m.data.crate];
      if (near(g, cx, cy, 90)) {
        m.data.crate++;
        g.popup(`Crate ${m.data.crate}/3 secured`);
        if (m.data.crate >= crates.length) completeMission(g);
        else {
          const [nx, ny] = crates[m.data.crate];
          m.target = { x: nx, y: ny, label: `Crate ${m.data.crate + 1}/3` };
        }
      }
      break;
    }
    case 11:
      if (m.stage === 0) {
        if (g.enemies.length && g.enemies.every((e) => !e.alive)) {
          m.stage = 1;
          m.target = { ...LANDMARKS.garage, label: "Escape — Rosa's Garage" };
          say(g, 'Rosa', 'Vault clear! Get to my garage, now!');
        }
      } else if (near(g, LANDMARKS.garage.x, LANDMARKS.garage.y, 110)) {
        completeMission(g);
      }
      break;
    case 12:
      if (g.enemies.length && g.enemies.every((e) => !e.alive)) completeMission(g);
      break;
    case 13: {
      if (tickTimer(g, dt)) break;
      const stops = m.data.stops;
      const [sx, sy] = stops[m.data.stop];
      if (near(g, sx, sy, 100)) {
        m.data.stop++;
        if (m.data.stop >= stops.length) completeMission(g);
        else {
          const [nx, ny] = stops[m.data.stop];
          m.target = { x: nx, y: ny, label: `Stop ${m.data.stop + 1}/3 — ${Math.ceil(m.data.timer)}s` };
        }
      }
      break;
    }
    case 14: {
      // Sentry vision cones: detection rises inside a cone, falls outside.
      let seen = false;
      for (const s of m.data.sentries) {
        const d = dist(g.player.x, g.player.y, s.x, s.y);
        if (d < SENTRY_RANGE) {
          const a = Math.atan2(g.player.y - s.y, g.player.x - s.x);
          if (Math.abs(angleDiff(s.angle, a)) < SENTRY_HALF_ANGLE) { seen = true; break; }
        }
      }
      if (seen) m.data.detection += DETECT_RATE * dt;
      else m.data.detection = Math.max(0, m.data.detection - DETECT_FALL * dt);
      if (m.data.detection >= 100) {
        m.data.detection = 60;
        addWanted(g, 2, 'spotted on the pier!');
        g.popup('SPOTTED — the alarm is up!');
      }
      if (near(g, LANDMARKS.pier.x, LANDMARKS.pier.y, 80)) completeMission(g);
      break;
    }
    case 15:
      if (m.stage === 0 && near(g, LANDMARKS.casino.x, LANDMARKS.casino.y, 90)) {
        m.stage = 1;
        g.money += 4000;
        g.wanted = 4;
        m.target = { ...LANDMARKS.airfield, label: 'Escape — Airfield' };
        say(g, 'Madame Kestrel', '$4,000 in hand. Four stars on you — fly to the Airfield!');
      } else if (m.stage === 1 && near(g, LANDMARKS.airfield.x, LANDMARKS.airfield.y, 110)) {
        g.missionsDone = 15;
        completeMission(g);
      }
      break;
  }
}
