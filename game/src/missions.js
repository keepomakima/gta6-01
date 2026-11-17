// NEON TIDE — missions.js
// The story: Deke Marlowe owes Madame Kestrel $50,000. Eight missions, in
// order, pay the debt down and end with the harbor heist. Each mission is a
// small state machine with a marker, a timer, dialogue and a reward.

import { PLACES } from './config.js';
import { dist, randRange } from './random.js';
import { spawnEnemy, spawnPickup, addMessage, addWanted } from './entities.js';
import { createCar } from './entities.js';

export const MISSION_NAMES = [
  'Welcome Back',
  'Hot Wheels',
  'Harbor Run',
  'Lose the Heat',
  'Street Fight',
  'Payback',
  'The Setup',
  'The Big One',
];

export const MISSION_REWARDS = [200, 500, 800, 600, 1000, 1500, 1200, 5000];

function setMarker(G, x, y, label) {
  G.mission.marker = { x, y, label };
}

function say(G, lines) {
  G.dialog = { lines, t: 0, i: 0 };
  for (const line of lines) addMessage(G, line, '#cfe8ff');
}

export function startMission(G, index) {
  const def = MISSION_NAMES[index];
  G.mission = {
    index,
    name: def,
    stage: 0,
    timer: 0,
    data: {},
    marker: null,
    failed: false,
    retryT: 0,
  };
  const p = G.player;
  if (index === 0) {
    setMarker(G, PLACES.kestrelClub.x, PLACES.kestrelClub.y, 'Kestrel Club');
    say(G, ['Madame Kestrel: "Deke. Back at last."', '"You owe me $50,000. Walk to my club."']);
  } else if (index === 1) {
    // A sport car waits near the club for the taking.
    const car = createCar(G, 'sport', PLACES.sportSpawn.x, PLACES.sportSpawn.y, Math.PI / 2, { driver: null, parked: true });
    G.cars.push(car);
    setMarker(G, PLACES.sportSpawn.x, PLACES.sportSpawn.y, 'Steal the Vortex GT');
    say(G, ['Kestrel: "I need a fast car. Take the red Vortex GT."', '"Bring it to your garage. Press E near a car."']);
  } else if (index === 2) {
    setMarker(G, PLACES.harborDock.x, PLACES.harborDock.y, 'Harbor Dock 7');
    G.mission.timer = 90;
    say(G, ['Kestrel: "Package for Dock 7. Ninety seconds."', '"Drive fast — the harbor does not wait."']);
  } else if (index === 3) {
    addWanted(G, 320, 'setup');
    setMarker(G, p.x, p.y, 'Lose the cops');
    say(G, ['Kestrel: "The PSPD is all over you. Lose them."', '"Stay out of sight until the heat dies down."']);
  } else if (index === 4) {
    for (let i = 0; i < 4; i += 1) {
      spawnEnemy(G, PLACES.gangCorner.x + randRange(G.rng, -60, 60), PLACES.gangCorner.y + randRange(G.rng, -60, 60));
    }
    setMarker(G, PLACES.gangCorner.x, PLACES.gangCorner.y, 'Rival corner');
    say(G, ['Kestrel: "The Tide Rats took my corner. Clear them out."', '"Fists or pistol — your call."']);
  } else if (index === 5) {
    setMarker(G, PLACES.stashHouse.x, PLACES.stashHouse.y, 'Stash House');
    say(G, ['Kestrel: "The Rats stash cash in Old Town."', '"Grab it, then get back to the garage in a car."']);
  } else if (index === 6) {
    const t = {
      kind: 'ped',
      x: 1200, y: 300,
      angle: 0, hp: 50, speed: 55,
      shirt: '#e8b73a', state: 'walk', walkT: 4,
      carId: null, flashT: 0, walkAnim: 0, target: true,
    };
    G.peds.push(t);
    G.mission.data.target = t;
    G.mission.data.followT = 0;
    setMarker(G, t.x, t.y, 'Follow the courier');
    say(G, ['Kestrel: "Follow the courier in yellow. Do not get seen."', '"Stay close — but not too close."']);
  } else if (index === 7) {
    for (let i = 0; i < 6; i += 1) {
      spawnEnemy(G, PLACES.harborDock.x + randRange(G.rng, -140, 140), PLACES.harborDock.y + randRange(G.rng, -90, 90), { hp: 80 });
    }
    setMarker(G, PLACES.harborDock.x, PLACES.harborDock.y, 'Harbor heist');
    say(G, ['Kestrel: "Tonight we take the harbor back."', '"Clear the guards, grab the loot, and run."']);
  }
  addMessage(G, `Mission ${index + 1}/8: ${def}`, '#ffd75a');
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  if (m.failed) {
    m.retryT -= dt;
    if (m.retryT <= 0) startMission(G, m.index);
    return;
  }
  const p = G.player;
  if (m.index === 0) {
    if (dist(p.x, p.y, PLACES.kestrelClub.x, PLACES.kestrelClub.y) < 60) completeMission(G);
  } else if (m.index === 1) {
    if (m.stage === 0) {
      if (p.inCar) {
        const car = G.cars.find((c) => c.id === p.inCar);
        if (car && car.type === 'sport') {
          m.stage = 1;
          setMarker(G, PLACES.garage.x, PLACES.garage.y, "Deke's Garage");
          say(G, ['Kestrel: "Good. Now bring it to the garage."']);
        }
      }
    } else if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 70 && p.inCar) {
      completeMission(G);
    }
  } else if (m.index === 2) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'Too slow — the package missed its ship.');
      return;
    }
    if (dist(p.x, p.y, PLACES.harborDock.x, PLACES.harborDock.y) < 70) completeMission(G);
  } else if (m.index === 3) {
    if (G.heat <= 0 && wantedStarsOf(G) === 0) {
      m.data.calmT = (m.data.calmT || 0) + dt;
      if (m.data.calmT > 2) completeMission(G);
    } else {
      m.data.calmT = 0;
    }
  } else if (m.index === 4) {
    const alive = G.enemies.filter((e) => e.hp > 0).length;
    if (alive === 0 && m.stage === 0) {
      m.stage = 1;
      completeMission(G);
    }
  } else if (m.index === 5) {
    if (m.stage === 0) {
      if (dist(p.x, p.y, PLACES.stashHouse.x, PLACES.stashHouse.y) < 60) {
        m.stage = 1;
        m.data.grabT = 0;
        say(G, ['Grabbing the cash... stay in the circle.']);
      }
    } else if (m.stage === 1) {
      if (dist(p.x, p.y, PLACES.stashHouse.x, PLACES.stashHouse.y) < 60) {
        m.data.grabT += dt;
        if (m.data.grabT > 2) {
          m.stage = 2;
          p.money += 400;
          setMarker(G, PLACES.garage.x, PLACES.garage.y, "Deke's Garage");
          say(G, ['Cash grabbed. Get to the garage — in a car!']);
        }
      } else {
        m.data.grabT = 0;
      }
    } else if (m.stage === 2) {
      if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 70 && p.inCar) completeMission(G);
    }
  } else if (m.index === 6) {
    const t = m.data.target;
    if (!t || t.hp <= 0) {
      failMission(G, 'The courier is gone.');
      return;
    }
    const d = dist(p.x, p.y, t.x, t.y);
    // The courier walks a patrol loop around downtown.
    t.walkT -= dt;
    if (t.walkT <= 0) {
      t.walkT = 5;
      t.angle = Math.atan2(300 + randRange(G.rng, -200, 500) - t.y, 1200 + randRange(G.rng, -400, 400) - t.x);
    }
    if (d < 70) {
      failMission(G, 'Spotted! The courier made you.');
      return;
    }
    if (d < 320) {
      m.data.followT += dt;
    }
    if (m.data.followT > 25) {
      completeMission(G);
      return;
    }
    setMarker(G, t.x, t.y, 'Follow the courier');
  } else if (m.index === 7) {
    const alive = G.enemies.filter((e) => e.hp > 0).length;
    if (m.stage === 0) {
      if (alive === 0) {
        m.stage = 1;
        spawnPickup(G, PLACES.harborDock.x, PLACES.harborDock.y, 'cash', 1000);
        setMarker(G, PLACES.harborDock.x, PLACES.harborDock.y, 'Grab the loot');
        say(G, ['Guards down. Grab the loot!']);
      }
    } else if (m.stage === 1) {
      if (dist(p.x, p.y, PLACES.harborDock.x, PLACES.harborDock.y) < 50) {
        m.stage = 2;
        addWanted(G, 400, 'heist');
        setMarker(G, PLACES.safehouse.x, PLACES.safehouse.y, 'Safehouse');
        say(G, ['Four stars! Get to the safehouse — now!']);
      }
    } else if (m.stage === 2) {
      if (dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 70) completeMission(G);
    }
  }
}

