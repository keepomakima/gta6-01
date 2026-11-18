// NEON TIDE — helicopter.js
// Helikopter polisi AIR-1 (baru di v4): muncul di wanted 4-5, mengunci pemain
// dengan spotlight cone, rotor wash (partikel + goyangan kamera), dan
// memperlambat penurunan wanted selama sorotan menempel.
export function makeHeli() {
  return {
    x: 0, y: 0, angle: 0, active: false, rotorT: 0,
    lockT: 0, name: 'AIR-1', hoverR: 170, speed: 260,
  };
}

// Update helikopter: terbang di atas pemain, spotlight mengunci bila dekat.
// Revisi: lockT meluruh pelan supaya indikator SPOTLIGHT tidak berkedip.
export function updateHeli(G, dt) {
  const heli = G.heli;
  const p = G.player;
  if (G.wantedLevel >= 4 && G.mode === 'play') {
    if (!heli.active) {
      heli.active = true;
      heli.x = p.x - 260;
      heli.y = p.y - 260;
      G.dialog = { name: 'PSPD Dispatch', role: 'Radio Polisi', text: 'AIR-1 di udara. Spotlight mengunci Marlowe — jangan sampai lolos.', t: 0 };
      G.audio.sfx('heli');
    }
  } else if (heli.active && G.wantedLevel < 4) {
    heli.active = false;
    heli.lockT = 0;
  }
  if (!heli.active) return;
  heli.rotorT += dt;
  // Terbang mendekat lalu hover melingkar di atas pemain.
  const d = Math.hypot(p.x - heli.x, p.y - heli.y);
  const want = Math.atan2(p.y - heli.y, p.x - heli.x);
  let da = want - heli.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  heli.angle += da * Math.min(1, dt * 2);
  if (d > heli.hoverR) {
    heli.x += Math.cos(want) * heli.speed * dt;
    heli.y += Math.sin(want) * heli.speed * dt;
  } else {
    // Orbit pelan di atas pemain.
    const orbit = heli.rotorT * 0.35;
    heli.x = p.x + Math.cos(orbit) * heli.hoverR;
    heli.y = p.y + Math.sin(orbit) * heli.hoverR;
  }
  // Spotlight mengunci bila heli dalam 320px: wanted tidak turun.
  if (d < 340) {
    heli.lockT += dt;
    G.lastSeenT = 0;
    G.spotlightOn = true;
  } else {
    heli.lockT = Math.max(0, heli.lockT - dt);
    G.spotlightOn = heli.lockT > 0.5;
  }
  // Rotor wash: partikel debu + goyangan halus saat heli dekat.
  if (d < 420 && Math.random() < 0.5) {
    G.particles.burst(p.x + (Math.random() - 0.5) * 120, p.y + (Math.random() - 0.5) * 120, 'dust', 1);
  }
  if (d < 260) G.shake = Math.max(G.shake, 1.5);
}

// Apakah spotlight sedang mengunci pemain (untuk HUD + render)?
export function spotlightLocked(G) {
  return !!(G.heli && G.heli.active && G.spotlightOn);
}
