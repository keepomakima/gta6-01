// NEON TIDE v5 — weather.js (BARU v5)
// Cuaca Port Solano: cerah / hujan. Hujan turun sebagai partikel garis
// diagonal + genangan memantul di jalan (digambar render.js) + langit lebih
// gelap. Hujan bisa dipicu otomatis malam hari dan lewat debug (setRain).
// Misi 15 (Neon Mile) selalu hujan — kejar-kejaran di tengah hujan deras.
// Revisi v5.2: setRain mengunci target; updateWeather meluruhkannya pelan.
export function makeWeather() {
  return { rain: 0, target: 0, drops: [], t: 0 };
}

// Atur intensitas hujan 0..1 (0 = cerah, 1 = deras).
export function setRain(G, v) {
  G.weather.target = Math.max(0, Math.min(1, v));
}

export function updateWeather(G, dt) {
  const w = G.weather;
  w.t += dt;
  // Transisi pelan menuju target.
  w.rain += (w.target - w.rain) * Math.min(1, dt * 0.5);
  // Hujan otomatis: malam hari (jam >= 21 atau < 5) kadang hujan.
  if (G.mode === 'play' && !G.shotMode) {
    const night = G.clockHour >= 21 || G.clockHour < 5;
    if (night && w.target === 0 && Math.random() < dt * 0.004) w.target = 0.55;
    if (!night && w.target > 0 && Math.random() < dt * 0.01) w.target = 0;
  }
  // Spawn tetes hujan di sekitar kamera.
  const want = Math.floor(w.rain * 90);
  while (w.drops.length < want) {
    w.drops.push({
      x: G.cam.x + Math.random() * 1400 - 60,
      y: G.cam.y + Math.random() * 800 - 60,
      v: 900 + Math.random() * 300,
    });
  }
  if (w.drops.length > want) w.drops.length = want;
  for (const d of w.drops) {
    d.y += d.v * dt;
    d.x -= d.v * 0.22 * dt; // hujan miring kena angin
    if (d.y > G.cam.y + 780) {
      d.y = G.cam.y - 20;
      d.x = G.cam.x + Math.random() * 1400;
    }
  }
}

// Apakah sedang hujan (untuk HUD + efek suara)?
export function isRaining(G) {
  return G.weather.rain > 0.15;
}
