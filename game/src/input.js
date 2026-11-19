// NEON TIDE v7 "Golden Hour" — input.js
// v7: Enter / Space also advance cutscenes (handled in main.js).
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; };
    this._onMouseDown = (e) => { this.mouse.down = true; this.mouse.clicked = true; };
    this._onMouseUp = () => { this.mouse.down = false; };
  }
  attach(target) {
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('mousedown', this._onMouseDown);
    target.addEventListener('mouseup', this._onMouseUp);
  }
  detach(target) {
    target.removeEventListener('keydown', this._onKeyDown);
    target.removeEventListener('keyup', this._onKeyUp);
    target.removeEventListener('mousemove', this._onMouseMove);
    target.removeEventListener('mousedown', this._onMouseDown);
    target.removeEventListener('mouseup', this._onMouseUp);
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; }
  press(code) { this.keys.add(code); this.pressed.add(code); }
  release(code) { this.keys.delete(code); }

  get up() { return this.down('KeyW') || this.down('ArrowUp'); }
  get dn() { return this.down('KeyS') || this.down('ArrowDown'); }
  get lf() { return this.down('KeyA') || this.down('ArrowLeft'); }
  get rt() { return this.down('KeyD') || this.down('ArrowRight'); }
  get run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  get nos() { return this.run; }
  get handbrake() { return this.down('Space'); }
  get interact() { return this.wasPressed('KeyE'); }
  get shoot() { return this.mouse.down || this.mouse.clicked; }
  get pause() { return this.wasPressed('Escape'); }
  get radioNext() { return this.wasPressed('KeyR'); }
  get advance() { return this.wasPressed('Enter') || this.wasPressed('Space'); }
}

export function tapKey(input, code) {
  input.press(code);
  setTimeout(() => input.release(code), 50);
}
