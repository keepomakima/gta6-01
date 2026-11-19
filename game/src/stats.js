// NEON TIDE v7-coverfix — stats.js (structural pass)
// The career ledger: time played, distance, top speed, earnings, cars
// taken, and the personal bests that survive in the save. This module
// only watches — it never changes money, health, wanted level, or
// mission state, so it cannot break a mission, a chase, or a playtest.
import { TROPHIES } from './achievements.js';

const UNITS_PER_KM = 1000;

export function createStats() {
  return {
    playtime: 0, distance: 0, topKmh: 0, moneyEarned: 0, carsEntered: 0,
    lastX: 0, lastZ: 0, lastMoney: 250, hadCar: false,
    bestHeat: 0, longestDrift: 0, maxWanted: 0, bestPayout: 0,
  };
}

// Once a frame, while the game is actually being played. Title screens,
// pause, and cutscenes do not count toward the career.
export function updateStats(S, dt) {
  const st = S.stats;
  const P = S.player;
  if (S.ui.screen !== 'playing') return;
  st.playtime += dt;
  if (P.car) {
    const dx = P.x - st.lastX;
    const dz = P.z - st.lastZ;
    st.distance += Math.hypot(dx, dz);
    const kmh = Math.abs(P.car.speed) * 2.2;
    st.topKmh = Math.max(st.topKmh, kmh);
    if (!st.hadCar) {
      st.carsEntered += 1;
      st.hadCar = true;
    }
  } else {
    st.hadCar = false;
  }
  st.lastX = P.x;
  st.lastZ = P.z;
  const gain = P.money - st.lastMoney;
  if (gain > 0) st.moneyEarned += gain;
  st.lastMoney = P.money;
  st.bestHeat = Math.max(st.bestHeat, S.heatwave.score);
  st.longestDrift = Math.max(st.longestDrift, S.stunts.driftBank);
  st.maxWanted = Math.max(st.maxWanted, S.wanted);
  st.bestPayout = Math.max(st.bestPayout, S.stunts.lastPay);
}

// The records for the save: only the four bests travel with the player.
export function statsSaveRecords(S) {
  const st = S.stats;
  return {
    bestPayout: st.bestPayout,
    maxWanted: st.maxWanted,
    longestDrift: st.longestDrift,
    bestHeat: st.bestHeat,
  };
}

export function statsLoadRecords(S, rec) {
  if (!rec || typeof rec !== 'object') return;
  const st = S.stats;
  st.bestHeat = rec.bestHeat ?? 0;
  st.longestDrift = rec.longestDrift ?? 0;
  st.maxWanted = rec.maxWanted ?? 0;
  st.bestPayout = rec.bestPayout ?? 0;
}

export function drivenKm(S) {
  return S.stats.distance / UNITS_PER_KM;
}

// The clock as a short string: 07:42, or 1:12:05 past an hour.
export function playtimeString(S) {
  const total = Math.floor(S.stats.playtime);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  function pad(n) { return String(n).padStart(2, '0'); }
  return hours > 0 ? `${hours}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

// One line for the HUD strip: style, top speed, distance, earnings.
export function statSummary(S) {
  const st = S.stats;
  const km = drivenKm(S);
  const pts = S.stunts.points;
  return `STYLE ${pts} · TOP ${Math.round(st.topKmh)} km/h · ${km.toFixed(1)} km driven · $${Math.round(st.moneyEarned).toLocaleString()} earned`;
}

// The full career sheet, one row per fact, for the pause screen and the
// end-of-game summary.
export function statRows(S) {
  const st = S.stats;
  return [
    { value: playtimeString(S), label: 'Time on the streets' },
    { value: `${drivenKm(S).toFixed(1)} km`, label: 'Distance driven' },
    { value: `${Math.round(st.topKmh)} km/h`, label: 'Top speed' },
    { value: `$${Math.round(st.moneyEarned).toLocaleString()}`, label: 'Career earnings' },
    { value: `${st.carsEntered}`, label: 'Cars taken' },
    { value: `${S.killsTotal}`, label: 'Takedowns' },
    { value: `${S.stunts.nearMisses}`, label: 'Near misses' },
    { value: `${S.stunts.points}`, label: 'Style points' },
    { value: `${S.stats.bestHeat}`, label: 'Best Heat Wave score' },
    { value: `$${Math.round(S.stats.longestDrift)}`, label: 'Longest drift' },
    { value: `${S.stats.maxWanted} ★`, label: 'Highest wanted survived' },
    { value: `$${S.stunts.bestPayout}`, label: 'Biggest stunt payout' },
    { value: `${S.completedCount} / 18`, label: 'Missions finished' },
    { value: `${Object.keys(S.achievements.unlocked).length} / ${TROPHIES.length}`, label: 'Trophies' },
  ];
}