function wantedStarsOf(G) {
  return Math.min(5, Math.floor((G.heat || 0) / 100));
}

export function completeMission(G) {
  const m = G.mission;
  const reward = MISSION_REWARDS[m.index];
  G.player.money += reward;
  G.completedMissions.push(m.index);
  G.stats.missionsDone += 1;
  G.debtPaid = (G.debtPaid || 0) + reward;
  G.audio.missionDone();
  addMessage(G, `Mission complete: ${m.name}  +$${reward}`, '#7dff8a');
  say(G, [`Mission complete: ${m.name} — $${reward} earned.`, `Debt left: $${50000 - G.debtPaid}.`]);
  G.mission = null;
  G.missionFlash = { t: 2.5, text: `MISSION COMPLETE — ${m.name.toUpperCase()}  +$${reward}` };
  if (m.index === 7) {
    G.storyDone = true;
    G.mode = 'complete';
    return;
  }
  // Next mission starts after a short breather.
  G.nextMissionT = 3;
}

export function failMission(G, reason) {
  const m = G.mission;
  m.failed = true;
  m.retryT = 4;
  addMessage(G, `Mission failed: ${reason}`, '#ff8a7a');
  say(G, [`Mission failed: ${reason}`, 'Retrying the mission...']);
}

export function objectiveText(G) {
  const m = G.mission;
  if (!m) {
    if (G.completedMissions.length >= 8) return 'Story complete — Port Solano is yours.';
    return 'Head to the next mission...';
  }
  const d = m.data;
  switch (m.index) {
    case 0: return 'Walk to the Kestrel Club';
    case 1: return m.stage === 0 ? 'Steal the red Vortex GT (E)' : "Drive the Vortex GT to Deke's Garage";
    case 2: return `Deliver the package to Harbor Dock 7 — ${Math.ceil(m.timer)}s left`;
    case 3: return 'Lose the cops — stay out of sight';
    case 4: return `Clear the rival corner — ${G.enemies.filter((e) => e.hp > 0).length} left`;
    case 5: return m.stage === 0 ? 'Reach the Stash House' : m.stage === 1 ? 'Grabbing the cash...' : "Drive to Deke's Garage in a car";
    case 6: return `Follow the courier — ${Math.max(0, Math.ceil(25 - (d.followT || 0)))}s (don't get close!)`;
    case 7: return m.stage === 0 ? `Clear the harbor guards — ${G.enemies.filter((e) => e.hp > 0).length} left` : m.stage === 1 ? 'Grab the loot at Dock 7' : 'Escape to the Safehouse!';
    default: return '';
  }
}
