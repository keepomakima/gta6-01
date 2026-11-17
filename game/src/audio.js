// Procedural sound for NEON TIDE: every effect and every radio note is
// synthesised with WebAudio. No audio files, no network, no licensed music.
// The radio is a lookahead step sequencer: radioTick schedules notes a quarter
// second ahead on a timer, so the tune keeps time even when frames stutter.
import { RADIO } from './config.js';

// Short original melodies per station, as scale-degree patterns (0 = rest).
const TUNES = {
  chill: { wave: 'sine', notes: [0, 3, 5, 7, 5, 3, 0, 2, 4, 7, 9, 7, 5, 4, 2, 0], root: 220, bass: [0, 0, 5, 3] },
  drive: { wave: 'square', notes: [0, 0, 3, 0, 5, 0, 7, 5, 3, 0, 3, 5, 7, 10, 7, 5], root: 164.8, bass: [0, 0, 0, 5] },
  swing: { wave: 'triangle', notes: [0, 4, 7, 9, 7, 4, 2, 4, 7, 11, 9, 7, 5, 4, 2, 0], root: 196, bass: [0, 4, 5, 3] },
};
const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];

export function createAudio() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let station = 0;
  let radioOn = true;
  let step = 0;
  let nextStepTime = 0;
  let timer = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.16;
      radioGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, low = 400) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = low;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  function radioTick() {
    if (!ctx || !radioOn) return;
    const tune = TUNES[RADIO[station].style];
    const beat = 60 / RADIO[station].bpm / 2;
    while (nextStepTime < ctx.currentTime + 0.25) {
      const idx = step % tune.notes.length;
      const deg = tune.notes[idx];
      if (deg > 0) {
        const freq = tune.root * SCALE[deg % SCALE.length] * (deg >= 7 ? 2 : 1);
        const o = ctx.createOscillator();
        o.type = tune.wave;
        o.frequency.value = freq;
        const g = ctx.createGain();
        const t = nextStepTime;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.95);
        o.connect(g);
        g.connect(radioGain);
        o.start(t);
        o.stop(t + beat);
      }
      if (step % 4 === 0) {
        const bdeg = tune.bass[(step / 4) % tune.bass.length];
        const bf = (tune.root / 2) * SCALE[bdeg % SCALE.length];
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = bf;
        const g = ctx.createGain();
        const t = nextStepTime;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + beat * 3.8);
        o.connect(g);
        g.connect(radioGain);
        o.start(t);
        o.stop(t + beat * 4);
      }
      nextStepTime += beat;
      step += 1;
    }
  }

  return {
    unlock,
    get stationName() { return RADIO[station].name; },
    get on() { return radioOn; },
    nextStation() {
      station = (station + 1) % RADIO.length;
      step = 0;
      if (ctx) nextStepTime = ctx.currentTime + 0.05;
      return RADIO[station].name;
    },
    toggleRadio() { radioOn = !radioOn; return radioOn; },
    startRadio() {
      if (!ensure()) return;
      nextStepTime = ctx.currentTime + 0.1;
      if (!timer) timer = setInterval(radioTick, 120);
    },
    setEngine(speedRatio, driving) {
      if (!ctx) return;
      engineOsc.frequency.value = 45 + speedRatio * 160;
      engineGain.gain.value = driving ? 0.05 + speedRatio * 0.05 : 0.015;
    },
    setSiren(active, time) {
      if (!ctx) return;
      sirenGain.gain.value = active ? 0.035 : 0;
      if (active) sirenOsc.frequency.value = 650 + 250 * Math.sin(time * 5);
    },
    shoot() { noise(0.12, 0.5, 900); blip(180, 0.08, 'square', 0.25); },
    punch() { noise(0.08, 0.35, 200); blip(90, 0.1, 'sine', 0.4); },
    crash(intensity = 1) { noise(0.25, 0.4 * intensity, 150); },
    pickup() { blip(660, 0.09, 'sine', 0.3); blip(990, 0.14, 'sine', 0.3, 0.08); },
    cash() { blip(880, 0.08, 'sine', 0.3); blip(1174, 0.08, 'sine', 0.3, 0.07); blip(1568, 0.16, 'sine', 0.3, 0.14); },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.35, i * 0.11));
    },
    fail() { blip(220, 0.3, 'sawtooth', 0.25); blip(174, 0.4, 'sawtooth', 0.25, 0.2); },
    click() { blip(1200, 0.04, 'square', 0.15); },
  };
}
