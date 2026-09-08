// ---------------------------------------------------------------------------
// Touch controls: a left-thumb joystick, drag-anywhere-on-the-right to look,
// and buttons for jump / sprint / respawn / camera.
//
// Multi-touch is tracked by pointerId so looking and moving work at the same
// time, which is the thing most browser games get wrong on a phone.
// ---------------------------------------------------------------------------
export class TouchControls {
  constructor(root, opts = {}) {
    this.root = root;
    this.enabled = false;
    this.sensitivity = opts.sensitivity ?? 0.006;
    this.onAction = opts.onAction || (() => {});

    this.moveX = 0; this.moveY = 0;
    this.jumpHeld = false;
    this.sprint = true;              // sprint is ON by default on phones
    this.dYaw = 0; this.dPitch = 0;

    this.stickId = null; this.stickOrigin = { x: 0, y: 0 };
    this.lookId = null;  this.lookLast = { x: 0, y: 0 };
    this.radius = 58;

    this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'touch-ui';
    el.innerHTML = `
      <div class="stick-zone"></div>
      <div class="stick"><div class="stick-base"></div><div class="stick-knob"></div></div>
      <div class="btn btn-jump" data-act="jump">JUMP</div>
      <div class="btn btn-sprint" data-act="sprint">RUN</div>
      <div class="btn btn-small btn-respawn" data-act="respawn">&#8635;</div>
      <div class="btn btn-small btn-cam" data-act="camera">&#128247;</div>`;
    this.root.appendChild(el);
    this.el = el;
    this.stick = el.querySelector('.stick');
    this.knob = el.querySelector('.stick-knob');
    this.sprintBtn = el.querySelector('.btn-sprint');
    this.sprintBtn.classList.add('on');

    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

    for (const btn of el.querySelectorAll('.btn')) {
      const act = btn.dataset.act;
      btn.addEventListener('pointerdown', (e) => {
        stop(e); btn.setPointerCapture(e.pointerId); btn.classList.add('pressed');
        if (act === 'jump') this.jumpHeld = true;
        else if (act === 'sprint') {
          this.sprint = !this.sprint;
          this.sprintBtn.classList.toggle('on', this.sprint);
        } else this.onAction(act);
      });
      const release = (e) => {
        btn.classList.remove('pressed');
        if (act === 'jump') this.jumpHeld = false;
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    }

    // Everything else on the screen: left half drives the stick, right half looks.
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.btn')) return;
      stop(e);
      const leftHalf = e.clientX < window.innerWidth * 0.45;
      if (leftHalf && this.stickId === null) {
        this.stickId = e.pointerId;
        this.stickOrigin = { x: e.clientX, y: e.clientY };
        this.stick.style.left = e.clientX + 'px';
        this.stick.style.top = e.clientY + 'px';
        this.stick.classList.add('active');
      } else if (this.lookId === null) {
        this.lookId = e.pointerId;
        this.lookLast = { x: e.clientX, y: e.clientY };
      }
    }, { passive: false });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) {
        stop(e);
        let dx = e.clientX - this.stickOrigin.x;
        let dy = e.clientY - this.stickOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > this.radius) { dx = dx / len * this.radius; dy = dy / len * this.radius; }
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        // Small dead zone so resting a thumb doesn't creep you off a ledge.
        const nx = dx / this.radius, ny = -dy / this.radius;
        const mag = Math.hypot(nx, ny);
        const k = mag < 0.18 ? 0 : Math.min(1, (mag - 0.18) / 0.62) / (mag || 1);
        this.moveX = nx * k; this.moveY = ny * k;
      } else if (e.pointerId === this.lookId) {
        stop(e);
        this.dYaw -= (e.clientX - this.lookLast.x) * this.sensitivity;
        this.dPitch -= (e.clientY - this.lookLast.y) * this.sensitivity;
        this.lookLast = { x: e.clientX, y: e.clientY };
      }
    }, { passive: false });

    const end = (e) => {
      if (e.pointerId === this.stickId) {
        this.stickId = null; this.moveX = 0; this.moveY = 0;
        this.knob.style.transform = 'translate(0,0)';
        this.stick.classList.remove('active');
      } else if (e.pointerId === this.lookId) this.lookId = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setEnabled(on) {
    this.enabled = on;
    this.el.style.display = on ? 'block' : 'none';
  }

  read() {
    return {
      forward: false, back: false, left: false, right: false,
      moveX: this.moveX, moveY: this.moveY,
      jump: this.jumpHeld,
      sprint: this.sprint,
      sneak: false,
    };
  }

  takeLook() {
    const d = { yaw: this.dYaw, pitch: this.dPitch };
    this.dYaw = 0; this.dPitch = 0;
    return d;
  }
}

export const isTouchDevice = () =>
  window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
