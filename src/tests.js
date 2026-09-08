// ---------------------------------------------------------------------------
// Physics tests. These check the numbers that every level depends on.
// If one of these fails, a level that used to be beatable may not be.
// ---------------------------------------------------------------------------
import * as C from './constants.js';
import { World } from './world/world.js';
import { EndlessCourse } from './endless/generator.js';
import { Player } from './player.js';

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass, detail });
  return pass;
}
function near(name, actual, expected, tol, unit = '') {
  const pass = Math.abs(actual - expected) <= tol;
  return check(name, pass, `got ${actual.toFixed(4)}${unit}, expected ${expected}±${tol}`);
}

const NONE = { forward: false, back: false, left: false, right: false,
               jump: false, sprint: false, sneak: false };
const input = (o) => ({ ...NONE, ...o });

// --- 1. Jump apex ----------------------------------------------------------
// Pure vertical integration, no world needed.
function apex() {
  let v = C.JUMP_VELOCITY, y = 0, peak = 0;
  for (let i = 0; i < 100; i++) {
    y += v;
    if (y > peak) peak = y;
    v = (v - C.GRAVITY) * C.DRAG_Y;
    if (v < 0 && y < peak) break;
  }
  return peak;
}

// --- shared: build a runway + gap + landing pad ----------------------------
function jumpWorld(gap, rise = 0, runway = 24, pad = 8) {
  const w = new World();
  w.fill(-runway, 0, -1, 0, 0, 1, 'stone');                     // runway ends at x = 1.0
  w.fill(gap + 1, rise, -1, gap + pad, rise, 1, 'stone');       // landing pad
  return w;
}

/**
 * Can the player clear a gap of `gap` blocks? Tries every jump timing in a
 * window, because "is this jump possible" means "is there SOME timing".
 */
function canClear(gap, { sprint = true, ground = 'stone', jumpBoost = 0, rise = 0 } = {}) {
  // Sweep the jump-off POSITION rather than a tick offset: at walking speed a
  // fixed tick window never actually reaches the edge. 0.7 is the furthest a
  // 0.6-wide player's centre can get on a block whose edge is at x = 1.0.
  for (let jumpAt = -1.20; jumpAt <= 0.701; jumpAt += 0.02) {
    const w = jumpWorld(gap, rise);
    if (ground !== 'stone') w.fill(-24, 0, -1, 0, 0, 1, ground);
    const p = new Player(w);
    p.assist = false;                    // test raw Minecraft physics, no help
    p.setPos(-18.5, 1, 0.5);
    p.yaw = -Math.PI / 2;                // face +X
    if (jumpBoost) p.addEffect('jump_boost', 400, jumpBoost);

    let jumped = false;
    for (let t = 0; t < 300; t++) {
      const doJump = !jumped && p.onGround && p.pos.x >= jumpAt;
      if (doJump) jumped = true;
      p.tick(input({ forward: true, sprint, jump: doJump }));
      if (p.dead || p.pos.y < -5) break;
      if (jumped && p.onGround && p.pos.x > gap + 0.7 && p.pos.y > rise + 0.5)
        return { ok: true, jumpAt };
    }
  }
  return { ok: false };
}

// --- 2/3. Sprint and walk jump distances -----------------------------------
function maxGap(opts) {
  let best = 0;
  for (let g = 1; g <= 7; g++) if (canClear(g, opts).ok) best = g; else break;
  return best;
}

// --- 5. Step-up ------------------------------------------------------------
function canStepUp(blockId) {
  const w = new World();
  w.fill(-8, 0, -1, 0, 0, 1, 'stone');
  w.fill(1, 0, -1, 6, 0, 1, blockId);           // the step, at y = 0
  const p = new Player(w);
  p.assist = false;
  p.setPos(-4.5, 1, 0.5);
  p.yaw = -Math.PI / 2;
  for (let t = 0; t < 120; t++) p.tick(input({ forward: true }));
  return p.pos.x > 2;                            // did we get onto/past the step?
}

// --- 6. Fence is unjumpable -------------------------------------------------
function canPassFence() {
  const w = new World();
  w.fill(-8, 0, -1, 8, 0, 1, 'stone');
  w.fill(0, 1, -1, 0, 1, 1, 'oak_fence');
  const p = new Player(w);
  p.assist = false;
  p.setPos(-4.5, 1, 0.5);
  p.yaw = -Math.PI / 2;
  for (let t = 0; t < 200; t++) p.tick(input({ forward: true, sprint: true, jump: true }));
  return p.pos.x > 1;
}

