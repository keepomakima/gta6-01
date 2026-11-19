// NEON TIDE v7-coverfix — stunts.js (structural pass)
// Showing off pays: threading past traffic at speed, brushing a police
// cruiser, and holding a handbrake slide. A stunt pays cash on the spot,
// banks style points toward the Style Icon trophy, and pops a short
// banner in the HUD. Nothing here changes how cars handle or how police
// react — it only watches the driving that is already happening.
const TUNE = {
  nearMissKmh: 140, nearMissGap: 5, nearMissPay: 100, nearMissCooldown: 3,
  driftKmh: 90, driftRate: 25, driftMinPay: 50,
  closeShaveKmh: 120, closeShaveGap: 4, closeShavePay: 250, closeShaveCooldown: 8,
};

export function createStunts() {
  return {
    points: 0, maxKmh: 0, nearMisses: 0,
    driftBank: 0, drifting: false, cooldown: 0,
    recent: new Set(), popups: [], lastPay: 0,
  };
}

// Pay out a stunt: cash now, style points forever, and a banner the HUD
// shows for a couple of seconds. The queue holds three at most.
function awardStunt(S, amount, label) {
  S.player.money += amount;
  S.stunts.points += amount;
  S.stunts.lastPay = amount;
  S.stunts.popups.push({ until: S.time + 2.5, text: `${label} +$${amount}` });
  if (S.stunts.popups.length > 3) S.stunts.popups.shift();
}

function gapTo(P, car) {
  const dx = car.x - P.car.x;
  const dz = car.z - P.car.z;
  return Math.hypot(dx, dz);
}

// One pass past a car at speed pays once: the car joins the recent set
// so the same pass cannot pay twice, and the cooldown throttles repeats.
function checkPass(S, cars, gap, pay, label, cooldown, countIt) {
  const st = S.stunts;
  const P = S.player;
  return cars.some((car) => {
    if (st.recent.has(car)) return false;
    if (gapTo(P, car) >= gap) return false;
    st.recent.add(car);
    if (countIt) st.nearMisses += 1;
    st.cooldown = cooldown;
    awardStunt(S, pay, label);
    return true;
  });
}

// Once a frame from the main loop. On foot there is nothing to price.
export function updateStunts(S, dt) {
  const st = S.stunts;
  const P = S.player;
  if (!P.car) {
    if (st.drifting) { st.drifting = false; st.driftBank = 0; }
    return;
  }
  const kmh = Math.abs(P.car.speed) * 2.2;
  st.maxKmh = Math.max(st.maxKmh, kmh);
  st.cooldown = Math.max(0, st.cooldown - dt);
  if (kmh >= TUNE.nearMissKmh && st.cooldown <= 0) {
    checkPass(S, S.traffic, TUNE.nearMissGap, TUNE.nearMissPay, 'NEAR MISS', TUNE.nearMissCooldown, true);
  }
  st.recent.forEach((car) => {
    if (gapTo(P, car) > 25) st.recent.delete(car);
  });
  if (kmh >= TUNE.closeShaveKmh && st.cooldown <= 0) {
    const blues = S.cruisers.concat(S.roadblock || []);
    checkPass(S, blues, TUNE.closeShaveGap, TUNE.closeShavePay, 'CLOSE SHAVE', TUNE.closeShaveCooldown, false);
  }
  const I = S.input;
  const sliding = I.handbrake && kmh >= TUNE.driftKmh && (I.lf || I.rt);
  if (sliding) {
    st.drifting = true;
    st.driftBank += TUNE.driftRate * dt;
  } else if (st.drifting) {
    const pay = Math.round(st.driftBank);
    if (pay >= TUNE.driftMinPay) awardStunt(S, pay, 'DRIFT');
    st.drifting = false;
    st.driftBank = 0;
  }
}

// The banner the HUD should show right now, or an empty string.
export function stuntPopup(S) {
  const st = S.stunts;
  while (st.popups.length > 0 && st.popups[0].until <= S.time) st.popups.shift();
  if (st.popups.length === 0) return '';
  return st.popups[st.popups.length - 1].text;
}
