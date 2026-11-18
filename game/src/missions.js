// NEON TIDE v6 — story missions. 18 missions: the v5 fifteen (M1-M12
// original arc + M13 Midnight Run + M14 Silent Pier + M15 Neon Mile) plus
// three new ones (M16 Harbor Storm, M17 The Broker — second boss Vex,
// M18 King of Port Solano — finale). Deke owes Madame Kestrel $50,000;
// every reward pays the debt down. Step kinds: goto, timed, kill, grab,
// tail, stealth, survive, boss. Failing a step retries the mission.
import { ANCHORS } from './config.js';
import { dist2d, clamp } from './rng.js';

function goto(x, z, r, label) { return { kind: 'goto', x, z, r, label }; }
function timed(x, z, r, secs, label) { return { kind: 'timed', x, z, r, secs, label }; }
function kill(n, spawns, label) { return { kind: 'kill', n, spawns, label }; }
function grab(x, z, r, label) { return { kind: 'grab', x, z, r, label }; }
function tailM(label) { return { kind: 'tail', label }; }
function stealth(x, z, r, sentries, label) { return { kind: 'stealth', x, z, r, sentries, label }; }
function survive(label) { return { kind: 'survive', label }; }
function boss(spawn, label) { return { kind: 'boss', spawn, label }; }

export const MISSIONS = [
  { id: 1, name: 'Welcome Back', reward: 200, steps: [goto(14, 40, 18, 'Walk to Club Kestrel')] },
  { id: 2, name: 'Hot Wheels', reward: 500, steps: [
    goto(414, 60, 16, 'Steal the sport car'), goto(214, 300, 18, 'Deliver it to Rosa\'s Garage (slow down!)')] },
  { id: 3, name: 'Harbor Run', reward: 700, steps: [timed(-986, 300, 18, 75, 'Deliver the package to the Harbor dock')] },
  { id: 4, name: 'Lose the Heat', reward: 400, steps: [survive('Lose the wanted level — stay out of sight')] },
  { id: 5, name: 'Street Fight', reward: 800, steps: [kill(4, [[-620, 280], [-580, 320], [-600, 260], [-640, 300]], 'Clear the rival corner')] },
  { id: 6, name: 'Payback', reward: 1500, steps: [
    kill(3, [[-900, -140], [-860, -100], [-880, -80]], 'Clear the stash house guards'),
    grab(-786, -120, 18, 'Grab the stash'),
    goto(814, 420, 20, 'Escape to the Suburbs safehouse')] },
  { id: 7, name: 'The Setup', reward: 900, steps: [tailM('Tail the courier — stay 25 to 90 away, do not get spotted')] },
  { id: 8, name: 'The Big One', reward: 3000, steps: [
    kill(4, [[-986, 280], [-960, 320], [-986, 260], [-940, 300]], 'Clear the dock crew'),
    grab(-986, 300, 18, 'Grab the port cargo'),
    goto(214, 300, 20, 'Escape to Rosa\'s Garage')] },
  { id: 9, name: 'Dock War', reward: 1200, steps: [kill(5, [[-920, 80], [-880, 120], [-900, 160], [-860, 100], [-940, 140]], 'Take the container yard')] },
  { id: 10, name: 'Midnight Courier', reward: 1000, steps: [
    timed(300, -400, 18, 45, 'Drop 1: Old Town corner'),
    timed(-600, 500, 18, 60, 'Drop 2: Marina gate')] },
  { id: 11, name: 'Vault Break', reward: 2000, steps: [
    kill(5, [[-720, 600], [-680, 640], [-700, 580], [-660, 620], [-740, 620]], 'Silence the vault guards'),
    grab(-700, 620, 18, 'Crack the vault (+$2,000)')] },
  { id: 12, name: 'Rook', reward: 4000, steps: [boss({ x: 950, z: -620, hp: 220, name: 'Rook' }, 'Take down Rook, the rival boss')] },
  { id: 13, name: 'Midnight Run', reward: 2500, steps: [
    timed(300, -400, 18, 30, 'Stop 1: Old Town'),
    timed(-600, 300, 18, 30, 'Stop 2: Harbor gate'),
    timed(814, 420, 18, 30, 'Stop 3: Suburbs safehouse')] },
  { id: 14, name: 'Silent Pier', reward: 2200, steps: [
    stealth(-960, 700, 16, [[-940, 640, 0], [-980, 660, 2.2], [-950, 690, 1.1]], 'Reach the end of the pier unseen')] },
  { id: 15, name: 'Neon Mile', reward: 4000, steps: [
    grab(214, 320, 16, 'Lift the casino cash (+$4,000)'),
    goto(-850, -550, 22, 'Escape to the Airfield — wanted 4!')] },
  { id: 16, name: 'Harbor Storm', reward: 2800, steps: [
    kill(6, [[-620, 660], [-580, 690], [-640, 700], [-600, 650], [-560, 680], [-660, 670]], 'Storm the marina'),
    goto(0, 700, 22, 'Vanish along Beachfront')] },
  { id: 17, name: 'The Broker', reward: 5000, steps: [boss({ x: 814, z: -480, hp: 260, name: 'Vex' }, 'Take down Vex, the Broker — second boss')] },
  { id: 18, name: 'King of Port Solano', reward: 10000, steps: [
    kill(4, [[920, -600], [980, -640], [900, -660], [960, -580]], 'Break the arena guards'),
    boss({ x: 950, z: -620, hp: 320, name: 'Rook Reborn' }, 'Finish Rook Reborn and take the port'),
    goto(-850, -550, 22, 'Escape to the Airfield — wanted 5!')] },
];

