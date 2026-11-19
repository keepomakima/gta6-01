// NEON TIDE v7 "Golden Hour" — pedestrians.js (NEW in v7)
// The living city v6r2 lacked: animated pedestrians with swinging legs,
// a bobbing walk cycle, varied shirts / pants / skin, and a few that stand
// still chatting on the boardwalk. Rendering only — movement lives in
// traffic.js (updatePeds), data in entities.js (makePed).
// A ped mesh is a small group: torso (shirt), head (skin), two legs (pants)
// that swing opposite each other with the walk phase, plus a bob.
export function pedMeshFor(R, ped) {
  let m = R.pedMeshes.get(ped.id);
  if (m) return m;
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.5),
    new THREE.MeshStandardMaterial({ color: ped.shirt, roughness: 0.8 }));
  torso.position.y = 1.35;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8),
    new THREE.MeshStandardMaterial({ color: ped.skin, roughness: 0.7 }));
  head.position.y = 2.35;
  g.add(head);
  const legMat = new THREE.MeshStandardMaterial({ color: ped.pants, roughness: 0.9 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.4), legMat);
  legL.geometry.translate(0, -0.5, 0);
  legL.position.set(-0.22, 1.0, 0);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.0, 0.4), legMat);
  legR.geometry.translate(0, -0.5, 0);
  legR.position.set(0.22, 1.0, 0);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  R.scene.add(g);
  R.pedMeshes.set(ped.id, g);
  return g;
}

// Draw every pedestrian: position, heading, walk-cycle leg swing and bob.
export function drawPeds(R, S) {
  const seen = new Set();
  for (const ped of S.peds) {
    const m = pedMeshFor(R, ped);
    seen.add(ped.id);
    const swing = ped.flee > 0 ? 0.7 : 0.45;
    const s = Math.sin(ped.walkPhase) * swing;
    m.userData.legL.rotation.x = s;
    m.userData.legR.rotation.x = -s;
    const bob = Math.abs(Math.sin(ped.walkPhase)) * 0.09;
    m.position.set(ped.x, bob, ped.z);
    m.rotation.y = ped.heading;
    m.visible = true;
  }
  for (const [id, m] of R.pedMeshes) if (!seen.has(id)) m.visible = false;
}

// How many pedestrians are near a point — used by the shots to guarantee a
// busy frame (the v6r2 screenshots had an empty city).
export function pedsNear(S, x, z, radius) {
  let n = 0;
  for (const ped of S.peds) {
    const dx = ped.x - x, dz = ped.z - z;
    if (dx * dx + dz * dz < radius * radius) n += 1;
  }
  return n;
}

// Pedestrian roles: the city is not one crowd doing one thing. Once a
// frame from the main loop, after traffic has moved everyone, peds that
// wander into a place take on that place's behaviour — and keep it, so a
// tourist does not flip-flop the moment they drift a step. Fleeing peds
// are left alone: nobody poses for a photo while running from gunfire.
// - Tourists on the Beachfront stop, face the sea, and watch the sunset.
// - The casino crowd mills slowly around the TIDE plaza, facing the doors.
// - Joggers on the boardwalk run the shore at twice a walker's pace.
const CASINO_X = 300;
const CASINO_Z = 580;
const CASINO_RADIUS = 70;
const BEACH_X = 400;
const BEACH_Z = 640;
const BOARDWALK_Z = 700;
const JOG_SPEED = 3.4;
const STROLL_SPEED = 0.5;

export function updatePedRoles(S) {
  for (const ped of S.peds) {
    if (ped.cruise === undefined) ped.cruise = ped.walkSpeed;
    if (ped.flee > 0) continue;
    if (ped.role === 'tourist') {
      ped.heading = 0;
      ped.walkSpeed = 0;
      continue;
    }
    if (ped.role === 'crowd') {
      ped.heading = Math.atan2(CASINO_X - ped.x, CASINO_Z - ped.z);
      ped.walkSpeed = STROLL_SPEED;
      continue;
    }
    if (ped.role === 'jogger') {
      ped.walkSpeed = JOG_SPEED;
      continue;
    }
    if (ped.x > BEACH_X && ped.z > BEACH_Z) {
      ped.role = 'tourist';
      ped.heading = 0;
      ped.walkSpeed = 0;
    } else if ((ped.x - CASINO_X) * (ped.x - CASINO_X) + (ped.z - CASINO_Z) * (ped.z - CASINO_Z) < CASINO_RADIUS * CASINO_RADIUS) {
      ped.role = 'crowd';
      ped.heading = Math.atan2(CASINO_X - ped.x, CASINO_Z - ped.z);
      ped.walkSpeed = STROLL_SPEED;
    } else if (ped.z > BOARDWALK_Z) {
      ped.role = 'jogger';
      ped.walkSpeed = JOG_SPEED;
    }
    if (!ped.role) ped.walkSpeed = ped.cruise;
  }
  updatePedChats(S);
}

// Street chats: two idle walkers who bump into each other stop and talk
// for a few seconds — facing each other, standing still — then walk on.
// Tourists watch the sea, joggers keep running, and nobody chats while
// fleeing. The pair check is O(n^2) over ~34 peds, a few hundred distance
// checks a frame, which the frame budget never notices.
const CHAT_GAP = 2.5;
const CHAT_SECS = 3;

function updatePedChats(S) {
  const peds = S.peds;
  for (let i = 0; i < peds.length; i++) {
    const a = peds[i];
    if (a.flee > 0 || a.role === 'tourist' || a.role === 'jogger') continue;
    if (a.chatUntil > S.time) {
      if (a.chatWith) a.heading = Math.atan2(a.chatWith.x - a.x, a.chatWith.z - a.z);
      a.walkSpeed = 0;
      continue;
    }
    a.chatWith = null;
    for (let j = i + 1; j < peds.length; j++) {
      const b = peds[j];
      if (b.flee > 0 || b.role === 'tourist' || b.role === 'jogger') continue;
      if (b.chatUntil > S.time) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (dx * dx + dz * dz > CHAT_GAP * CHAT_GAP) continue;
      a.chatUntil = S.time + CHAT_SECS;
      b.chatUntil = S.time + CHAT_SECS;
      a.chatWith = b;
      b.chatWith = a;
      a.walkSpeed = 0;
      b.walkSpeed = 0;
      break;
    }
  }
}
