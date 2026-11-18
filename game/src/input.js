// NEON TIDE v4 — input: keyboard + mouse state, one polling surface.
// One job: turn raw DOM events into the game's key/mouse queries.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.anyKey = false;
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  down(...names) { return names.some((n) => this.keys.has(n)); }
  wasPressed(...names) { return names.some((n) => this.pressed.has(n)); }
  // consume(key): true once for a press, then forget it (for one-shot actions).
  consume(key) {
    if (this.pressed.has(key)) { this.pressed.delete(key); return true; }
    return false;
  }
  // Axis helpers: -1 / 0 / +1 from key pairs.
  axis(neg, pos) { return (this.down(...pos) ? 1 : 0) - (this.down(...neg) ? 1 : 0); }
  endFrame() { this.pressed.clear(); this.mousePressed = false; this.anyKey = false; }
  // Test/autopilot helper: pretend a key is held.
  fakeDown(key) { this.keys.add(key); }
  fakeUp(key) { this.keys.delete(key); }
  clearAll() { this.keys.clear(); this.pressed.clear(); }
}
