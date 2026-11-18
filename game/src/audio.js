// NEON TIDE v4 — audio: procedural WebAudio radio (3 original stations) + SFX.
// One job: all sound. Nothing here loads a file; every note is synthesized.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioOn = true;
    this.station = 0;
    this.musicTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  resume() { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  stationName() {
    return ['NEON FM 88.2', 'TIDE WAVE 101.5', 'HARBOR TALK 94.0'][this.station];
  }

  nextStation() {
    this.station = (this.station + 1) % 3;
    this.step = 0;
    return this.stationName();
  }

  // A tiny step sequencer: each station has its own chord roots + tempo.
  startRadio() {
    this.ensure();
    if (!this.ctx || this.musicTimer) return;
    const roots = [
      [55, 65.41, 49, 58.27], // Neon FM: moody synthwave A minor
      [73.42, 87.31, 65.41, 98], // Tide Wave: breezy major
      [82.41, 110, 98, 123.47], // Harbor Talk: low talk-bed pulse
    ];
    const bpm = [96, 112, 78][this.station];
    const stepMs = (60 / bpm / 2) * 1000;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.radioOn || this.muted) return;
      const root = roots[this.station][Math.floor(this.step / 8) % 4];
      const scale = [1, 1.189, 1.335, 1.498, 1.782, 2];
      const note = root * 4 * scale[this.step % scale.length];
      this.blip(note, 0.14, this.station === 2 ? 'sine' : 'triangle', 0.05);
      if (this.step % 4 === 0) this.blip(root * 2, 0.3, 'sine', 0.07);
      if (this.step % 8 === 4) this.blip(root * 3, 0.18, 'square', 0.02);
      this.step += 1;
    }, stepMs);
  }

  stopRadio() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }

  blip(freq, dur, type = 'sine', vol = 0.08) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  noise(dur, vol = 0.12, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  sfx(name) {
    if (!this.ctx) return;
    if (name === 'shot') this.noise(0.12, 0.25, 3000);
    else if (name === 'punch') this.noise(0.08, 0.2, 900);
    else if (name === 'pickup') { this.blip(660, 0.1, 'sine', 0.1); setTimeout(() => this.blip(990, 0.14, 'sine', 0.1), 70); }
    else if (name === 'cash') { this.blip(880, 0.08, 'square', 0.05); setTimeout(() => this.blip(1320, 0.12, 'square', 0.05), 60); }
    else if (name === 'siren') { this.blip(740, 0.35, 'sawtooth', 0.04); setTimeout(() => this.blip(988, 0.35, 'sawtooth', 0.04), 350); }
    else if (name === 'crash') this.noise(0.3, 0.3, 700);
    else if (name === 'mission') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.09), i * 110)); }
    else if (name === 'fail') { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.06), i * 130)); }
    else if (name === 'door') this.blip(220, 0.12, 'square', 0.06);
    else if (name === 'horn') { this.blip(330, 0.18, 'square', 0.06); setTimeout(() => this.blip(330, 0.18, 'square', 0.06), 200); }
    else if (name === 'heli') this.noise(0.5, 0.05, 400);
  }

  engineStart() {
    this.ensure();
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  engineSet(speedNorm) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.value = 55 + speedNorm * 110;
    this.engineGain.gain.value = this.muted ? 0 : 0.02 + speedNorm * 0.035;
  }

  engineStop() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch {} this.engineOsc = null; this.engineGain = null; }
  }
}
