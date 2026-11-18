// NEON TIDE v6 — "Heat Wave" endless survival mode. Started from the title
// screen (or the debug hook): police wanted climbs one star every 15
// seconds, cruisers and the helicopter hunt the player relentlessly, and the
// score is seconds survived + 25 per takedown. Ends busted or wasted; the
// best score is kept on the state for the HUD and the dossier outline.
export class HeatWave {
  constructor(ctx) {
    this.ctx = ctx; // {police, combat, onEvent}
    this.active = false;
    this.time = 0;
    this.score = 0;
    this.takedowns = 0;
    this.best = 0;
    this._climb = 0;
  }

  start() {
    this.active = true;
    this.time = 0;
    this.score = 0;
    this.takedowns = 0;
    this._climb = 0;
    this.ctx.police.setWanted(1);
    this.ctx.onEvent && this.ctx.onEvent('heat-start');
  }

  stop(reason) {
    if (!this.active) return;
    this.active = false;
    this.best = Math.max(this.best, this.score);
    this.ctx.onEvent && this.ctx.onEvent('heat-end', { score: this.score, time: this.time, reason });
  }

  onKill() {
    if (!this.active) return;
    this.takedowns++;
    this.score += 25;
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    this.score = Math.floor(this.time) + this.takedowns * 25;
    this._climb += dt;
    if (this._climb >= 15) {
      this._climb = 0;
      this.ctx.police.setWanted(Math.min(5, this.ctx.police.wanted + 1));
    }
    // Extra pressure: a fresh cruiser joins every 20 seconds at wanted 3+.
    if (this.ctx.police.wanted >= 3 && Math.floor(this.time) % 20 === 0 && this.ctx.police.cruisers.length < 5) {
      const p = this.ctx.playerPos();
      const s = this.ctx.police._nearestSpawn(p.x, p.z, 320);
      this.ctx.police._spawnCruiser(s.x, s.z);
    }
  }
}