// --- 7. Speeds ---------------------------------------------------------------
function terminalSpeed({ sprint }) {
  const w = new World();
  w.fill(-4, 0, -2, 400, 0, 2, 'stone');
  const p = new Player(w);
  p.assist = false;
  p.setPos(0.5, 1, 0.5);
  p.yaw = -Math.PI / 2;
  for (let t = 0; t < 120; t++) p.tick(input({ forward: true, sprint }));
  const x0 = p.pos.x;
  for (let t = 0; t < 20; t++) p.tick(input({ forward: true, sprint }));
  return p.pos.x - x0;                           // blocks travelled in 1 second
}

// --- 8. Ice slides ----------------------------------------------------------
function stopDistance(ground) {
  const w = new World();
  w.fill(-4, 0, -2, 400, 0, 2, ground);
  const p = new Player(w);
  p.assist = false;
  p.setPos(0.5, 1, 0.5);
  p.yaw = -Math.PI / 2;
  for (let t = 0; t < 200; t++) p.tick(input({ forward: true, sprint: true }));
  const x0 = p.pos.x;
  for (let t = 0; t < 200; t++) {
    p.tick(input({}));
    if (Math.hypot(p.vel.x, p.vel.z) < 0.005) break;
  }
  return p.pos.x - x0;
}

// --- 9. Slime bounces --------------------------------------------------------
// Holding shift as you land on slime must cancel the bounce, like Minecraft.
function slimeSneakCancels() {
  const w = new World();
  w.fill(-2, 0, -2, 2, 0, 2, 'slime_block');
  const p = new Player(w);
  p.assist = false;
  p.setPos(0.5, 9, 0.5);
  for (let t = 0; t < 200; t++) {
    const fallingBefore = p.vel.y < -0.2;
    p.tick(input({ sneak: true }));
    if (fallingBefore && p.vel.y > 0) return false;      // it bounced anyway
  }
  return p.onGround;
}

function slimeBounceHeight() {
  const w = new World();
  w.fill(-2, 0, -2, 2, 0, 2, 'slime_block');
  const p = new Player(w);
  p.assist = false;
  p.setPos(0.5, 9, 0.5);                         // drop from 8 blocks up
  let peak = 0, bounced = false;
  for (let t = 0; t < 400; t++) {
    const fallingBefore = p.vel.y < -0.2;
    p.tick(input({}));
    if (fallingBefore && p.vel.y > 0) bounced = true;   // the bounce itself
    if (bounced && p.pos.y > peak) peak = p.pos.y;
    if (bounced && p.vel.y < 0 && p.pos.y < 1.1) break;
  }
  return bounced ? peak - 1 : 0;                 // height above the slime surface
}

// --- 10. Determinism ---------------------------------------------------------
function deterministic() {
  const run = () => {
    const w = jumpWorld(4, 0);
    const p = new Player(w);
    p.assist = false; p.setPos(-18.5, 1, 0.5); p.yaw = -Math.PI / 2;
    for (let t = 0; t < 120; t++) p.tick(input({ forward: true, sprint: true, jump: t === 60 }));
    return `${p.pos.x.toFixed(9)},${p.pos.y.toFixed(9)},${p.pos.z.toFixed(9)}`;
  };
  return run() === run();
}

/**
 * A CHAIN of jumps is harder than one jump: you land with reduced speed and
 * only have the depth of the platform to build it back up before the next gap.
 * Levels are full of these, so they need testing separately.
 */
function canChain(gap, padDepth, count) {
  // A real player picks their pace: you do not sprint a 2-block gap, because a
  // sprint jump travels ~4.7 blocks and you would fly straight over the landing
  // pad. So the chain counts as clearable if EITHER pace gets through.
  for (const sprint of [true, false]) {
    const w = new World();
    const stride = padDepth + gap;
    for (let i = 0; i <= count; i++)
      w.fill(i * stride, 0, -1, i * stride + padDepth - 1, 0, 1, 'stone');
    w.fill(-20, 0, -1, -1, 0, 1, 'stone');            // run-up

    const p = new Player(w);
    p.assist = false;
    p.setPos(-14.5, 1, 0.5);
    p.yaw = -Math.PI / 2;

    let ok = false;
    for (let t = 0; t < 60 * count + 300; t++) {
      // Jump on the last tick before running out of platform.
      const ahead = Math.floor(p.pos.x + 0.3 + Math.max(0.35, p.vel.x));
      const groundAhead = w.get(ahead, 0, 0) !== null;
      const jump = p.onGround && !groundAhead;
      p.tick(input({ forward: true, sprint, jump }));
      if (p.dead || p.pos.y < -4) break;
      if (p.pos.x > count * stride) { ok = true; break; }
    }
    if (ok) return { ok: true, sprint };
  }
  return { ok: false };
}

