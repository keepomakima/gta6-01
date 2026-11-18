// NEON TIDE v5 — rain weather. Intensity 0..1; diagonal streaks, wet
// shiny roads, and automatic rain at night. setRain is the debug/manual
// override; night rain only fills in when nothing was set manually.
export function makeWeather() {
  return { rain: 0, manual: false, drops: [], t: 0 };
}

export function setRain(w, v) {
  w.rain = Math.max(0, Math.min(1, v));
  w.manual = true;
}

export function isRaining(w) { return w.rain > 0.05; }

export function updateWeather(w, dt, isNight) {
  w.t += dt;
  if (!w.manual && isNight) w.rain = Math.min(w.rain + dt * 0.05, 0.35);
  if (!w.manual && !isNight) w.rain = Math.max(0, w.rain - dt * 0.1);
  // Keep a pool of drops proportional to intensity.
  const want = Math.floor(w.rain * 260);
  while (w.drops.length < want) {
    w.drops.push({ x: Math.random() * 1400, y: Math.random() * 800, s: 500 + Math.random() * 300 });
  }
  if (w.drops.length > want) w.drops.length = want;
  for (const d of w.drops) {
    d.y += d.s * dt;
    d.x -= d.s * 0.28 * dt;
    if (d.y > 760) { d.y = -20; d.x = 200 + Math.random() * 1400; }
    if (d.x < -20) d.x = 1300;
  }
}

export function drawRain(ctx, w, vw, vh) {
  if (w.rain <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(170,200,235,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const d of w.drops) {
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - 7, d.y + 15);
  }
  ctx.stroke();
  ctx.restore();
}
