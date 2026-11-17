// Keyboard and mouse input for NEON TIDE. Held keys are read every frame;
// one-shot presses (enter car, punch, pause, radio, weapon swap) are queued as
// flags and taken once by the loop, so a press between frames is never lost.
// The mouse position is tracked in CSS pixels; main.js converts it to world
// coordinates for aiming.
export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_ENTER = 4;
export const ACT_PUNCH = 8;
export const ACT_RADIO = 16;
export const ACT_WEAPON = 32;
export const ACT_SHOOT = 64;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false, brake: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) {
      held[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACT_CONFIRM;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACT_PAUSE;
    else if (event.code === 'KeyE') actions |= ACT_ENTER;
    else if (event.code === 'KeyF') actions |= ACT_PUNCH;
    else if (event.code === 'KeyR') actions |= ACT_RADIO;
    else if (event.code === 'Digit1' || event.code === 'Digit2') actions |= ACT_WEAPON;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    if (event.button === 0) actions |= ACT_SHOOT;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });

  return {
    held,
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Steering: -1 left, 1 right, 0 neither or both.
    steer() { return (held.right ? 1 : 0) - (held.left ? 1 : 0); },
    // Throttle: 1 forward, -1 back, 0 none.
    throttle() { return (held.up ? 1 : 0) - (held.down ? 1 : 0); },
  };
}