export class Missions {
  constructor(ctx) {
    this.ctx = ctx; // {player, police, combat, traffic, world, audio, onEvent}
    this.index = 0; // 0-based into MISSIONS
    this.stepIndex = 0;
    this.kills = 0;
    this.timer = 0;
    this.detection = 0;
    this.failed = false;
    this.failReason = '';
    this.done = false; // all missions complete
    this.tail = null; // {x,z,heading,wp,progress,mesh}
    this.tailTime = 0;
    this.sentries = [];
    this.stepEntered = false;
    this.nextDelay = 0;
    this.frozen = false; // shots freeze the mission machine (no fail/timer)
  }

  current() { return this.index < MISSIONS.length ? MISSIONS[this.index] : null; }
  step() { const m = this.current(); return m ? m.steps[this.stepIndex] : null; }
  objective() {
    const m = this.current();
    if (!m) return 'Port Solano is yours.';
    const s = this.step();
    return `M${m.id} ${m.name}: ${s ? s.label : ''}`;
  }

  startMission(i) {
    this.index = Math.max(0, Math.min(MISSIONS.length - 1, i));
    this.stepIndex = 0; this.kills = 0; this.detection = 0;
    this.failed = false; this.failReason = ''; this.done = false;
    this._cleanupStep();
    this.stepEntered = false;
    this.ctx.onEvent && this.ctx.onEvent('mission-start', this.current());
  }

  retry() { this.startMission(this.index); }

  _cleanupStep() {
    if (this.tail) { this.ctx.scene.remove(this.tail.mesh); this.tail = null; }
    for (const s of this.sentries) this.ctx.scene.remove(s.mesh);
    this.sentries = [];
  }

