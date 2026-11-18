// NEON TIDE v5 — input.js
// Keyboard + mouse untuk desktop: WASD/arrows jalan & mengemudi, Shift lari
// (jalan kaki) / NOS boost (mengemudi), Space handbrake, E interaksi, R ganti
// radio, 1-4 ganti senjata, Esc pause, klik kiri menembak (tahan = auto).
// Ditulis fresh untuk v5. Revisi v5.2: pressed dibersihkan tiap endFrame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 640;
    this.mouseY = 360;
    this.mouseDown = false;
    this.pressed = new Set(); // tombol yang baru ditekan frame ini
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (window.__game && window.__game.audio) window.__game.audio.ensure();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }

  // Pintasan arah + Shift/Space (dipakai driveCar: nos = Shift, handbrake = Space).
  // Revisi v5.3: getter ini sempat hilang dari input.js — NOS dan handbrake
  // tidak pernah aktif sampai ditambahkan kembali.
  get up() { return this.down('KeyW') || this.down('ArrowUp'); }
  get dn() { return this.down('KeyS') || this.down('ArrowDown'); }
  get lf() { return this.down('KeyA') || this.down('ArrowLeft'); }
  get rt() { return this.down('KeyD') || this.down('ArrowRight'); }
  get run() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  get nos() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  get handbrake() { return this.down('Space'); }

  // Arah gerak dari WASD/arrows, ternormalisasi. {x, y} atau null bila diam.
  moveDir() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  // Sudut aim mouse dalam koordinat dunia (butuh kamera top-left).
  aimAngle(cam, px, py) {
    const wx = cam.x + this.mouseX;
    const wy = cam.y + this.mouseY;
    return Math.atan2(wy - py, wx - px);
  }

  // Posisi mouse dalam koordinat dunia.
  mouseWorld(cam) {
    return { x: cam.x + this.mouseX, y: cam.y + this.mouseY };
  }
}
