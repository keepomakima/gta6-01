// NEON TIDE v7 "Golden Hour" — stunts.js
// Showing off pays. Port Solano rewards the driving von already does
// between missions: threading past traffic at speed, and holding a
// handbrake slide through a corner. A stunt pays cash on the spot, banks
// style points toward the Style Icon trophy, and pops a short banner in
// the HUD. Nothing here changes how cars handle or how police react —
// it only watches the driving that is already happening and prices it.

// A near miss is threading past a traffic car at 140 km/h or more without
// touching it. A drift is a handbrake slide with steering at 90 km/h or
// more. Both pay per event, and both are priced so an afternoon of
// showing off earns a few thousand — real money, not a rounding error.
const NEAR_MISS_KMH = 140;
const NEAR_MISS_GAP = 5;
const NEAR_MISS_PAY = 100;
const NEAR_MISS_COOLDOWN = 3;
const DRIFT_KMH = 90;
const DRIFT_RATE = 25;
const DRIFT_MIN_PAY = 50;
// A close shave is brushing a police cruiser at speed — the dangerous
// audience pays double a traffic near miss, and the cooldown is longer
// because cruisers stay close by design during a chase.
const CLOSE_SHAVE_KMH = 120;
const CLOSE_SHAVE_GAP = 4;
const CLOSE_SHAVE_PAY = 250;
const CLOSE_SHAVE_COOLDOWN = 8;

// The stunt ledger on the state: lifetime style points, fastest speed ever
// (km/h), near-miss count, the drift being banked right now, cars already
// missed so one pass only pays once, and the banner queue for the HUD.
export function createStunts() {
  return {
    points: 0,
    maxKmh: 0,
    nearMisses: 0,
    driftBank: 0,
    drifting: false,
    cooldown: 0,
    recent: new Set(),
    popups: [],
    lastPay: 0,
  };
}

// Pay out a stunt: cash now, style points forever, and a banner the HUD
// shows for a couple of seconds. The queue holds three at most so the
// screen never floods during a wild chase.
function awardStunt(S, amount, label) {
  const P = S.player;
  P.money += amount;
  S.stunts.points += amount;
  S.stunts.lastPay = amount;
  S.stunts.popups.push({ text: `${label} +$${amount}`, until: S.time + 2.5 });
  if (S.stunts.popups.length > 3) S.stunts.popups.shift();
}

// How far the player's car is from a traffic car, in world units.
function gapTo(P, car) {
  const dx = car.x - P.car.x;
  const dz = car.z - P.car.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Once a frame from the main loop. Watches speed, traffic gaps, and the
// handbrake, and prices what it sees. On foot there is nothing to price.
export function updateStunts(S, dt) {
  const st = S.stunts;
  const P = S.player;
  if (!P.car) {
    if (st.drifting) { st.drifting = false; st.driftBank = 0; }
    return;
  }
  const kmh = Math.abs(P.car.speed) * 2.2;
  if (kmh > st.maxKmh) st.maxKmh = kmh;
  if (st.cooldown > 0) st.cooldown -= dt;
  // Near miss: close, fast, and not the same car twice in a row.
  if (kmh >= NEAR_MISS_KMH && st.cooldown <= 0) {
    for (const car of S.traffic) {
      if (st.recent.has(car)) continue;
      if (gapTo(P, car) < NEAR_MISS_GAP) {
        st.recent.add(car);
        st.nearMisses += 1;
        st.cooldown = NEAR_MISS_COOLDOWN;
        awardStunt(S, NEAR_MISS_PAY, 'NEAR MISS');
        break;
      }
    }
  }
  // Forget cars that are far behind now, so the next pass can pay again.
  for (const car of st.recent) {
    if (gapTo(P, car) > 25) st.recent.delete(car);
  }
  // Close shave: brushing past a police cruiser at 120 km/h or more pays
  // double a traffic near miss. Cruisers stay close during a chase, so
  // the cooldown here is longer than the near-miss one.
  if (kmh >= CLOSE_SHAVE_KMH && st.cooldown <= 0) {
    const blues = [];
    for (const c of S.cruisers) blues.push(c);
    if (Array.isArray(S.roadblock)) for (const c of S.roadblock) blues.push(c);
    for (const car of blues) {
      if (st.recent.has(car)) continue;
      if (gapTo(P, car) < CLOSE_SHAVE_GAP) {
        st.recent.add(car);
        st.cooldown = CLOSE_SHAVE_COOLDOWN;
        awardStunt(S, CLOSE_SHAVE_PAY, 'CLOSE SHAVE');
        break;
      }
    }
  }
  // Drift: handbrake plus steering at speed banks cash every second; the
  // bank pays out when the slide ends, and only if it was worth anything.
  const I = S.input;
  const sliding = I.handbrake && kmh >= DRIFT_KMH && (I.lf || I.rt);
  if (sliding) {
    st.drifting = true;
    st.driftBank += DRIFT_RATE * dt;
  } else if (st.drifting) {
    const pay = Math.round(st.driftBank);
    if (pay >= DRIFT_MIN_PAY) awardStunt(S, pay, 'DRIFT');
    st.drifting = false;
    st.driftBank = 0;
  }
}

// The banner the HUD should show right now, or an empty string. Expired
// banners are dropped so a stale payout never lingers.
export function stuntPopup(S) {
  const st = S.stunts;
  while (st.popups.length > 0 && st.popups[0].until <= S.time) st.popups.shift();
  return st.popups.length > 0 ? st.popups[st.popups.length - 1].text : '';
}
