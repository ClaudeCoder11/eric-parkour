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
    this.wantLock = false;       // we asked for the mouse and still want it
    this.lockPending = false;    // ...but the browser said no; retry on a gesture
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
      const had = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) { this.lockPending = false; this.onAction('locked'); return; }
      this.clearKeys();
      // Only a lock we actually held and then lost means "the player stepped
      // away" and should pause. A refused request fires this event too, and
      // pausing on that puts the game in a loop: resume asks again, is refused
      // again, and pauses again.
      if (had) this.onAction('unlocked');
    };
    // A refused request fires this and resolves nothing, so without it the
    // game would sit in a level with a free mouse and never know.
    this._lockError = () => this._lockRefused();
    // Browsers only grant pointer lock off a user gesture, so a refusal waits
    // for the next one rather than retrying into the same wall every frame.
    this._gesture = () => {
      if (this.lockPending && this.wantLock && !this.locked) this._attemptLock();
    };
    this._blur = () => this.clearKeys();
    this._visibility = () => { if (document.hidden) this.clearKeys(); };

    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
    document.addEventListener('visibilitychange', this._visibility);
    document.addEventListener('mousemove', this._move);
    document.addEventListener('pointerlockchange', this._lockChange);
    document.addEventListener('pointerlockerror', this._lockError);
    window.addEventListener('pointerdown', this._gesture);
    window.addEventListener('keydown', this._gesture);
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

  // Ask for the mouse. Browsers refuse this more often than you'd think: for a
  // moment after the player drops the lock with Esc, when the call isn't close
  // enough to a user gesture, or when the page isn't focused. The refusal is
  // silent - no exception, and a promise that may never settle - so the old
  // one-shot request could leave you in a level with a free cursor for good.
  // Remember that we want it, and take the next gesture we're offered.
  requestLock() {
    if (!this.canvas.requestPointerLock) return;
    this.wantLock = true;
    if (this.locked) return;
    this._attemptLock();
  }

  _attemptLock() {
    try {
      const r = this.canvas.requestPointerLock();
      // Newer browsers return a promise; older ones return undefined and throw.
      Promise.resolve(r).catch(() => this._lockRefused());
    } catch { this._lockRefused(); }
  }

  _lockRefused() {
    if (!this.wantLock || this.locked) return;
    const first = !this.lockPending;
    this.lockPending = true;
    if (first) this.onAction('lock-refused');
  }

  // Giving up the mouse on purpose - pausing, winning, switching to touch.
  // Clears the want, so the gesture retry doesn't snatch it straight back.
  exitLock() {
    this.wantLock = false;
    this.lockPending = false;
    try { document.exitPointerLock?.(); } catch { /* ignore */ }
  }

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
    document.removeEventListener('pointerlockerror', this._lockError);
    window.removeEventListener('pointerdown', this._gesture);
    window.removeEventListener('keydown', this._gesture);
  }
}
