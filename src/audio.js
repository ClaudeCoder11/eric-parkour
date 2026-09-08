// ---------------------------------------------------------------------------
// All sound is synthesized in the browser with the Web Audio API. There are no
// recorded audio files in this project - nothing to download, and nothing that
// belongs to anybody else.
//
// Footsteps are filtered noise bursts whose pitch and tone depend on what you
// are standing on, which is how they end up sounding like different materials.
// ---------------------------------------------------------------------------
import { save } from './save.js';

// Tone shape per material: [filter Hz, noise vs tone, decay seconds]
const MATERIALS = {
  default:      [900,  0.85, 0.09],
  grass:        [700,  1.00, 0.08],
  dirt:         [520,  1.00, 0.09],
  stone:        [1500, 0.75, 0.07],
  cobblestone:  [1400, 0.80, 0.07],
  oak_planks:   [1100, 0.70, 0.10],
  jungle_planks:[1000, 0.70, 0.10],
  oak_log:      [850,  0.75, 0.10],
  sand:         [640,  1.00, 0.07],
  snow_block:   [480,  1.00, 0.11],
  ice:          [2400, 0.45, 0.13],
  packed_ice:   [2200, 0.45, 0.12],
  blue_ice:     [2600, 0.40, 0.13],
  slime_block:  [320,  0.35, 0.20],
  honey_block:  [300,  0.40, 0.18],
  netherrack:   [800,  0.95, 0.08],
  nether_bricks:[1600, 0.70, 0.07],
  soul_sand:    [380,  1.00, 0.13],
  soul_soil:    [360,  1.00, 0.13],
  magma_block:  [700,  0.85, 0.10],
  glowstone:    [1900, 0.55, 0.09],
  metal:        [2000, 0.50, 0.09],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.stepPhase = 0;
  }

  /** Browsers require a user gesture before audio can start. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // One second of white noise, reused for every percussive sound.
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  get on() { return save.settings.sound !== false; }

  _noise(freq, q, gain, decay, when = 0) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + decay + 0.02);
  }

  _tone(freq, gain, decay, type = 'sine', when = 0, bendTo = null) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (bendTo) osc.frequency.exponentialRampToValueAtTime(bendTo, t + decay);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + decay + 0.02);
  }

  // --- game sounds ---------------------------------------------------------
  step(blockId) {
    if (!this.on || !this.ensure()) return;
    const [f, noisiness, decay] = MATERIALS[blockId] || MATERIALS.default;
    const jitter = 0.88 + Math.random() * 0.24;
    this._noise(f * jitter, 1.1, 0.10 * noisiness, decay);
    if (noisiness < 0.9) this._tone(f * 0.5 * jitter, 0.035, decay * 0.8, 'triangle');
  }

  jump(blockId) {
    if (!this.on || !this.ensure()) return;
    const [f] = MATERIALS[blockId] || MATERIALS.default;
    this._noise(f * 0.9, 1.0, 0.07, 0.07);
  }

  land(blockId, hard = false) {
    if (!this.on || !this.ensure()) return;
    const [f, noisiness, decay] = MATERIALS[blockId] || MATERIALS.default;
    this._noise(f * 0.75, 0.9, hard ? 0.22 : 0.13, decay * 1.5);
    if (hard) this._tone(90, 0.09, 0.13, 'sine', 0, 55);
  }

  bounce() {                                    // slime block
    if (!this.on || !this.ensure()) return;
    this._tone(180, 0.16, 0.22, 'sine', 0, 420);
    this._noise(400, 2.2, 0.05, 0.14);
  }

  splash() {
    if (!this.on || !this.ensure()) return;
    this._noise(1800, 0.7, 0.16, 0.35);
    this._noise(700, 1.2, 0.10, 0.25, 0.03);
  }

  checkpoint() {
    if (!this.on || !this.ensure()) return;
    [523.25, 659.25, 783.99].forEach((f, i) =>
      this._tone(f, 0.10, 0.22, 'triangle', i * 0.07));
  }

  potion() {
    if (!this.on || !this.ensure()) return;
    this._noise(2600, 3.0, 0.06, 0.30);          // glug
    [392, 523.25].forEach((f, i) => this._tone(f, 0.08, 0.2, 'sine', i * 0.09));
  }

  death(cause) {
    if (!this.on || !this.ensure()) return;
    if (cause === 'lava' || cause === 'magma') {
      this._noise(500, 0.6, 0.24, 0.6);          // sizzle
      this._tone(160, 0.10, 0.45, 'sawtooth', 0, 60);
    } else {
      this._tone(300, 0.13, 0.5, 'square', 0, 70);
    }
  }

  win() {
    if (!this.on || !this.ensure()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this._tone(f, 0.12, 0.35, 'triangle', i * 0.11));
  }

  portal() {
    if (!this.on || !this.ensure()) return;
    this._noise(220, 0.5, 0.05, 1.2);
  }

  /** Called every tick; emits a footstep at walking cadence. */
  footsteps(player) {
    if (!this.on) return;
    if (!player.onGround || player.speedBps < 0.8) { this.stepPhase = 0; return; }
    this.stepPhase += player.speedBps / 20;
    if (this.stepPhase >= 2.1) {                 // roughly every 2 blocks travelled
      this.stepPhase = 0;
      this.step(player.groundBlock ? player.groundBlock.id : 'default');
    }
  }
}

export const audio = new Audio();
