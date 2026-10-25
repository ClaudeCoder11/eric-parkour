// ---------------------------------------------------------------------------
// Game shell: renderer, the fixed-timestep loop, and the play/pause/win states.
//
// The simulation runs at exactly 20 ticks per second no matter the display
// refresh rate; rendering interpolates between the last two ticks. That is what
// makes a 4-block jump behave identically on a 60 Hz laptop and a 120 Hz phone.
// ---------------------------------------------------------------------------
import * as THREE from '../lib/three.module.js';
import * as C from './constants.js';
import { Player } from './player.js';
import { PlayerCamera } from './camera.js';
import { Avatar } from './avatar.js';
import { buildWorldMesh } from './world/mesher.js';
import { loadLevel, BIOMES } from './world/level.js';
import { LEVELS } from './levels/index.js';
import { KeyboardMouse } from './input/keyboard.js';
import { TouchControls, isTouchDevice } from './input/touch.js';
import { toggleFullscreen, installLeaveGuard } from './input/screen.js';
import { HUD } from './ui/hud.js';
import { MovingPlatform, updatePlatforms } from './mechanics/platforms.js';
import { save, fmtTime } from './save.js';
import { EndlessCourse, parseSeed } from './endless/generator.js';
import { audio } from './audio.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    // The respawn fade sheet is a sibling of #ui, not a child of it, so it has
    // to be found from the document. Looked up once: this is touched every
    // frame of a fade.
    this.fadeEl = document.getElementById('fade');

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));   // phones: cap at 2
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new PlayerCamera(save.settings.fov);
    this.camera.mode = save.settings.camera || 'first';

    // The character you see in third person. scene.clear() drops it on every
    // level load, so it is re-added alongside the level mesh.
    this.avatar = new Avatar();

    this.hud = new HUD(uiRoot.querySelector('#hud'));
    this.state = 'menu';           // menu | playing | paused | dead | won
    this.levelMesh = null;
    this.level = null;
    this.platforms = [];
    this.player = null;

    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.ticks = 0;
    this.deaths = 0;
    this.checkpointIndex = 0;
    this.fadeAlpha = 0;

    this.touch = new TouchControls(uiRoot, {
      onAction: (a) => this.action(a),
      sensitivity: 0.006 * save.settings.sensitivity,
    });
    this.touch.setEnabled(false);
    this.keys = new KeyboardMouse(canvas, {
      onAction: (a) => this.action(a),
      sensitivity: 0.0022 * save.settings.sensitivity,
    });

    this.setControls(save.settings.controls);

    // Ctrl+W is a sprint-and-run away from closing the tab on Windows, so
    // make the browser ask first - but only when there's a run to lose.
    installLeaveGuard(() => this.state === 'playing' || this.state === 'paused');

    addEventListener('resize', () => this.resize());
    this.resize();

    this._frame = this._frame.bind(this);
    requestAnimationFrame(this._frame);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.resize(w, h);
  }

  // ------------------------------------------------------------------------
  loadLevel(def) {
    if (this.levelMesh) {
      this.scene.remove(this.levelMesh);
      this.levelMesh.userData.dispose();
    }
    for (const p of this.platforms) if (p.mesh) p.mesh.userData.dispose();
    this.platforms = [];
    this.scene.clear();

    if (this.endless) { this.endless.dispose(); this.endless = null; }
    this.level = loadLevel(def);
    const biome = this.level.biome;

    this._applyBiome(biome);

    this.levelMesh = buildWorldMesh(this.level.world, { tint: this.level.tint });
    this.scene.add(this.levelMesh);
    this.scene.add(this.avatar.group);

    // Piston platforms are separate meshes so they can move without a rebuild.
    this.platforms = (this.level.platforms || []).map((d) => new MovingPlatform(d));
    for (const p of this.platforms) this.scene.add(p.buildMesh());
    this.level.world.dynamic = [];

    this.player = new Player(this.level.world);
    this.player.assist = save.settings.assist;
    this.checkpointIndex = 0;
    this.deaths = 0;
    this.ticks = 0;
    this.respawn(true);
    this.player.yaw = (this.level.spawnYaw || 0) * Math.PI / 2;

    const num = LEVELS.indexOf(def) + 1;
    this.hud.setLevel(num > 0 ? `Level ${num}` : 'Level', biome.name);
    if (save.settings.showHints && this.level.hint) this.hud.showHint(this.level.hint, 9000);

    this.state = 'playing';
    if (!this.isTouch) this.keys.requestLock();
    console.log(`[${this.level.name}] ${this.level.world.size} blocks, ` +
                `${this.levelMesh.userData.faceCount} faces drawn`);
  }

  /** Endless mode: an infinite generated course with checkpoints. */
  startEndless(seedText) {
    if (this.levelMesh) {
      this.scene.remove(this.levelMesh);
      this.levelMesh.userData.dispose();
      this.levelMesh = null;
    }
    for (const p of this.platforms) if (p.mesh) p.mesh.userData.dispose();
    this.platforms = [];
    if (this.endless) this.endless.dispose();
    this.scene.clear();

    this.scene.add(this.avatar.group);

    const seed = parseSeed(seedText);
    this.endless = new EndlessCourse(this.scene, { seed, unlocked: save.data.unlocked });
    this.endless.update({ x: 0, z: 0 });

    // The rest of the game only knows about `this.level`, so give it one.
    this.level = {
      name: 'Endless', def: null, parTime: Infinity, hint: '', tint: {},
      biome: this.endless.biome, biomeId: this.endless.biomeId,
      world: this.endless.world, checkpoints: this.endless.checkpoints,
      goal: null, platforms: [],
      spawn: this.endless.spawn, spawnYaw: 0,
    };
    this._applyBiome(this.level.biome);

    this.player = new Player(this.endless.world);
    this.player.assist = save.settings.assist;
    this.checkpointIndex = 0;
    this.deaths = 0;
    this.ticks = 0;
    this.respawn(true);
    this.player.yaw = 0;

    this.hud.setLevel('Endless', `seed ${seed}`);
    if (save.settings.showHints)
      this.hud.showHint(`Endless run · seed ${seed} · checkpoint every 10 platforms`, 8000);
    this.state = 'playing';
    if (!this.isTouch) this.keys.requestLock();
  }

  _applyBiome(biome) {
    this.scene.background = new THREE.Color(biome.sky);
    this.scene.fog = new THREE.Fog(biome.fog, biome.fogNear, biome.fogFar);
  }

  respawn(silent = false) {
    const cp = this.level.checkpoints[this.checkpointIndex];
    this.player.setPos(cp.x, cp.y, cp.z);
    this.player.effects.speed = 0;
    this.player.effects.jump_boost = 0;
    this.player.effects.slow_falling = 0;
    this.fadeAlpha = silent ? 0 : 1;
    this.state = 'playing';
  }

  action(a) {
    if (a === 'camera') {
      const m = this.camera.toggle();
      save.set('settings.camera', m);
      this.hud.showToast(m === 'first' ? 'First person' : 'Third person', 1100);
    } else if (a === 'respawn') {
      if (this.state === 'playing') { this.player.kill('manual'); }
    } else if (a === 'fullscreen') {
      this.toggleFullscreen();
    } else if (a === 'pause') {
      this.togglePause();
    } else if (a === 'unlocked') {
      if (this.state === 'playing' && !this.isTouch) this.togglePause(true);
    }
  }

  // Fullscreen also turns on Keyboard Lock where the browser has it, which
  // is the only way Ctrl+W can be stopped from closing the tab.
  async toggleFullscreen() {
    const r = await toggleFullscreen();
    if (!r.ok) this.hud.showToast('This browser will not allow fullscreen here', 1800);
    else if (!r.on) this.hud.showToast('Left fullscreen', 1200);
    else this.hud.showToast(r.locked ? 'Fullscreen - Ctrl+W is safe now'
                                     : 'Fullscreen - Ctrl+W still closes the tab here', 1800);
    if (r.on && this.state === 'playing' && !this.isTouch) this.keys.requestLock();
  }

  togglePause(force) {
    if (this.state === 'playing' || force === true) {
      this.state = 'paused';
      this.uiRoot.querySelector('#pause').classList.add('show');
      if (!this.isTouch) this.keys.exitLock();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.uiRoot.querySelector('#pause').classList.remove('show');
      if (!this.isTouch) this.keys.requestLock();
    }
  }

  // ------------------------------------------------------------------------
  // 'auto' trusts the browser, which reports a touchscreen laptop as touch and
  // then hides the mouse look behind the on-screen buttons. The explicit modes
  // let you overrule that.
  setControls(mode) {
    this.controls = mode === 'keyboard' || mode === 'touch' ? mode : 'auto';
    this.isTouch = this.controls === 'touch' ? true
                 : this.controls === 'keyboard' ? false
                 : isTouchDevice();
    this.touch.setEnabled(this.isTouch);
    if (this.isTouch) this.keys.exitLock();
    else if (this.state === 'playing') this.keys.requestLock();
  }

  // ------------------------------------------------------------------------
  readInput() {
    if (this.isTouch) {
      const t = this.touch.read();
      const k = this.keys.read();
      // Both work at once, so a tablet with a keyboard is fine.
      return {
        ...t,
        forward: k.forward, back: k.back, left: k.left, right: k.right,
        jump: t.jump || k.jump,
        sprint: t.sprint || k.sprint,
        sneak: k.sneak,
      };
    }
    return this.keys.read();
  }

  applyLook() {
    const a = this.keys.takeLook();
    const b = this.touch.takeLook();
    const p = this.player;
    p.yaw += a.yaw + b.yaw;
    p.pitch += a.pitch + b.pitch;
    const lim = Math.PI / 2 - 0.001;
    p.pitch = Math.max(-lim, Math.min(lim, p.pitch));
  }

  tick() {
    const p = this.player;

    // Move the pistons first, then hand the player any platform motion to ride.
    if (this.platforms.length) {
      const carry = updatePlatforms(this.platforms, this.level.world, this.ticks, p);
      p.platformPush.x += carry[0];
      p.platformPush.y += carry[1];
      p.platformPush.z += carry[2];
    }
    const input = this.state === 'playing' ? this.readInput()
                                           : { forward: false, back: false, left: false,
                                               right: false, jump: false, sprint: false, sneak: false };
    const fellFast = p.vel.y < -0.5;
    p.tick(input);
    this.ticks++;

    if (p.jumpedThisTick) audio.jump(p.groundBlock ? p.groundBlock.id : 'default');
    if (p.justLanded) audio.land(p.groundBlock ? p.groundBlock.id : 'default', fellFast);
    if (p.bounced) audio.bounce();
    if (p.inWater && !this._wasInWater) audio.splash();
    this._wasInWater = p.inWater;
    audio.footsteps(p);

    // Checkpoints: standing on or in one advances your respawn point.
    const bx = Math.floor(p.pos.x), by = Math.floor(p.pos.y), bz = Math.floor(p.pos.z);
    for (let dy = -1; dy <= 1; dy++) {
      const b = this.level.world.get(bx, by + dy, bz);
      if (!b) continue;
      if (b.id === 'checkpoint') {
        const idx = this.level.checkpoints.findIndex(
          (c) => Math.abs(c.x - (b.x + 0.5)) < 0.6 && Math.abs(c.z - (b.z + 0.5)) < 0.6 &&
                 Math.abs(c.y - (b.y + 1)) < 1.2);
        if (idx > this.checkpointIndex) {
          this.checkpointIndex = idx;
          this.hud.showToast('Checkpoint reached', 1400);
          audio.checkpoint();
        }
      }
    }

    if (this.endless) {
      this.endless.update(p.pos);
      this.level.checkpoints = this.endless.checkpoints;
      if (this.endless.biomeId !== this.level.biomeId) {
        this.level.biomeId = this.endless.biomeId;
        this.level.biome = this.endless.biome;
        this._applyBiome(this.level.biome);
        this.hud.showToast(`Entering ${this.level.biome.name}`, 2000);
      }
      save.recordEndless(this.checkpointIndex * 10);
    }

    if (p.drankPotion) {
      const label = { speed: 'Speed II', jump_boost: 'Jump Boost II', slow_falling: 'Slow Falling' };
      this.hud.showToast(`Drank ${label[p.drankPotion] || p.drankPotion}`, 1600);
      audio.potion();
    }

    if (!this.endless && (p.atGoal || this.isOnGoal(p))) this.win();

    if (p.dead) {
      audio.death(p.deathCause);
      this.deaths++;
      save.recordDeath(this.level.name);
      this.camera.shake = 0.16;
      this.respawn(false);
    }
  }

  isOnGoal(p) {
    if (!this.level.goal) return false;
    const g = this.level.goal;
    return Math.abs(p.pos.x - g.x) < 1.4 && Math.abs(p.pos.z - g.z) < 1.4 &&
           Math.abs(p.pos.y - g.y) < 1.6;
  }

  win() {
    if (this.state === 'won') return;
    this.state = 'won';
    const seconds = this.ticks / C.TPS;
    const isBest = save.recordTime(this.level.name, seconds);
    const idx = LEVELS.indexOf(this.level.def);
    if (idx >= 0) save.unlock(idx + 2);
    if (!this.isTouch) this.keys.exitLock();

    audio.win();
    const panel = this.uiRoot.querySelector('#win');
    panel.querySelector('.win-time').textContent = fmtTime(seconds);
    panel.querySelector('.win-best').textContent =
      `Best ${fmtTime(save.data.best[this.level.name])}` + (isBest ? '  — new record!' : '');
    panel.querySelector('.win-deaths').textContent = `${this.deaths} deaths`;
    panel.querySelector('.win-par').textContent =
      seconds <= this.level.parTime ? `Under par (${this.level.parTime}s)` : `Par is ${this.level.parTime}s`;
    panel.classList.add('show');
  }

  // ------------------------------------------------------------------------
  _frame(now) {
    requestAnimationFrame(this._frame);
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.player) {
      this.applyLook();

      if (this.state === 'playing') {
        this.accumulator += dt * 1000;
        let steps = 0;
        while (this.accumulator >= C.TICK_MS && steps < C.MAX_TICKS_PER_FRAME) {
          this.accumulator -= C.TICK_MS;
          this.tick();
          steps++;
          if (this.state !== 'playing') break;
        }
        if (steps === C.MAX_TICKS_PER_FRAME) this.accumulator = 0;   // don't spiral
      }

      const alpha = Math.min(1, this.accumulator / C.TICK_MS);
      const pos = this.player.lerpPos(alpha);
      this.camera.update(pos, this.player.eyeHeight, this.player.yaw, this.player.pitch,
                         this.level.world, dt, this.player.speedBps);

      this.avatar.update({ pos, yaw: this.player.yaw, pitch: this.player.pitch,
                           player: this.player, dt, visible: this.camera.mode === 'third' });

      this.hud.update({
        time: this.ticks / C.TPS,
        checkpoint: this.checkpointIndex,
        totalCheckpoints: this.endless ? this.endless.platformCount
                                       : this.level.checkpoints.length - 1,
        deaths: this.deaths,
        effects: this.player.effects,
        firstPerson: this.camera.mode === 'first',
        debug: this.debugText(),
      });

      if (this.fadeAlpha > 0) {
        this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * (1000 / C.RESPAWN_FADE_MS));
        if (this.fadeEl) this.fadeEl.style.opacity = this.fadeAlpha;
      }
    }

    this.renderer.render(this.scene, this.camera.cam);
  }

  debugText() {
    if (!this.showDebug) return null;
    const p = this.player;
    return `xyz ${p.pos.x.toFixed(2)} ${p.pos.y.toFixed(2)} ${p.pos.z.toFixed(2)}\n` +
           `speed ${p.speedBps.toFixed(2)} b/s  ${p.sprinting ? 'SPRINT' : ''}\n` +
           `ground ${p.onGround ? p.groundBlock?.id ?? 'yes' : 'air'}  jump ${p.distanceJumped.toFixed(2)}`;
  }
}
