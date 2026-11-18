// NEON TIDE v4 — missions: 12 sequential story missions, from Welcome Back
// to the beachfront finale. One job: objectives, timers, dialogs, rewards.
// Every mission must be completable in a real playthrough.
import { PLACES } from './config.js';
import { spawnGang } from './combat.js';
import { addWanted } from './police.js';

export const MISSIONS = [
  { id: 1, title: 'Welcome Back', giver: 'Madame Kestrel', reward: 500, brief: 'Walk to the Kestrel Club in Old Town.' },
  { id: 2, title: 'Hot Wheels', giver: 'Madame Kestrel', reward: 1200, brief: 'Steal a car and deliver it to the Vex Garage.' },
  { id: 3, title: 'Harbor Run', giver: 'Vex', reward: 1500, brief: 'Deliver the package to Harbor Dock 7 before the timer runs out.' },
  { id: 4, title: 'Lose the Heat', giver: 'Vex', reward: 1000, brief: 'The cops are on you. Lose the 3-star wanted level.' },
  { id: 5, title: 'Street Fight', giver: 'Madame Kestrel', reward: 1800, brief: 'Clear the rival gang off the corner.' },
  { id: 6, title: 'Payback', giver: 'Madame Kestrel', reward: 2500, brief: 'Rob the rival stash house, then get the cash to the garage.' },
  { id: 7, title: 'The Setup', giver: 'Vex', reward: 2000, brief: 'Tail the target for 25 seconds. Do not get spotted.' },
  { id: 8, title: 'Side Hustle', giver: 'Dottie', reward: 1600, brief: 'Drive the cab: pick up 2 fares and drop them off.' },
  { id: 9, title: 'Street Race', giver: 'Rook', reward: 3000, brief: 'Beat Rook through 3 checkpoints along the beachfront.' },
  { id: 10, title: 'Heist Prep', giver: 'Vex', reward: 2200, brief: 'Collect 3 gear crates from the Gear Yard.' },
  { id: 11, title: 'The Big One', giver: 'Madame Kestrel', reward: 6000, brief: 'Hit the Port Vault, fight through the guards, escape with the take.' },
  { id: 12, title: 'Tide Turns', giver: 'Madame Kestrel', reward: 10000, brief: 'Finish the rival boss at Pier 9 and take back the port.' },
];

export function missionMeta(id) { return MISSIONS.find((m) => m.id === id) || null; }

export function setDialog(G, name, role, text, color) {
  G.dialog = { name, role, text, color: color || '#e63946', t: 6 };
}

export function startMission(G, id) {
  const meta = missionMeta(id);
  if (!meta) return;
  G.mission = { id, stage: 0, t: 0, data: {} };
  G.missionsDone = id - 1;
  setDialog(G, meta.giver, 'CONTACT', `${meta.title}: ${meta.brief}`, '#ffd166');
  G.audio.sfx('mission');
  setupMission(G);
}

