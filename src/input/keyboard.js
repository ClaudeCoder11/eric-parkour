// Keyboard + mouse. Looking around uses Pointer Lock, so the mouse can move
// freely without hitting the edge of the screen.
//
// Held keys live in a Set that is filled by keydown and emptied by keyup, and
// the hard part is that keyup is not guaranteed. A keyup is only delivered to
// a focused window, so anything that steals focus while you are running - an
// OS notification, the "Leave site?" prompt Ctrl+W raises, Mission Control,
// Cmd+Tab - swallows it and leaves the key latched down forever. That is the
// bug where the avatar walks off on its own and only stops while you hold the
// opposite key (forward and back cancel out).
//
// So the Set is treated as a guess that must be able to heal:
//   - anything that can cost us a keyup (blur, tab hide, losing pointer lock,
//     a Cmd chord on macOS) empties it,
//   - a focus check each frame empties it when the window is not focused,
//   - and auto-repeat keydowns re-add keys, so a key you really are holding
//     comes back by itself within a repeat or two. Clearing is therefore cheap:
//     the worst case is a brief stutter, not a stuck key.
const MODIFIERS = {
  Control: ['ControlLeft', 'ControlRight'],
  Shift:   ['ShiftLeft', 'ShiftRight'],
  Alt:     ['AltLeft', 'AltRight'],
  Meta:    ['MetaLeft', 'MetaRight'],
};

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
      const c = e.code;
      this.keys.add(c);                   // auto-repeat re-asserts a dropped key
      this._syncModifiers(e);
      if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(c)) e.preventDefault();

      if (e.repeat) return;               // below here: one press, one action
      if (c === 'KeyW') {
        const now = performance.now();
        if (now - (this._lastW || 0) < 260) this.sprintToggle = true;
        this._lastW = now;
      }
      if (c === 'KeyV') this.onAction('camera');
      if (c === 'KeyR') this.onAction('respawn');
      if (c === 'Escape') this.onAction('pause');
      if (c === 'KeyP') this.onAction('pause');
      if (c === 'KeyF') this.onAction('fullscreen');
    };
    this._up = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyW') this.sprintToggle = false;
      // macOS does not deliver keyup for keys that were held while Cmd was
      // down, so every one of them is latched by the time Cmd comes back up.
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') this.clearKeys();
      else this._syncModifiers(e);
    };
    this._move = (e) => {
      if (!this.locked) return;
      this.dYaw -= e.movementX * this.sensitivity;
      this.dPitch -= e.movementY * this.sensitivity;
    };
    this._lockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.clearKeys(); this.onAction('unlocked'); }
    };
    this._blur = () => this.clearKeys();
    this._visibility = () => { if (document.hidden) this.clearKeys(); };

    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
    document.addEventListener('visibilitychange', this._visibility);
    document.addEventListener('mousemove', this._move);
    document.addEventListener('pointerlockchange', this._lockChange);
  }

  // Drop every key we think is held. Safe to call at any time: a key that is
  // genuinely down re-adds itself on its next auto-repeat.
  clearKeys() {
    this.keys.clear();
    this.sprintToggle = false;
  }

  // Modifier state rides along on every key event, so a Ctrl or Shift that was
  // released while we weren't looking can be caught on the next keystroke.
  _syncModifiers(e) {
    if (!e.getModifierState) return;
    for (const name of Object.keys(MODIFIERS)) {
      if (e.getModifierState(name)) continue;
      for (const code of MODIFIERS[name]) this.keys.delete(code);
    }
  }

  // Called once a frame. The only way a keyup goes missing is that the window
  // wasn't focused to receive it, so an unfocused window holds no keys.
  pollFocus() {
    if (this.keys.size && document.hasFocus && !document.hasFocus()) this.clearKeys();
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
    window.removeEventListener('blur', this._blur);
    document.removeEventListener('visibilitychange', this._visibility);
    document.removeEventListener('mousemove', this._move);
    document.removeEventListener('pointerlockchange', this._lockChange);
  }
}