// Endless mode must never generate a jump the player physically cannot make.
function endlessReachable(seeds = 12, platforms = 160) {
  const fakeScene = { add() {}, remove() {} };
  const bad = [];
  for (let i = 0; i < seeds; i++) {
    const course = new EndlessCourse(fakeScene, { seed: 1000 + i * 7919, unlocked: 5 });
    while (course.platformCount < platforms) course.buildSegment();
    for (const j of course.jumps) {
      const max = j.rise > 0 ? 3 : 4;          // verified above
      if (j.gap > max) bad.push(`seed ${1000 + i * 7919} platform ${j.n}: gap ${j.gap} rise ${j.rise}`);
      if (j.block === 'lava') bad.push(`seed ${1000 + i * 7919} platform ${j.n}: lands on lava`);
    }
  }
  return bad;
}

// The same seed must always produce the same course, or shared seeds are useless.
function endlessDeterministic() {
  const fakeScene = { add() {}, remove() {} };
  const run = () => {
    const c = new EndlessCourse(fakeScene, { seed: 424242, unlocked: 5 });
    while (c.platformCount < 80) c.buildSegment();
    return c.jumps.map((j) => `${j.gap}:${j.rise}:${j.block}`).join('|');
  };
  return run() === run();
}

export function runTests() {
  results.length = 0;

  near('Jump apex is 1.2522 blocks', apex(), 1.2522, 0.0005, ' blocks');
  check('Can jump onto a 1-block step (apex > 1.0)', apex() > 1.0);
  check('Cannot jump onto a 1.5-block ledge (apex < 1.5)', apex() < 1.5);

  const sprintGap = maxGap({ sprint: true });
  check('Sprint jump clears a 4-block gap', sprintGap >= 4, `max gap = ${sprintGap}`);
  check('Sprint jump does NOT clear 5 blocks', sprintGap < 5, `max gap = ${sprintGap}`);

  const walkGap = maxGap({ sprint: false });
  check('Walk jump (no sprint) clears a 2-block gap', walkGap >= 2, `max gap = ${walkGap}`);
  check('Walk jump does NOT clear 3 blocks - sprinting is required', walkGap < 3,
        `max gap = ${walkGap}`);

  const boostGap = maxGap({ sprint: true, jumpBoost: 2 });
  check('Jump Boost II reaches further than normal', boostGap > sprintGap,
        `boosted max gap = ${boostGap} vs ${sprintGap}`);

  const riseGap = maxGap({ sprint: true, rise: 1 });
  check('Sprint jump UP one block clears 3 blocks', riseGap >= 3, `max gap = ${riseGap}`);
  check('Sprint jump UP one block does NOT clear 4', riseGap < 4, `max gap = ${riseGap}`);
  check('Cannot jump up 2 blocks at all', !canClear(1, { sprint: true, rise: 2 }).ok);

  // Chains: these are what levels are actually made of.
  const chain2 = canChain(2, 3, 6), chain3 = canChain(3, 3, 6), chain4 = canChain(4, 3, 5);
  check('Chain of 2-block jumps on 3-deep platforms', chain2.ok,
        chain2.ok ? `needs sprint ${chain2.sprint ? 'on' : 'OFF - you would overshoot'}` : '');
  check('Chain of 3-block jumps on 3-deep platforms', chain3.ok,
        chain3.ok ? `sprint ${chain3.sprint ? 'on' : 'off'}` : '');
  check('Chain of 4-block jumps on 3-deep platforms', chain4.ok,
        chain4.ok ? `sprint ${chain4.sprint ? 'on' : 'off'}` : '');
  check('Chain of 4-block jumps on 1-deep platforms is NOT possible',
        !canChain(4, 1, 5).ok);

  check('Auto step-up onto a slab', canStepUp('oak_slab'));
  check('Fence (1.5 tall) cannot be jumped', !canPassFence());

  const walk = terminalSpeed({ sprint: false });
  const sprint = terminalSpeed({ sprint: true });
  near('Walk speed ~4.3 blocks/s', walk, 4.32, 0.25, ' b/s');
  near('Sprint speed ~5.6 blocks/s', sprint, 5.61, 0.25, ' b/s');
  check('Sprinting is faster than walking', sprint > walk);

  const iceStop = stopDistance('ice');
  const stoneStop = stopDistance('stone');
  check('Ice slides much further than stone', iceStop > stoneStop * 4,
        `ice ${iceStop.toFixed(2)} blocks vs stone ${stoneStop.toFixed(2)} blocks`);

  const bounce = slimeBounceHeight();
  check('Slime block bounces you back up', bounce > 2, `bounced ${bounce.toFixed(2)} blocks`);
  check('Sneaking cancels the slime bounce', slimeSneakCancels());

  check('Simulation is deterministic', deterministic());

  const badJumps = endlessReachable();
  check('Endless mode never generates an impossible jump', badJumps.length === 0,
        badJumps.slice(0, 3).join('; '));
  check('Endless mode is reproducible from its seed', endlessDeterministic());

  return results;
}
