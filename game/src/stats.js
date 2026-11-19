// NEON TIDE v7 "Golden Hour" — stats.js
// The career ledger. While the missions tell von what to do next, the
// stats tell von what kind of criminal they have become: how long they
// have been out, how far they have driven, how fast they have ever gone,
// how much they have earned, and how many cars they have taken. The
// numbers feed the HUD strip and three of the trophies (Globetrotter,
// Wheelman, Big Spender). This module only watches — it never changes
// money, health, wanted level, or mission state, so it cannot break a
// mission, a chase, or a playtest.

import { TROPHIES } from './achievements.js';

// A kilometre of Port Solano is a thousand world units on the map the
// renderer draws — the city is roughly two and a half kilometres across.
const UNITS_PER_KM = 1000;

// The ledger on the state: seconds played, units driven, fastest speed,
// career earnings, cars entered, and the last position and wallet seen so
// a delta can be measured once a frame. The records are personal bests
// that survive in the save: the best Heat Wave score, the longest single
// drift banked, the highest wanted level ever survived, and the biggest
// single stunt payout.
export function createStats() {
  return {
    playtime: 0,
    distance: 0,
    topKmh: 0,
    moneyEarned: 0,
    carsEntered: 0,
    lastX: 0,
    lastZ: 0,
    lastMoney: 250,
    hadCar: false,
    bestHeat: 0,
    longestDrift: 0,
    maxWanted: 0,
    bestPayout: 0,
  };
}

// Once a frame from the main loop, while the game is actually being
// played. Title screens, pause, and cutscenes do not count toward the
// career — only time with the city live under von's hands.
export function updateStats(S, dt) {
  const st = S.stats;
  const P = S.player;
  if (S.ui.screen !== 'playing') return;
  st.playtime += dt;
  if (P.car) {
    const dx = P.x - st.lastX;
    const dz = P.z - st.lastZ;
    st.distance += Math.sqrt(dx * dx + dz * dz);
    const kmh = Math.abs(P.car.speed) * 2.2;
    if (kmh > st.topKmh) st.topKmh = kmh;
    if (!st.hadCar) {
      st.carsEntered += 1;
      st.hadCar = true;
    }
  } else {
    st.hadCar = false;
  }
  st.lastX = P.x;
  st.lastZ = P.z;
  if (P.money > st.lastMoney) st.moneyEarned += P.money - st.lastMoney;
  st.lastMoney = P.money;
  // Personal bests: the best Heat Wave score so far, the longest drift
  // banked in one slide, the highest wanted level ever lived through,
  // and the biggest single stunt payout.
  if (S.heatwave.score > st.bestHeat) st.bestHeat = S.heatwave.score;
  if (S.stunts.driftBank > st.longestDrift) st.longestDrift = S.stunts.driftBank;
  if (S.wanted > st.maxWanted) st.maxWanted = S.wanted;
  if (S.stunts.lastPay > st.bestPayout) st.bestPayout = S.stunts.lastPay;
}

// The records for the save: only the four bests travel with the player.
export function statsSaveRecords(S) {
  const st = S.stats;
  return {
    bestHeat: st.bestHeat,
    longestDrift: st.longestDrift,
    maxWanted: st.maxWanted,
    bestPayout: st.bestPayout,
  };
}

export function statsLoadRecords(S, rec) {
  if (!rec || typeof rec !== 'object') return;
  const st = S.stats;
  st.bestHeat = rec.bestHeat || 0;
  st.longestDrift = rec.longestDrift || 0;
  st.maxWanted = rec.maxWanted || 0;
  st.bestPayout = rec.bestPayout || 0;
}

// Kilometres driven, one decimal, for the HUD strip and the trophies.
export function drivenKm(S) {
  return S.stats.distance / UNITS_PER_KM;
}

// The clock as a short string: 07:42 for seven minutes forty-two seconds,
// 1:12:05 once the career passes an hour.
export function playtimeString(S) {
  const total = Math.floor(S.stats.playtime);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

// One line for the HUD strip: style points, top speed, distance driven,
// and career earnings.
export function statSummary(S) {
  const st = S.stats;
  const km = drivenKm(S);
  return `STYLE ${S.stunts.points} · TOP ${Math.round(st.topKmh)} km/h · ${km.toFixed(1)} km driven · $${Math.round(st.moneyEarned).toLocaleString()} earned`;
}

// The full career sheet, one row per fact, for the pause screen and the
// end-of-game summary. Each row is a label and a display string, so the
// renderer never has to know how a number was measured.
export function statRows(S) {
  const st = S.stats;
  return [
    { label: 'Time on the streets', value: playtimeString(S) },
    { label: 'Distance driven', value: `${drivenKm(S).toFixed(1)} km` },
    { label: 'Top speed', value: `${Math.round(st.topKmh)} km/h` },
    { label: 'Career earnings', value: `$${Math.round(st.moneyEarned).toLocaleString()}` },
    { label: 'Cars taken', value: `${st.carsEntered}` },
    { label: 'Takedowns', value: `${S.killsTotal}` },
    { label: 'Near misses', value: `${S.stunts.nearMisses}` },
    { label: 'Style points', value: `${S.stunts.points}` },
    { label: 'Best Heat Wave score', value: `${S.stats.bestHeat}` },
    { label: 'Longest drift', value: `$${Math.round(S.stats.longestDrift)}` },
    { label: 'Highest wanted survived', value: `${S.stats.maxWanted} ★` },
    { label: 'Biggest stunt payout', value: `$${S.stats.bestPayout}` },
    { label: 'Missions finished', value: `${S.completedCount} / 18` },
    { label: 'Trophies', value: `${Object.keys(S.achievements.unlocked).length} / ${TROPHIES.length}` },
  ];
}
