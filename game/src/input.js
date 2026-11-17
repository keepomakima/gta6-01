// NEON TIDE — input.js
// Keyboard + mouse state, tracked once per frame. The game reads this object
// instead of touching DOM events directly, which also lets the screenshot
// autopilot drive the same inputs synthetically.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // keys pressed since the last frame was consumed
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    // Virtual keys the autopilot can set (same names as real keys).
    virtual: new Set(),
    // True while the key is held, real or virtual.
    down(code) {
      return this.keys.has(code) || this.virtual.has(code);
    },
    // True once, on the frame the key went down.
    hit(code) {
      return this.pressed.has(code);
    },
    // True while any of the given keys is held.
    any(codes) {
      return codes.some((c) => this.down(c));
    },
    // Forget every held and pressed key (for example when the game pauses).
    reset() {
      this.keys.clear();
      this.pressed.clear();
      this.virtual.clear();
      this.mouseDown = false;
      this.mousePressed = false;
    },
    // Called at the end of each frame by the main loop.
    endFrame() {
      this.pressed.clear();
      this.mousePressed = false;
    },
    // Autopilot helper: hold a virtual key.
    setVirtual(code, on) {
      if (on) this.virtual.add(code);
      else this.virtual.delete(code);
    },
    clearVirtual() {
      this.virtual.clear();
    },
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.mousePressed = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

// Movement intent from WASD / arrows, as a unit-ish vector.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.down('KeyA') || input.down('ArrowLeft')) x -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) x += 1;
  if (input.down('KeyW') || input.down('ArrowUp')) y -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
