// NEON TIDE v6 — keyboard + mouse input. Keys are tracked by code; the
// playtest drives the same state through inject()/release()/pressed so the
// game never needs real hardware to prove a system works.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed each frame by main
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => { this.mouseX = e.clientX; this.mouseY = e.clientY; };
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
  }
  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }
  // Movement axes: W/Up forward, S/Down back, A/Left, D/Right.
  get up() { return this.keys.has('KeyW') || this.keys.has('ArrowUp'); }
  get dn() { return this.keys.has('KeyS') || this.keys.has('ArrowDown'); }
  get lf() { return this.keys.has('KeyA') || this.keys.has('ArrowLeft'); }
  get rt() { return this.keys.has('KeyD') || this.keys.has('ArrowRight'); }
  get run() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get nos() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get handbrake() { return this.keys.has('Space'); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouseClicked = false; }
  // Test hooks: inject('w') holds a key, release() lets go.
  inject(codes) { for (const c of codes) this.keys.add(c === 'w' ? 'KeyW' : c === 'a' ? 'KeyA' : c === 's' ? 'KeyS' : c === 'd' ? 'KeyD' : c === 'shift' ? 'ShiftLeft' : c === 'space' ? 'Space' : c); }
  release(codes) { for (const c of codes) this.keys.delete(c === 'w' ? 'KeyW' : c === 'a' ? 'KeyA' : c === 's' ? 'KeyS' : c === 'd' ? 'KeyD' : c === 'shift' ? 'ShiftLeft' : c === 'space' ? 'Space' : c); }
}
