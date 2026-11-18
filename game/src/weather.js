// NEON TIDE v6 — weather + clock. Rain intensity 0..1 (diagonal rain in the
// world, wet-road sheen via darker road colour at night), automatic rain at
// night, and a 24h clock that drives the day/night cycle (1 game hour = 60
// real seconds; the clock also feeds the HUD).
import { clamp } from './rng.js';

export class Weather {
  constructor(world) {
    this.world = world;
    this.rain = 0;
    this.rainAuto = true;
    this.timeOfDay = 19.5; // start at dusk
  }
  setRain(v) { this.rain = clamp(v, 0, 1); }
  update(dt) {
    this.timeOfDay = (this.timeOfDay + dt / 60) % 24;
    this.world.timeOfDay = this.timeOfDay;
    if (this.rainAuto) {
      const night = this.timeOfDay < 6 || this.timeOfDay > 18.5;
      const target = night ? 0.45 : 0;
      this.rain = clamp(this.rain + (target - this.rain) * dt * 0.2, 0, 1);
    }
    this.world.rainIntensity = this.rain;
  }
  clockString() {
    const h = Math.floor(this.timeOfDay);
    const m = Math.floor((this.timeOfDay - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
}
