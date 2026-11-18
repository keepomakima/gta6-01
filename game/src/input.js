// NEON TIDE v5 — keyboard + mouse input. One shared object; every module
// reads the same getters so driving, shooting and menus never disagree.
// Shift doubles as run (on foot) and NOS boost (in a car with a NOS kit).
export function makeInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouse: { x: 640, y: 360, down: false, clicked: false },
    // Movement getters (WASD + arrows).
    get up() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    get dn() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    get lf() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    get rt() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    get run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get nos() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get handbrake() { return keys.has('Space'); },
    get interact() { return keys.has('KeyE'); },
    get any() { return keys.size > 0; },
    pressed(code) { return keys.has(code); },
    consume(code) { keys.delete(code); },
  };
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    input._anyKey = true;
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouse.down = false; });
  return input;
}
