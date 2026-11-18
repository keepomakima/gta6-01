// NEON TIDE v4 — helicopter: the PSPD air unit at 4-5 stars.
// One job: hover over the player, sweep a spotlight cone, and keep the heat on.
export function makeHelicopter() {
  return {
    active: false, x: 0, y: 0, angle: 0, dist: 0,
    spotOn: false, rotor: 0, sweepT: 0, bobT: 0,
  };
}

export function updateHelicopter(G, dt) {
  const h = G.heli;
  const p = G.player;
  if (G.wanted >= 4 && G.mode === 'play') {
    if (!h.active) {
      h.active = true;
      h.x = p.x + 300;
      h.y = p.y - 300;
      G.audio.sfx('heli');
      G.particles.popup(p.x, p.y - 60, 'AIR-1 ON SCENE', '#ff5d5d', true);
    }
    h.bobT += dt;
    h.rotor += dt * 30;
    // The heli trails the player with a slow lag, never teleporting.
    const tx = p.x + Math.sin(h.bobT * 0.7) * 90;
    const ty = p.y + Math.cos(h.bobT * 0.5) * 90 - 40;
    h.x += (tx - h.x) * Math.min(1, dt * 0.9);
    h.y += (ty - h.y) * Math.min(1, dt * 0.9);
    h.dist = Math.hypot(p.x - h.x, p.y - h.y);
    h.angle = Math.atan2(p.y - h.y, p.x - h.x);
    // Rotor wash: dust kicked up under the helicopter while it hovers low.
    if (h.dist < 300 && Math.random() < dt * 8) {
      G.particles.spawn(h.x + (Math.random() - 0.5) * 60, h.y + 30, { n: 1, speed: 50, life: 0.7, size: 6, color: '#b8a888' });
    }
    // Spotlight sweeps and locks on: once locked, heat cannot decay.
    h.sweepT += dt;
    const lock = Math.sin(h.sweepT * 0.8) > -0.2;
    h.spotOn = lock && h.dist < 420;
    if (h.spotOn && Math.random() < dt * 0.4) {
      G.particles.popup(p.x, p.y - 46, 'SPOTLIGHT ON YOU', '#ffe066', false);
    }
  } else if (h.active) {
    // Fly away and switch off when the heat drops.
    h.x += Math.cos(h.angle) * -200 * dt;
    h.y += -200 * dt;
    h.rotor += dt * 20;
    if (Math.hypot(h.x - p.x, h.y - p.y) > 900) { h.active = false; h.spotOn = false; }
  }
}
