// NEON TIDE v7 "Golden Hour" — audio.js
const STATIONS = [
  { name: 'Tide FM', scale: [0, 3, 5, 7, 10], bpm: 96, wave: 'triangle' },
  { name: 'Neon Nights', scale: [0, 2, 3, 7, 8], bpm: 122, wave: 'sawtooth' },
  { name: 'Harbor Rock', scale: [0, 5, 7, 10, 12], bpm: 132, wave: 'square' },
];

export function createAudio() {
  return {
    ctx: null, station: 0, radioOn: true, nextNoteAt: 0, noteStep: 0,
    sirenOsc: null, engineOsc: null, engineGain: null,
  };
}

function ensureCtx(A) {
  if (A.ctx) return A.ctx;
  try {
    A.ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { A.ctx = null; }
  return A.ctx;
}

export function resumeAudio(A) {
  const ctx = ensureCtx(A);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function stationName(A) { return STATIONS[A.station].name; }

export function nextStation(A) {
  A.station = (A.station + 1) % STATIONS.length;
  A.noteStep = 0;
}

export function radioTick(S, dt) {
  const A = S.audio;
  if (!A.radioOn || S.ui.screen !== 'playing') return;
  const ctx = ensureCtx(A);
  if (!ctx || ctx.state !== 'running') return;
  const st = STATIONS[A.station];
  const stepDur = 60 / st.bpm / 2;
  A.nextNoteAt -= dt;
  if (A.nextNoteAt > 0) return;
  A.nextNoteAt = stepDur;
  const degree = st.scale[A.noteStep % st.scale.length];
  const octave = 3 + Math.floor(A.noteStep / st.scale.length) % 2;
  const freq = 220 * Math.pow(2, (degree + (octave - 3) * 12) / 12);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = st.wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + stepDur * 0.95);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + stepDur);
  A.noteStep += 1;
}

function blip(A, freq, dur, type = 'sine', vol = 0.12) {
  const ctx = ensureCtx(A);
  if (!ctx || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export function sfxShot(A) { blip(A, 900, 0.09, 'square', 0.1); }
export function sfxPickup(A) { blip(A, 660, 0.12, 'sine', 0.12); blip(A, 990, 0.14, 'sine', 0.1); }
export function sfxCrash(A) { blip(A, 120, 0.25, 'sawtooth', 0.14); }
export function sfxMission(A) {
  blip(A, 523, 0.15, 'sine', 0.12);
  setTimeout(() => blip(A, 784, 0.2, 'sine', 0.12), 140);
}

export function sirenTick(S, dt) {
  const A = S.audio;
  const ctx = ensureCtx(A);
  if (!ctx || ctx.state !== 'running') return;
  if (S.wanted < 2) {
    if (A.sirenOsc) { try { A.sirenOsc.stop(); } catch {} A.sirenOsc = null; }
    return;
  }
  if (!A.sirenOsc) {
    A.sirenOsc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.02;
    A.sirenOsc.type = 'sine';
    A.sirenOsc.connect(g).connect(ctx.destination);
    A.sirenOsc.start();
    A.sirenPhase = 0;
  }
  A.sirenPhase = (A.sirenPhase + dt) % 1;
  A.sirenOsc.frequency.value = A.sirenPhase < 0.5 ? 700 : 950;
}