  _enterStep() {
    const s = this.step();
    if (!s) return;
    this.stepEntered = true;
    const ctx = this.ctx;
    if (s.kind === 'timed') this.timer = s.secs;
    if (s.kind === 'kill' || s.kind === 'boss') {
      this.kills = 0;
      ctx.combat.clearEnemies();
      if (s.kind === 'kill') {
        for (const [x, z] of s.spawns) ctx.combat.spawnEnemy(x, z);
      } else {
        const b = s.spawn;
        ctx.combat.spawnEnemy(b.x, b.z, { boss: true, hp: b.hp, name: b.name, damage: 3, interval: 1.2 });
        // Boss guards.
        ctx.combat.spawnEnemy(b.x - 30, b.z + 20, { hp: 80 });
        ctx.combat.spawnEnemy(b.x + 30, b.z - 20, { hp: 80 });
      }
    }
    if (s.kind === 'tail') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 1.0), new THREE.MeshLambertMaterial({ color: 0x8a6a2a }));
      body.position.y = 2.4; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0xd8b090 }));
      head.position.y = 4.0; g.add(head);
      g.position.set(-200, 0, 400);
      ctx.scene.add(g);
      this.tail = { mesh: g, x: -200, z: 400, wp: 0, progress: 0, heading: 0 };
      this.tailTime = 0;
      this.tailGrace = 4; // seconds to find the courier before 'lost' counts
    }
    if (s.kind === 'stealth') {
      this.detection = 0;
      ctx.combat.clearEnemies();
      for (const [x, z, h] of s.sentries) {
        const e = ctx.combat.spawnEnemy(x, z, { hp: 60, damage: 0, interval: 99, speed: 0, target: { x, z } });
        e.mesh.rotation.y = h;
        e.heading = h;
        // Vision cone: a flat triangle on the ground, apex at the sentry,
        // widening to 32 units across at 70 units ahead.
        const coneGeo = new THREE.BufferGeometry();
        coneGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          0, 0, 0, -22, 0, 70, 22, 0, 70,
        ]), 3));
        coneGeo.computeVertexNormals();
        const cone = new THREE.Mesh(coneGeo,
          new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
        cone.position.set(0, 1.0, 0); // above the pier deck (top 0.8)
        e.mesh.add(cone);
        this.sentries.push(e);
      }
    }
    if (s.kind === 'survive') {
      ctx.police.setWanted(3);
      this.timer = 0;
    }
    if (this.current() && this.current().id === 18 && this.stepIndex === 2) {
      ctx.police.setWanted(5); // finale escape: full heat
    }
    if (this.current() && this.current().id === 15 && s.kind === 'grab') {
      // Casino grab arms the escape: wanted jumps when the cash is lifted.
    }
  }

  _advance() {
    const m = this.current();
    this.stepIndex++;
    this.stepEntered = false;
    this._cleanupStep();
    if (this.stepIndex >= m.steps.length) {
      // Mission complete: pay out.
      this.ctx.onEvent && this.ctx.onEvent('mission-complete', m);
      this.index++;
      this.stepIndex = 0;
      if (this.index >= MISSIONS.length) { this.done = true; this.ctx.onEvent && this.ctx.onEvent('game-won'); return; }
      this.nextDelay = 1.0; // breather before the next mission's first step
    }
  }

  fail(reason) {
    this.failed = true;
    this.failReason = reason;
    this.ctx.onEvent && this.ctx.onEvent('mission-failed', reason);
  }

  completeStep() {
    // Debug/test helper: force the current step done (also clears a fail,
    // so a forced advance always lets the mission machine run on).
    this.failed = false;
    this.failReason = '';
    const s = this.step();
    if (!s) return;
    if (s.kind === 'kill' || s.kind === 'boss') this.ctx.combat.shootAll();
    this._advance();
  }

  update(dt) {
    if (this.done || this.failed || this.frozen) return;
    const m = this.current();
    if (!m) return;
    if (this.nextDelay > 0) { this.nextDelay -= dt; if (this.nextDelay <= 0) this.stepEntered = false; return; }
    if (!this.stepEntered) this._enterStep();
    const s = this.step();
    if (!s) return;
    const p = this.ctx.player.pos;
    const d = (x, z) => dist2d(p.x, p.z, x, z);

    if (s.kind === 'goto' || s.kind === 'grab') {
      if (d(s.x, s.z) < s.r) {
        // M2 step 0 only counts once Deke is actually in the stolen sport.
        if (m.id === 2 && this.stepIndex === 0 && !this.ctx.player.car) return;
        if (s.kind === 'grab' && m.id === 15) this.ctx.police.setWanted(4);
        if (s.kind === 'grab' && m.id === 11) this.ctx.onEvent && this.ctx.onEvent('bonus', 2000);
        if (s.kind === 'grab' && m.id === 15) this.ctx.onEvent && this.ctx.onEvent('bonus', 4000);
        // Delivery steps want the car nearly stopped, not a drive-by.
        if (m.id === 2 && this.stepIndex === 1) {
          const car = this.ctx.player.car;
          if (!car || Math.abs(car.speed) > 120) return;
        }
        this._advance();
      }
    } else if (s.kind === 'timed') {
      this.timer -= dt;
      if (d(s.x, s.z) < s.r) {
        if (m.id === 3 || m.id === 10 || m.id === 13) {
          const car = this.ctx.player.car;
          if (car && Math.abs(car.speed) > 120) return;
        }
        this._advance();
      } else if (this.timer <= 0) this.fail('Out of time — the drop went cold.');
    } else if (s.kind === 'kill' || s.kind === 'boss') {
      const need = s.kind === 'kill' ? s.n : 1;
      // kills counted via combat.onKill below; also count remaining enemies.
      const alive = this.ctx.combat.enemies.length;
      const target = s.kind === 'kill' ? s.spawns.length : 3; // boss + 2 guards
      if (this.kills >= need || (s.kind === 'boss' && alive === 0)) this._advance();
      else if (s.kind === 'kill' && this.kills >= s.n) this._advance();
      void target;
    } else if (s.kind === 'survive') {
      if (this.ctx.police.wanted <= 0) this._advance();
    } else if (s.kind === 'tail') {
      const t = this.tail;
      if (!t) return;
      // Courier strolls a fixed route through Downtown.
      const route = [[-200, 400], [-200, 0], [0, 0], [0, -200], [200, -200], [200, 200]]; // road route, never through buildings
      const wp = route[t.wp];
      const td = dist2d(t.x, t.z, wp[0], wp[1]);
      if (td < 8) t.wp = (t.wp + 1) % route.length;
      const h = Math.atan2(wp[0] - t.x, wp[1] - t.z);
      t.heading = h;
      t.x += Math.sin(h) * 12 * dt;
      t.z += Math.cos(h) * 12 * dt;
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = h;
      const pd = dist2d(p.x, p.z, t.x, t.z);
      // Grace period first: the player may start far from the courier.
      if (this.tailGrace > 0) this.tailGrace -= dt;
      else {
        if (pd < 25) { this.fail('Spotted! The courier made you.'); return; }
        if (pd > 110) { this.fail('Lost the courier.'); return; }
      }
      if (pd <= 110) this.tailTime += dt;
      if (this.tailTime > 15) this._advance();
    } else if (s.kind === 'stealth') {
      // Detection rises inside a sentry cone with line of sight.
      let seen = false;
      for (const e of this.sentries) {
        const dd = dist2d(p.x, p.z, e.x, e.z);
        if (dd < 120) {
          const ang = Math.atan2(p.x - e.x, p.z - e.z);
          let dh = ang - e.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          if (Math.abs(dh) < 0.7 && !this.ctx.world.pointInBuilding((p.x + e.x) / 2, (p.z + e.z) / 2)) seen = true;
        }
      }
      this.detection = clamp(this.detection + (seen ? 45 : -18) * dt, 0, 100);
      if (this.detection >= 100) { this.fail('Spotted on the pier!'); return; }
      if (d(s.x, s.z) < s.r) this._advance();
    }
  }
}