function setupMission(G) {
  const m = G.mission;
  const p = G.player;
  if (m.id === 1) { G.marker = { x: PLACES.kestrelClub.x, y: PLACES.kestrelClub.y, label: 'Kestrel Club' }; }
  else if (m.id === 2) { G.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Vex Garage' }; }
  else if (m.id === 3) { m.data.timer = 60; G.marker = { x: PLACES.harborDock.x, y: PLACES.harborDock.y, label: 'Harbor Dock 7' }; }
  else if (m.id === 4) { addWanted(G, 3); G.marker = null; setDialog(G, 'Vex', 'FIXER', 'Lose them! Stay out of sight until the stars drop.', '#39c6ff'); }
  else if (m.id === 5) {
    spawnGang(G, PLACES.rivalCorner.x, PLACES.rivalCorner.y, 3);
    G.marker = { x: PLACES.rivalCorner.x, y: PLACES.rivalCorner.y, label: 'Rival Corner' };
  } else if (m.id === 6) { G.marker = { x: PLACES.stashHouse.x, y: PLACES.stashHouse.y, label: 'Stash House' }; }
  else if (m.id === 7) {
    const t = { x: PLACES.tailStart.x, y: PLACES.tailStart.y, angle: 0, speed: 70, wp: 0 };
    G.mission.data.target = t;
    G.mission.data.followT = 0;
    G.mission.data.waypoints = [
      { x: 1020, y: 1020 }, { x: 1420, y: 1020 }, { x: 1420, y: 620 }, { x: 1020, y: 620 },
    ];
    G.marker = { x: t.x, y: t.y, label: 'Target' };
  } else if (m.id === 8) {
    m.data.fares = 0;
    m.data.picked = false;
    m.data.drops = [{ x: 1820, y: 420, label: 'Fare 1' }, { x: 420, y: 1120, label: 'Fare 2' }];
    G.marker = { x: PLACES.cabStand.x, y: PLACES.cabStand.y, label: 'Cab Stand' };
    setDialog(G, 'Dottie', 'DISPATCH', 'Grab the cab at the stand, then run two fares. Tips are good tonight.', '#7dff8a');
  } else if (m.id === 9) {
    m.data.gate = 0;
    m.data.timer = 90;
    m.data.gates = [
      { x: 2220, y: 220, label: 'Gate 1' },
      { x: 2220, y: 1420, label: 'Gate 2' },
      { x: 620, y: 1420, label: 'Gate 3' },
    ];
    const rival = spawnGang(G, PLACES.raceStart.x + 60, PLACES.raceStart.y, 0);
    void rival;
    G.marker = { x: m.data.gates[0].x, y: m.data.gates[0].y, label: 'Gate 1' };
    setDialog(G, 'Rook', 'RACER', 'Three gates, beachfront to harbor. Loser buys the drinks, Deke.', '#ff7ad9');
  } else if (m.id === 10) {
    m.data.crates = [
      { x: 1780, y: 1380, got: false }, { x: 1900, y: 1460, got: false }, { x: 1840, y: 1560, got: false },
    ];
    G.marker = { x: 1840, y: 1460, label: 'Gear Yard' };
  } else if (m.id === 11) {
    spawnGang(G, PLACES.heistVault.x, PLACES.heistVault.y, 4, { hp: 70 });
    G.marker = { x: PLACES.heistVault.x, y: PLACES.heistVault.y, label: 'Port Vault' };
    setDialog(G, 'Madame Kestrel', 'BOSS', 'The vault, Deke. In and out. The whole port is watching.', '#ffd166');
  } else if (m.id === 12) {
    const boss = spawnGang(G, PLACES.beachShowdown.x, PLACES.beachShowdown.y, 1, { hp: 260, name: 'Boss Rook', dropCash: 2000 });
    void boss;
    spawnGang(G, PLACES.beachShowdown.x, PLACES.beachShowdown.y, 4, { hp: 60 });
    G.marker = { x: PLACES.beachShowdown.x, y: PLACES.beachShowdown.y, label: 'Pier 9' };
    addWanted(G, 2);
    setDialog(G, 'Boss Rook', 'RIVAL BOSS', 'This port was never yours, Marlowe. Come and take it.', '#e63946');
  }
  void p;
}

export function completeMission(G) {
  const m = G.mission;
  if (!m) return;
  const meta = missionMeta(m.id);
  G.player.money += meta.reward;
  G.player.debt = Math.max(0, G.player.debt - meta.reward);
  G.missionsDone = m.id;
  G.particles.popup(G.player.x, G.player.y - 50, `MISSION COMPLETE +$${meta.reward}`, '#7dff8a', true);
  G.audio.sfx('mission');
  G.mission = null;
  G.marker = null;
  G.saveGame();
  if (m.id >= 12) {
    G.mode = 'complete';
    setDialog(G, 'Madame Kestrel', 'BOSS', 'The port is ours, Deke. The tide turned tonight.', '#ffd166');
    return;
  }
  startMission(G, m.id + 1);
}

export function failMission(G, reason) {
  const m = G.mission;
  if (!m) return;
  setDialog(G, 'SYSTEM', 'FAILED', `${missionMeta(m.id).title} failed: ${reason}. Try again.`, '#ff5d5d');
  G.audio.sfx('fail');
  G.mission = null;
  G.marker = null;
  G.enemies = [];
  // Restart the same mission after a beat.
  G.retryT = 1.2;
  G.retryId = m.id;
}

function distTo(G, x, y) { return Math.hypot(G.player.x - x, G.player.y - y); }

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m || G.mode !== 'play') return; // never complete a mission after bust/waste
  m.t += dt;
  const p = G.player;
  if (m.id === 1) {
    if (distTo(G, PLACES.kestrelClub.x, PLACES.kestrelClub.y) < 70) {
      setDialog(G, 'Madame Kestrel', 'BOSS', 'Deke. Fifty grand, and the clock is ticking. Work for me, and we call it even.', '#ffd166');
      completeMission(G);
    }
  } else if (m.id === 2) {
    if (m.stage === 0 && p.inCar) {
      m.stage = 1;
      setDialog(G, 'Vex', 'FIXER', 'Nice ride. Now bring it to my garage — easy does it.', '#39c6ff');
    }
    if (m.stage === 1 && distTo(G, PLACES.garage.x, PLACES.garage.y) < 80) completeMission(G);
  } else if (m.id === 3) {
    m.data.timer -= dt;
    if (distTo(G, PLACES.harborDock.x, PLACES.harborDock.y) < 80) completeMission(G);
    else if (m.data.timer <= 0) failMission(G, 'timer ran out');
  } else if (m.id === 4) {
    if (G.wanted === 0) completeMission(G);
  } else if (m.id === 5) {
    const left = G.enemies.filter((e) => e.alive).length;
    if (left === 0 && m.t > 1) completeMission(G);
  } else if (m.id === 6) {
    if (m.stage === 0 && distTo(G, PLACES.stashHouse.x, PLACES.stashHouse.y) < 70) {
      m.stage = 1;
      p.money += 800;
      G.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Vex Garage' };
      setDialog(G, 'Vex', 'FIXER', 'Cash grabbed. Now get it to the garage before their friends show up.', '#39c6ff');
      addWanted(G, 2);
    } else if (m.stage === 1 && distTo(G, PLACES.garage.x, PLACES.garage.y) < 80) completeMission(G);
  } else if (m.id === 7) {
    const t = m.data.target;
    const wp = m.data.waypoints[t.wp];
    const td = Math.hypot(wp.x - t.x, wp.y - t.y);
    if (td < 20) t.wp = (t.wp + 1) % m.data.waypoints.length;
    const ta = Math.atan2(wp.y - t.y, wp.x - t.x);
    t.x += Math.cos(ta) * t.speed * dt;
    t.y += Math.sin(ta) * t.speed * dt;
    t.angle = ta;
    G.marker = { x: t.x, y: t.y, label: 'Target' };
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    if (d < 80) { failMission(G, 'you were spotted'); return; }
    if (d < 320) m.data.followT += dt;
    if (m.data.followT > 25) completeMission(G);
  } else if (m.id === 8) {
    if (!m.data.picked && distTo(G, PLACES.cabStand.x, PLACES.cabStand.y) < 70 && p.inCar) {
      m.data.picked = true;
      const drop = m.data.drops[m.data.fares];
      G.marker = { x: drop.x, y: drop.y, label: drop.label };
      setDialog(G, 'Fare', 'PASSENGER', 'Downtown, please — and step on it!', '#f4a261');
    } else if (m.data.picked) {
      const drop = m.data.drops[m.data.fares];
      if (distTo(G, drop.x, drop.y) < 80) {
        p.money += 300;
        m.data.fares += 1;
        m.data.picked = false;
        if (m.data.fares >= 2) { completeMission(G); return; }
        G.marker = { x: PLACES.cabStand.x, y: PLACES.cabStand.y, label: 'Cab Stand' };
        setDialog(G, 'Dottie', 'DISPATCH', 'One more fare. Back to the stand.', '#7dff8a');
      }
    }
  } else if (m.id === 9) {
    m.data.timer -= dt;
    const gate = m.data.gates[m.data.gate];
    if (gate && distTo(G, gate.x, gate.y) < 90) {
      m.data.gate += 1;
      G.audio.sfx('pickup');
      if (m.data.gate >= m.data.gates.length) { completeMission(G); return; }
      const next = m.data.gates[m.data.gate];
      G.marker = { x: next.x, y: next.y, label: next.label };
    }
    if (m.data.timer <= 0) failMission(G, 'race timer ran out');
  } else if (m.id === 10) {
    let got = 0;
    for (const c of m.data.crates) {
      if (!c.got && distTo(G, c.x, c.y) < 60) { c.got = true; G.audio.sfx('pickup'); }
      if (c.got) got += 1;
    }
    if (got >= 3) completeMission(G);
  } else if (m.id === 11) {
    const left = G.enemies.filter((e) => e.alive).length;
    if (m.stage === 0 && left === 0) {
      m.stage = 1;
      p.money += 3000;
      G.marker = { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Vex Garage' };
      addWanted(G, 4);
      setDialog(G, 'Vex', 'FIXER', 'Take is yours. Now run — the whole PSPD is coming.', '#39c6ff');
    } else if (m.stage === 1 && distTo(G, PLACES.garage.x, PLACES.garage.y) < 80) completeMission(G);
  } else if (m.id === 12) {
    const left = G.enemies.filter((e) => e.alive).length;
    if (left === 0 && m.t > 1) completeMission(G);
  }
}
