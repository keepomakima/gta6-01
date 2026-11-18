// NEON TIDE v6 — procedural WebAudio: three radio stations (all original
// loops, no samples) plus SFX (engine hum, siren, gunshot, pickup, mission
// fanfare). Audio starts only after a user gesture; the playtest runs muted.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.station = 0; // 0 Neon FM, 1 Harbor Blues, 2 Solano Talk
    this.stations = ['Neon FM', 'Harbor Blues', 'Solano Talk'];
    this.radioOn = true;
    this._radioTimer = null;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._startRadio();
      this._startEngine();
    } catch { this.ctx = null; }
  }

  _note(freq, t, dur, type = 'square', vol = 0.05) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  _startRadio() {
    // Simple step sequencer: 8th notes at 112 BPM, per-station scales.
    const scales = [
      [220, 261.6, 329.6, 392, 440, 523.3], // Neon FM: A minor arpeggio
      [196, 233.1, 261.6, 293.7, 349.2, 392], // Harbor Blues
      [330, 330, 0, 392, 0, 330], // Solano Talk: sparse blips
    ];
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      if (this.radioOn && !this.muted) {
        const scale = scales[this.station];
        const n = scale[step % scale.length];
        if (n) this._note(n, this.ctx.currentTime, 0.22, this.station === 1 ? 'triangle' : 'square', 0.035);
        if (step % 4 === 0) this._note(55, this.ctx.currentTime, 0.3, 'sine', 0.06);
      }
      step++;
    };
    this._radioTimer = setInterval(tick, 268);
  }

  _startEngine() {
    if (!this.ctx) return;
    this._engineOsc = this.ctx.createOscillator();
    this._engineGain = this.ctx.createGain();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 50;
    this._engineGain.gain.value = 0;
    this._engineOsc.connect(this._engineGain).connect(this.ctx.destination);
    this._engineOsc.start();
  }

  setEngine(rpm01) {
    if (!this._engineOsc || this.muted) return;
    this._engineOsc.frequency.value = 45 + rpm01 * 160;
    this._engineGain.gain.value = rpm01 * 0.03;
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this._sirenOsc) {
      this._sirenOsc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      g.gain.value = 0.02;
      this._sirenOsc.type = 'sine';
      this._sirenOsc.frequency.value = 700;
      this._sirenOsc.connect(g).connect(this.ctx.destination);
      this._sirenOsc.start();
      this._sirenLfo = setInterval(() => {
        if (this._sirenOsc) this._sirenOsc.frequency.value = this._sirenOsc.frequency.value > 800 ? 650 : 950;
      }, 400);
    } else if (!on && this._sirenOsc) {
      clearInterval(this._sirenLfo);
      this._sirenOsc.stop(); this._sirenOsc = null;
    }
  }

  gunshot() {
    if (!this.ctx || this.muted) return;
    const dur = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.25;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  blip(freq = 880) { if (this.ctx && !this.muted) this._note(freq, this.ctx.currentTime, 0.12, 'sine', 0.08); }

  fanfare() {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => this._note(f, t0 + i * 0.12, 0.3, 'triangle', 0.09));
  }

  nextStation() {
    this.station = (this.station + 1) % 3;
    return this.stations[this.station];
  }
}
