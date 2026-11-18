// NEON TIDE v5 — audio.js
// Radio WebAudio prosedural (3 station, musik orisinal) + SFX sintetis.
// Semua suara dibuat dari oscillator/noise — tanpa file audio, tanpa network.
// AudioContext dibuat malas (setelah gestur pertama) supaya tidak diblokir.
// Baru v5: SFX 'nos' (desis boost) dan 'rain' (noise hujan pelan).
// Revisi v5.2: tone() memakai exponentialRamp supaya tidak ada klik audio.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.station = 0;
    this.stations = ['Neon FM 101.9', 'Tide 98.4', 'Port Talk 870'];
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.startRadio();
      this.startEngineHum();
      return true;
    } catch {
      return false;
    }
  }

  stationName() { return this.stations[this.station]; }

  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    if (this.ctx) this.sfx('station');
    return this.stations[this.station];
  }

  // Radio: jadwalkan not synthwave / chill / talk-blip per station.
  startRadio() {
    if (!this.ctx || this.musicTimer) return;
    const scales = [
      [220, 261.6, 329.6, 392, 440, 523.3], // Neon FM: arpeggio minor cerah
      [196, 246.9, 293.7, 392, 493.9],      // Tide 98: chord lembut
      [330, 330, 392, 330, 262],            // Port Talk: blip percakapan
    ];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const scale = scales[this.station];
      const note = scale[step % scale.length];
      step += 1;
      const dur = this.station === 2 ? 0.08 : 0.22;
      this.tone(note, dur, this.station === 0 ? 'sawtooth' : 'sine', 0.05);
      if (this.station === 0 && step % 4 === 0) this.tone(note / 2, 0.3, 'triangle', 0.07);
      if (this.station === 1 && step % 8 === 0) this.tone(note * 2, 0.5, 'sine', 0.04);
    }, 240);
  }

  // Dengung mesin: pitch mengikuti kecepatan mobil pemain (diatur main loop).
  startEngineHum() {
    if (!this.ctx || this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 40;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 400;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch { /* abaikan */ }
  }

  setEngine(speed01) {
    if (!this.ctx || !this.engineOsc) return;
    this.engineOsc.frequency.value = 40 + speed01 * 140;
    this.engineGain.gain.value = speed01 > 0.02 ? 0.03 + speed01 * 0.05 : 0.0;
  }

  tone(freq, dur, type = 'sine', vol = 0.1) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch { /* abaikan */ }
  }

  noise(dur, vol = 0.15, freq = 1200) {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start();
    } catch { /* abaikan */ }
  }

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shot': this.noise(0.12, 0.25, 3000); this.tone(180, 0.08, 'square', 0.12); break;
      case 'shotFar': this.noise(0.1, 0.08, 1800); break;
      case 'punch': this.noise(0.08, 0.2, 500); break;
      case 'crash': this.noise(0.25, 0.3, 700); break;
      case 'horn': this.tone(370, 0.25, 'square', 0.08); this.tone(466, 0.25, 'square', 0.06); break;
      case 'siren': this.tone(660, 0.4, 'sine', 0.07); setTimeout(() => this.tone(880, 0.4, 'sine', 0.07), 420); break;
      case 'heli': this.noise(0.8, 0.06, 300); break;
      case 'pickup': this.tone(660, 0.09, 'sine', 0.12); setTimeout(() => this.tone(990, 0.12, 'sine', 0.12), 90); break;
      case 'door': this.noise(0.08, 0.12, 900); break;
      case 'mission': this.tone(523, 0.12, 'triangle', 0.12); setTimeout(() => this.tone(784, 0.2, 'triangle', 0.12), 130); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.14), i * 140)); break;
      case 'fail': this.tone(220, 0.3, 'sawtooth', 0.1); setTimeout(() => this.tone(165, 0.4, 'sawtooth', 0.1), 200); break;
      case 'hurt': this.tone(140, 0.15, 'sawtooth', 0.12); break;
      case 'kill': this.tone(392, 0.1, 'square', 0.08); break;
      case 'busted': [440, 349, 294].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sawtooth', 0.1), i * 180)); break;
      case 'wasted': [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sawtooth', 0.1), i * 220)); break;
      case 'shop': this.tone(880, 0.1, 'sine', 0.1); setTimeout(() => this.tone(1175, 0.15, 'sine', 0.1), 100); break;
      case 'save': this.tone(784, 0.12, 'sine', 0.1); setTimeout(() => this.tone(1047, 0.18, 'sine', 0.1), 120); break;
      case 'empty': this.tone(220, 0.06, 'square', 0.08); break;
      case 'station': this.tone(1047, 0.08, 'sine', 0.08); break;
      case 'nos': this.noise(0.5, 0.2, 5000); this.tone(1200, 0.4, 'sawtooth', 0.05); break;
      case 'rain': this.noise(1.2, 0.04, 2500); break;
      default: break;
    }
  }
}
