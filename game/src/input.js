// NEON TIDE v7-coverfix — input.js (structural pass)
// Keyboard + mouse state for the game and the debug API. Keys are read
// by code (WASD/arrows, Shift, Space, E, R, Enter, Escape); `pressed`
// is the edge-triggered set, cleared at the end of every frame.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }
  _onKeyDown(e) {
    if (e.repeat) return;
    this.keys.add(e.code);
    this.pressed.add(e.code);
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') e.preventDefault();
  }
  _onKeyUp(e) { this.keys.delete(e.code); }
  _onMouseMove(e) { this.mouse.x = e.clientX; this.mouse.y = e.clientY; }
  _onMouseDown(e) { this.mouse.down = true; this.mouse.clicked = true; }
  _onMouseUp() { this.mouse.down = false; }
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
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
  press(code) {
    this.keys.add(code);
    this.pressed.add(code);
  }
  release(code) { this.keys.delete(code); }

  // Movement: WASD or arrows; Shift runs — and Shift is also NOS.
  get up() { return this.down('KeyW') ? true : this.down('ArrowUp'); }
  get dn() { return this.down('KeyS') ? true : this.down('ArrowDown'); }
  get lf() { return this.down('KeyA') ? true : this.down('ArrowLeft'); }
  get rt() { return this.down('KeyD') ? true : this.down('ArrowRight'); }
  get run() { return this.down('ShiftLeft') ? true : this.down('ShiftRight'); }
  get nos() { return this.run; }
  get handbrake() { return this.down('Space'); }
  // Actions: E interacts, mouse shoots, Esc pauses, R changes station,
  // Enter / Space advance cutscenes.
  get interact() { return this.wasPressed('KeyE'); }
  get shoot() { return this.mouse.down ? true : this.mouse.clicked; }
  get pause() { return this.wasPressed('Escape'); }
  get radioNext() { return this.wasPressed('KeyR'); }
  get advance() { return this.wasPressed('Enter') ? true : this.wasPressed('Space'); }
}

// A synthetic tap for the debug API and the playtest: press, release
// 50 ms later.
export function tapKey(input, code) {
  input.press(code);
  setTimeout(function () { input.release(code); }, 50);
}
