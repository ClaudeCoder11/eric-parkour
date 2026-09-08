// Keyboard + mouse. Looking around uses Pointer Lock, so the mouse can move
// freely without hitting the edge of the screen.
export class KeyboardMouse {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.keys = new Set();
    this.sensitivity = opts.sensitivity ?? 0.0022;
    this.locked = false;
    this.dYaw = 0; this.dPitch = 0;
    this.taps = [];                       // for double-tap-W to sprint
    this.sprintToggle = false;
    this.onAction = opts.onAction || (() => {});

    this._down = (e) => {
      if (e.repeat) return;
      const c = e.code;
      this.keys.add(c);
      if (c === 'KeyW') {
        const now = performance.now();
        if (now - (this._lastW || 0) < 260) this.sprintToggle = true;
        this._lastW = now;
      }
      if (c === 'KeyV') this.onAction('camera');
      if (c === 'KeyR') this.onAction('respawn');
      if (c === 'Escape') this.onAction('pause');
      if (c === 'KeyP') this.onAction('pause');
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(c)) e.preventDefault();
    };
    this._up = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.sprintToggle = false;
    };
    this._move = (e) => {
      if (!this.locked) return;
      this.dYaw -= e.movementX * this.sensitivity;
      this.dPitch -= e.movementY * this.sensitivity;
    };
    this._lockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.keys.clear(); this.onAction('unlocked'); }
    };

    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    document.addEventListener('mousemove', this._move);
    document.addEventListener('pointerlockchange', this._lockChange);
  }

  requestLock() {
    if (!this.canvas.requestPointerLock) return;
    // Returns a promise in newer browsers and rejects without a user gesture.
    try { Promise.resolve(this.canvas.requestPointerLock()).catch(() => {}); }
    catch { /* older browsers return undefined and throw instead */ }
  }
  exitLock() { try { document.exitPointerLock?.(); } catch { /* ignore */ } }

  read() {
    const k = this.keys;
    const held = (...codes) => codes.some((c) => k.has(c));
    return {
      forward: held('KeyW', 'ArrowUp'),
      back:    held('KeyS', 'ArrowDown'),
      left:    held('KeyA', 'ArrowLeft'),
      right:   held('KeyD', 'ArrowRight'),
      jump:    held('Space'),
      sprint:  held('ControlLeft', 'ControlRight', 'ShiftRight') || this.sprintToggle,
      sneak:   held('ShiftLeft'),
    };
  }

  // Consume accumulated look delta (radians).
  takeLook() {
    const d = { yaw: this.dYaw, pitch: this.dPitch };
    this.dYaw = 0; this.dPitch = 0;
    return d;
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    document.removeEventListener('mousemove', this._move);
    document.removeEventListener('pointerlockchange', this._lockChange);
  }
}
