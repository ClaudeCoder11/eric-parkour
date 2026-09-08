// The in-game heads-up display: timer, deaths, checkpoints, effects, hints.
import { fmtTime } from '../save.js';

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud">
        <div class="hud-top">
          <div class="hud-level"></div>
          <div class="hud-timer">0:00.00</div>
          <div class="hud-stats"><span class="hud-cp"></span><span class="hud-deaths"></span></div>
        </div>
        <div class="hud-effects"></div>
        <div class="crosshair"></div>
        <div class="hud-hint"></div>
        <div class="hud-toast"></div>
        <div class="hud-debug"></div>
      </div>`;
    this.level = root.querySelector('.hud-level');
    this.timer = root.querySelector('.hud-timer');
    this.cp = root.querySelector('.hud-cp');
    this.deaths = root.querySelector('.hud-deaths');
    this.effects = root.querySelector('.hud-effects');
    this.hint = root.querySelector('.hud-hint');
    this.toast = root.querySelector('.hud-toast');
    this.debug = root.querySelector('.hud-debug');
    this.crosshair = root.querySelector('.crosshair');
    this._toastTimer = null;
  }

  setLevel(name, biome) { this.level.textContent = `${name} · ${biome}`; }

  showHint(text, ms = 7000) {
    this.hint.textContent = text;
    this.hint.classList.toggle('show', !!text);
    clearTimeout(this._hintTimer);
    if (text) this._hintTimer = setTimeout(() => this.hint.classList.remove('show'), ms);
  }

  showToast(text, ms = 1800) {
    this.toast.textContent = text;
    this.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  update(state) {
    this.timer.textContent = fmtTime(state.time);
    this.cp.textContent = `⚑ ${state.checkpoint}/${state.totalCheckpoints}`;
    this.deaths.textContent = `☠ ${state.deaths}`;
    this.crosshair.style.display = state.firstPerson ? 'block' : 'none';

    const fx = [];
    if (state.effects.speed > 0)        fx.push(['Speed', state.effects.speed, '#7ad1ff']);
    if (state.effects.jump_boost > 0)   fx.push(['Jump Boost', state.effects.jump_boost, '#c58aff']);
    if (state.effects.slow_falling > 0) fx.push(['Slow Falling', state.effects.slow_falling, '#eaeaea']);
    this.effects.innerHTML = fx.map(([n, t, c]) =>
      `<div class="fx" style="--c:${c}">${n} <b>${Math.ceil(t / 20)}s</b></div>`).join('');

    if (state.debug) {
      this.debug.style.display = 'block';
      this.debug.textContent = state.debug;
    } else this.debug.style.display = 'none';
  }
}
