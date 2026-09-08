// ---------------------------------------------------------------------------
// The player. One tick = 1/20 s, and the order of operations inside tick()
// mirrors Minecraft's own LivingEntity.travel():
//
//     1. jump             (sets vy = 0.42, plus the sprint kick)
//     2. accelerate       (vx, vz += accel * wishDir)
//     3. move & collide
//     4. apply friction and gravity for the NEXT tick
//
// That order is not cosmetic: it is why the jump apex is exactly 1.2522 blocks
// and why a sprint jump clears 4 blocks. Do not reorder it.
// ---------------------------------------------------------------------------
import * as C from './constants.js';
import { AABB, moveAndCollide, blockUnder } from './physics.js';
import { getBlock } from './world/blocks.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = { x: 0.5, y: 2, z: 0.5 };       // feet position
    this.prev = { ...this.pos };               // previous tick, for interpolation
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;                              // radians; 0 faces -Z
    this.pitch = 0;

    this.onGround = false;
    this.wasOnGround = false;
    this.sprinting = false;
    this.sneaking = false;
    this.sneakHeld = false;
    this.inWater = false;
    this.onLadder = false;
    this.onHoneyWall = false;

    this.coyote = 0;                           // assist: ticks of ledge grace
    this.jumpBuffer = 0;                       // assist: ticks of early-jump grace
    this.assist = true;

    this.effects = { speed: 0, jump_boost: 0, slow_falling: 0 };  // ticks remaining
    this.effectLevel = { speed: 0, jump_boost: 0 };

    this.hazardTicks = 0;                      // time spent touching magma
    this.dead = false;
    this.deathCause = null;
    this.groundBlock = null;
    this.platformPush = { x: 0, y: 0, z: 0 };  // set by moving pistons

    // stats the HUD reads
    this.ticksAlive = 0;
    this.distanceJumped = 0;
    this._airStart = null;
  }

  get box() {
    return AABB.fromFeet(this.pos.x, this.pos.y, this.pos.z, C.PLAYER_WIDTH, C.PLAYER_HEIGHT);
  }
  get eyeHeight() { return this.sneaking ? C.SNEAK_EYE : C.PLAYER_EYE; }

  setPos(x, y, z) {
    this.pos.x = x; this.pos.y = y; this.pos.z = z;
    this.prev = { x, y, z };
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.onGround = false; this.hazardTicks = 0; this.dead = false; this.deathCause = null;
  }

  forwardVec() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  rightVec()   { return { x:  Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }

  addEffect(name, ticks, level = 1) {
    this.effects[name] = Math.max(this.effects[name] || 0, ticks);
    if (name in this.effectLevel) this.effectLevel[name] = Math.max(this.effectLevel[name], level);
  }
  hasEffect(name) { return (this.effects[name] || 0) > 0; }

  // ------------------------------------------------------------------------
  tick(input) {
    if (this.dead) return;
    this.prev.x = this.pos.x; this.prev.y = this.pos.y; this.prev.z = this.pos.z;
    this.wasOnGround = this.onGround;
    this.jumpedThisTick = false;
    this.drankPotion = null;
    this.ticksAlive++;

    for (const k of Object.keys(this.effects)) {
      if (this.effects[k] > 0 && --this.effects[k] === 0) {
        if (k in this.effectLevel) this.effectLevel[k] = 0;
      }
    }

    const box = this.box;
    this.sneakHeld = !!input.sneak;              // held, even in mid-air
    this.sneaking = this.sneakHeld && this.onGround;   // crouch-walking

    // --- what am I standing in / on? ---------------------------------------
    const inside = this.world.overlappingNonSolid(box);
    this.inWater = false; this.onLadder = false;
    let inCobweb = false, inPowderSnow = false, touchingLava = false, atGoal = false;
    for (const b of inside) {
      const d = getBlock(b.id);
      if (d.fluid === 'water') this.inWater = true;
      if (d.fluid === 'lava') touchingLava = true;
      if (d.climbable) this.onLadder = true;
      if (d.drag === C.COBWEB_FACTOR) inCobweb = true;
      if (d.tags.includes('sink')) inPowderSnow = true;
      if (d.tags.includes('goal')) atGoal = true;
      if (d.effect) {
        const had = this.hasEffect(d.effect.name);
        this.addEffect(d.effect.name, d.effect.ticks, d.effect.level);
        if (!had) this.drankPotion = d.effect.name;
      }
    }
    this.atGoal = atGoal;

    this.groundBlock = this.onGround ? blockUnder(box, this.world) : null;
    const groundDef = this.groundBlock ? getBlock(this.groundBlock.id) : null;
    const slip = this.onGround && groundDef ? groundDef.slip : 1;

    // --- assist timers ------------------------------------------------------
    if (this.onGround) this.coyote = this.assist ? C.COYOTE_TICKS : 0;
    else if (this.coyote > 0) this.coyote--;
    if (input.jump) this.jumpBuffer = this.assist ? C.JUMP_BUFFER_TICKS : 1;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;

    // --- 1. jump ------------------------------------------------------------
    const wantsJump = this.jumpBuffer > 0;
    const canJump = this.onGround || this.coyote > 0;
    if (wantsJump && canJump && !this.onLadder && !this.inWater) {
      let power = C.JUMP_VELOCITY + this.effectLevel.jump_boost * C.JUMP_BOOST_PER_LEVEL;
      if (groundDef && groundDef.tags.includes('no_jump_boost')) power *= 0.5;  // honey
      this.vel.y = power;
      if (this.sprinting) {
        const f = this.forwardVec();
        this.vel.x += f.x * C.SPRINT_JUMP_BOOST;
        this.vel.z += f.z * C.SPRINT_JUMP_BOOST;
      }
      // NOTE: onGround deliberately stays true here. Minecraft only clears it
      // inside move(), so the jump tick still gets GROUND acceleration. That is
      // exactly what turns a 3-block jump into a 4-block jump.
      this.coyote = 0; this.jumpBuffer = 0;
      this.jumpedThisTick = true;
      this._airStart = { x: this.pos.x, z: this.pos.z };
    } else if (wantsJump && this.inWater) {
      this.vel.y = Math.min(this.vel.y + 0.04, 0.2);        // swim up
    } else if (wantsJump && this.onLadder) {
      this.vel.y = C.LADDER_CLIMB_SPEED;
    }

    // --- 2. accelerate ------------------------------------------------------
    let wishX = 0, wishZ = 0;
    if (input.forward || input.back || input.left || input.right) {
      const f = this.forwardVec(), r = this.rightVec();
      const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      const str = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      wishX = f.x * fwd + r.x * str;
      wishZ = f.z * fwd + r.z * str;
      const len = Math.hypot(wishX, wishZ);
      if (len > 1e-6) { wishX /= len; wishZ /= len; }        // diagonals aren't faster
    }
    if (input.moveX !== undefined) {                          // analog stick override
      const f = this.forwardVec(), r = this.rightVec();
      let ax = f.x * input.moveY + r.x * input.moveX;
      let az = f.z * input.moveY + r.z * input.moveX;
      const len = Math.hypot(ax, az);
      if (len > 1) { ax /= len; az /= len; }
      wishX = ax; wishZ = az;
    }

    // Sprinting needs forward input and is cancelled by sneaking.
    const movingForward = (input.forward || (input.moveY ?? 0) > 0.6);
    this.sprinting = !!input.sprint && movingForward && !this.sneaking && !this.inWater;

    let moveMul = this.sneaking ? C.MOVE_SNEAK : this.sprinting ? C.MOVE_SPRINT : C.MOVE_WALK;
    if (this.effectLevel.speed > 0)
      moveMul *= 1 + C.SPEED_POTION_PER_LEVEL * this.effectLevel.speed;
    if (groundDef && groundDef.speedFactor !== 1) moveMul *= groundDef.speedFactor;

    let accel;
    if (this.inWater) accel = C.WATER_ACCEL * moveMul * 2;
    else if (this.onGround) accel = C.GROUND_ACCEL * moveMul * Math.pow(C.DEFAULT_SLIPPERINESS / slip, 3);
    else accel = C.AIR_ACCEL * moveMul;

    this.vel.x += wishX * accel;
    this.vel.z += wishZ * accel;

    // Climbing a ladder / vine
    if (this.onLadder) {
      const climbing = wishX !== 0 || wishZ !== 0;
      this.vel.x = Math.max(-0.15, Math.min(0.15, this.vel.x));
      this.vel.z = Math.max(-0.15, Math.min(0.15, this.vel.z));
      if (this.sneaking) this.vel.y = 0;
      else if (climbing) this.vel.y = C.LADDER_CLIMB_SPEED;
      else this.vel.y = Math.max(this.vel.y, C.LADDER_SLIDE_SPEED);
    }

    // Cobweb / powder snow: near-total stop
    if (inCobweb) { this.vel.x *= C.COBWEB_FACTOR; this.vel.z *= C.COBWEB_FACTOR;
                    this.vel.y = Math.max(this.vel.y * C.COBWEB_FACTOR, -0.05); }
    if (inPowderSnow) { this.vel.x *= C.POWDER_SNOW_FACTOR; this.vel.z *= C.POWDER_SNOW_FACTOR;
                        this.vel.y = Math.max(this.vel.y, -0.06); }

    // --- 3. move & collide ---------------------------------------------------
    const dx = this.vel.x + this.platformPush.x;
    const dy = this.vel.y + this.platformPush.y;
    const dz = this.vel.z + this.platformPush.z;
    this.platformPush.x = this.platformPush.y = this.platformPush.z = 0;

    // Sneaking on the ground stops you walking off a ledge.
    const moveBox = box;
    const before = { x: moveBox.x0, z: moveBox.z0 };
    const res = moveAndCollide(moveBox, dx, dy, dz, this.world, {
      onGround: this.onGround, wasOnGround: this.wasOnGround,
      stepHeight: C.STEP_HEIGHT,
    });

    if (this.sneaking && this.wasOnGround && !res.onGround) {
      // Undo any horizontal motion that would take us off the edge.
      moveBox.translate(before.x - moveBox.x0, 0, before.z - moveBox.z0);
      this.vel.x = 0; this.vel.z = 0;
    }

    this.pos.x = moveBox.cx;
    this.pos.y = moveBox.y0;
    this.pos.z = moveBox.cz;

    if (res.hitWallX) this.vel.x = 0;
    if (res.hitWallZ) this.vel.z = 0;
    if (res.hitCeiling) this.vel.y = 0;

    const landed = res.onGround && !this.wasOnGround;
    this.onGround = res.onGround || (this.onLadder && res.onGround);
    this.justLanded = landed;

    if (landed && this._airStart) {
      this.distanceJumped = Math.hypot(this.pos.x - this._airStart.x, this.pos.z - this._airStart.z);
      this._airStart = null;
    }

    // Slime bounce (sneaking suppresses it, exactly like Minecraft)
    if (res.hitFloor) {
      const under = blockUnder(moveBox, this.world);
      const ud = under ? getBlock(under.id) : null;
      // Minecraft suppresses the bounce whenever shift is HELD, not only when
      // you were already crouch-walking - you are airborne as you land.
      if (ud && ud.bounce > 0 && !this.sneakHeld && Math.abs(this.vel.y) > C.SLIME_MIN_BOUNCE) {
        this.vel.y = -this.vel.y * ud.bounce;
        this.onGround = false;
        this.bounced = true;
      } else {
        this.vel.y = 0;
        this.bounced = false;
      }
    }

    // Honey wall-slide
    this.onHoneyWall = false;
    if (!this.onGround && this.vel.y < 0 && (res.hitWallX || res.hitWallZ)) {
      const probe = this.box.expandBy(0.06);
      for (const b of this.world.overlappingNonSolid(probe)) { /* non-solid ignored */ }
      const around = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [ox, oz] of around) {
        const d = this.world.getDef(Math.floor(this.pos.x) + ox,
                                    Math.floor(this.pos.y + 1),
                                    Math.floor(this.pos.z) + oz);
        if (d.tags.includes('sticky_wall')) {
          this.vel.y = Math.max(this.vel.y, C.HONEY_SLIDE_SPEED);
          this.onHoneyWall = true;
        }
      }
    }

    // --- 4. friction & gravity for the next tick ------------------------------
    // Friction is chosen from the state AFTER moving: the tick you jump, you are
    // already airborne by the time drag is applied, so you keep your momentum.
    const momentum = this.onGround ? C.BASE_MOMENTUM * slip : C.BASE_MOMENTUM;
    if (this.inWater) {
      this.vel.x *= C.WATER_DRAG; this.vel.z *= C.WATER_DRAG;
      this.vel.y = (this.vel.y - C.WATER_GRAVITY) * C.WATER_DRAG;
    } else if (!this.onLadder) {
      this.vel.x *= momentum;
      this.vel.z *= momentum;
      const g = this.hasEffect('slow_falling') && this.vel.y < 0
        ? C.SLOW_FALLING_GRAVITY : C.GRAVITY;
      this.vel.y = (this.vel.y - g) * C.DRAG_Y;
    } else {
      this.vel.x *= momentum; this.vel.z *= momentum;
    }
    if (this.vel.y < -C.TERMINAL_VELOCITY) this.vel.y = -C.TERMINAL_VELOCITY;

    // --- hazards & death ------------------------------------------------------
    if (touchingLava) this.kill('lava');
    else if (groundDef && groundDef.hazard === 'magma') {
      this.hazardTicks++;
      if (this.hazardTicks > 20) this.kill('magma');   // ~1 s: you can run across
    } else if (this.hazardTicks > 0) this.hazardTicks = Math.max(0, this.hazardTicks - 2);

    if (this.pos.y < C.VOID_Y) this.kill('void');
  }

  kill(cause) {
    if (this.dead) return;
    this.dead = true;
    this.deathCause = cause;
  }

  /** Smoothed position for rendering between ticks. */
  lerpPos(alpha) {
    return {
      x: this.prev.x + (this.pos.x - this.prev.x) * alpha,
      y: this.prev.y + (this.pos.y - this.prev.y) * alpha,
      z: this.prev.z + (this.pos.z - this.prev.z) * alpha,
    };
  }

  get speedBps() { return Math.hypot(this.vel.x, this.vel.z) * C.TPS; }
}
