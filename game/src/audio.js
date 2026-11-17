// NEON TIDE — audio.js
// All sound is procedural WebAudio: engine hum, siren, gunshots, pickups and
// three original radio stations built from scheduled oscillator notes. No
// audio files, no network. Audio starts only after the first user gesture.

import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    radioOn: false,
    station: 0,
    engineOsc: null,
    engineGain: null,
    radioTimer: null,
    nextNoteTime: 0,
    noteIndex: 0,

    // Call from a user gesture (click / key) — browsers block AudioContext
    // before that.
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
    },

    // A quiet engine drone whose pitch follows the driven car's speed.
    startEngineLoop() {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    },

    setEngine(speedRatio, inCar) {
      if (!this.ctx || !this.engineOsc) return;
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speedRatio * 0.06 : 0, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 110, t, 0.1);
    },

    // Mute everything at once; the master gain is the single volume knob.
    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    },

    // Short noise burst, used for gunshots and crashes.
    noiseBurst(duration, volume, lowpass) {
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
    },

    // A single oscillator blip with a pitch slide.
    blip(freqFrom, freqTo, duration, type, volume) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freqFrom, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    },

    gunshot() { this.noiseBurst(0.14, 0.5, 2400); this.blip(180, 60, 0.08, 'square', 0.2); },
    punch() { this.noiseBurst(0.08, 0.35, 900); },
    crash() { this.noiseBurst(0.25, 0.5, 700); },
    pickup() { this.blip(660, 990, 0.12, 'sine', 0.3); this.blip(990, 1320, 0.14, 'sine', 0.2); },
    cash() { this.blip(880, 880, 0.07, 'sine', 0.25); this.blip(1174, 1174, 0.07, 'sine', 0.25); this.blip(1568, 1568, 0.16, 'sine', 0.25); },
    missionDone() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => {
        setTimeout(() => this.blip(f, f, 0.22, 'triangle', 0.3), i * 110);
      });
    },
    busted() { this.blip(320, 110, 0.7, 'sawtooth', 0.3); },
    wasted() { this.blip(220, 55, 1.0, 'sawtooth', 0.3); },
    sirenBlip() { this.blip(700, 950, 0.4, 'sine', 0.08); },

    // Radio: a scheduler that plays a looping pentatonic melody per station.
    setRadio(on, stationIndex) {
      this.radioOn = on;
      if (stationIndex !== undefined) this.station = stationIndex;
      if (!this.ctx) return;
      if (on) {
        this.noteIndex = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        if (!this.radioTimer) {
          this.radioTimer = setInterval(() => this.scheduleRadio(), 120);
        }
      } else if (this.radioTimer) {
        clearInterval(this.radioTimer);
        this.radioTimer = null;
      }
    },

    cycleStation() {
      this.station = (this.station + 1) % RADIO_STATIONS.length;
      this.noteIndex = 0;
      return RADIO_STATIONS[this.station];
    },

    // The display name of the station currently playing.
    stationName() {
      return RADIO_STATIONS[this.station].name;
    },

    scheduleRadio() {
      if (!this.ctx || !this.radioOn) return;
      const st = RADIO_STATIONS[this.station];
      const beat = 60 / st.bpm;
      while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
        const step = this.noteIndex;
        const scale = st.scale;
        // A simple deterministic melody: walk the scale, rest on some beats.
        const idx = (step * 2 + Math.floor(step / 4)) % scale.length;
        const octave = step % 8 === 6 ? 12 : 0;
        const midi = st.root + scale[idx] + octave;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        if (step % 4 !== 3) this.playNote(freq, this.nextNoteTime, beat * 0.9, st.wave, 0.10);
        if (step % 8 === 0) this.playNote(freq / 2, this.nextNoteTime, beat * 1.8, 'sine', 0.12);
        this.nextNoteTime += beat;
        this.noteIndex += 1;
      }
    },

    playNote(freq, when, duration, type, volume) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(volume, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(when);
      osc.stop(when + duration + 0.05);
    },
  };
  return audio;
}
