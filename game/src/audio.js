// NEON TIDE v5 — procedural WebAudio: three original radio stations plus
// engine hum, siren, gunshots and pickups. Everything is synthesized; no
// audio files, no network. AudioContext is created lazily on first user
// gesture so headless boots never throw.
const STATIONS = [
  { name: 'TIDE FM — synthwave', bpm: 96,  scale: [0, 3, 5, 7, 10], base: 110, wave: 'sawtooth' },
  { name: 'SOLANO SOUL — funk',  bpm: 112, scale: [0, 3, 5, 8, 10], base: 98,  wave: 'square' },
  { name: 'PIER 9 — chill',      bpm: 76,  scale: [0, 2, 4, 7, 9],  base: 130, wave: 'triangle' },
];

export function makeAudio() {
  return {
    ctx: null, station: 0, musicOn: true, nextNote: 0, step: 0,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    stationName() { return STATIONS[this.station].name; },
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        return true;
      } catch { return false; }
    },
    cycleStation() { this.station = (this.station + 1) % STATIONS.length; this.step = 0; },
    // One quiet bass note per beat; called from the main loop.
    tickMusic(now) {
      if (!this.musicOn || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this.ctx.state !== 'running') return;
      const st = STATIONS[this.station];
      if (now < this.nextNote) return;
      const beat = 60 / st.bpm;
      this.nextNote = now + beat;
      const deg = st.scale[this.step % st.scale.length];
      const f = st.base * Math.pow(2, deg / 12) * (this.step % 8 === 0 ? 0.5 : 1);
      const o = this.ctx.createOscillator();
      const gn = this.ctx.createGain();
      o.type = st.wave; o.frequency.value = f;
      gn.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gn.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + beat * 0.9);
      o.connect(gn); gn.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + beat);
      this.step++;
    },
    blip(freq, dur = 0.08, type = 'square', vol = 0.06) {
      if (!this.ensure()) return;
      try {
        const o = this.ctx.createOscillator();
        const gn = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        gn.gain.setValueAtTime(vol, this.ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.connect(gn); gn.connect(this.ctx.destination);
        o.start(); o.stop(this.ctx.currentTime + dur);
      } catch { /* audio is cosmetic */ }
    },
    shot() { this.blip(180, 0.12, 'sawtooth', 0.09); },
    pickup() { this.blip(660, 0.1, 'sine', 0.07); this.blip(880, 0.12, 'sine', 0.05); },
    fanfare() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.08), i * 110)); },
    crash() { this.blip(70, 0.2, 'sawtooth', 0.1); },
    siren(on) {
      if (!this.ensure()) return;
      try {
        if (on && !this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenGain = this.ctx.createGain();
          this.sirenOsc.type = 'sine';
          this.sirenGain.gain.value = 0.015;
          this.sirenOsc.connect(this.sirenGain);
          this.sirenGain.connect(this.ctx.destination);
          this.sirenOsc.start();
        } else if (!on && this.sirenOsc) {
          this.sirenOsc.stop();
          this.sirenOsc = null; this.sirenGain = null;
        }
        if (this.sirenOsc) {
          this.sirenOsc.frequency.value = 700 + Math.sin(performance.now() / 300) * 250;
        }
      } catch { /* cosmetic */ }
    },
  };
}
