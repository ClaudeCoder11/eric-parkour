// ---------------------------------------------------------------------------
// Every physics number the game uses lives here.
//
// These are Minecraft's real values. They are expressed PER TICK (1/20 s),
// exactly as Minecraft's own movement code works, because that is the only way
// a 4-block sprint jump lands the same on every device.
//
// Do not "tune" these by feel. If a jump feels wrong, the level is wrong.
// ---------------------------------------------------------------------------

// --- Timing ---------------------------------------------------------------
export const TPS = 20;                 // Minecraft runs at 20 ticks per second
export const TICK_SECONDS = 1 / TPS;
export const TICK_MS = 1000 / TPS;     // 50 ms
export const MAX_TICKS_PER_FRAME = 5;  // spiral-of-death guard on slow devices

// --- Player body ----------------------------------------------------------
export const PLAYER_WIDTH = 0.6;       // full width; half-width is 0.3
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;        // eye height above the feet
export const SNEAK_EYE = 1.27;
export const STEP_HEIGHT = 0.6;        // auto-step up onto slabs / 0.5 blocks

// --- Vertical motion ------------------------------------------------------
// Each tick:  v.y = (v.y - GRAVITY) * DRAG_Y
// Starting from JUMP_VELOCITY this peaks at 1.2522 blocks, which is exactly
// why you can jump onto a 1-block step but never over a 1.5-block fence.
export const GRAVITY = 0.08;
export const DRAG_Y = 0.98;
export const JUMP_VELOCITY = 0.42;
export const JUMP_BOOST_PER_LEVEL = 0.1;   // Jump Boost potion, per level
export const TERMINAL_VELOCITY = 3.92;     // 78.4 blocks/s

// --- Horizontal motion ----------------------------------------------------
// Each tick:  v += accel * wishDir;  pos += v;  v *= momentum
//   momentum = onGround ? (0.91 * slipperiness) : 0.91
//   accel    = onGround ? 0.1 * moveMul * (0.6/slipperiness)^3
//                       : 0.02 * moveMul
export const BASE_MOMENTUM = 0.91;
export const GROUND_ACCEL = 0.1;
export const AIR_ACCEL = 0.02;
export const DEFAULT_SLIPPERINESS = 0.6;

// Movement multipliers fed into the accel formula
export const MOVE_WALK = 1.0;
export const MOVE_SPRINT = 1.3;
export const MOVE_SNEAK = 0.3;
export const STRAFE_PENALTY = 0.98;   // sideways/backwards are slightly slower
export const SPEED_POTION_PER_LEVEL = 0.2;   // +20% per level, multiplicative

// The forward kick you get from jumping while sprinting. This single number is
// the difference between a 3-block jump and a 4-block jump.
export const SPRINT_JUMP_BOOST = 0.2;

// --- Fluids & special movement -------------------------------------------
export const WATER_DRAG = 0.8;
export const WATER_ACCEL = 0.02;
export const WATER_GRAVITY = 0.02;
export const SLOW_FALLING_GRAVITY = 0.01;   // Slow Falling potion
export const LADDER_CLIMB_SPEED = 0.118;    // ~2.35 blocks/s
export const LADDER_SLIDE_SPEED = -0.15;
export const COBWEB_FACTOR = 0.05;          // multiplies velocity: near-total stop
export const POWDER_SNOW_FACTOR = 0.1;
export const SLIME_BOUNCE = 1.0;            // keeps full downward speed, inverted
export const SLIME_MIN_BOUNCE = 0.1;        // below this you just stop
export const HONEY_SLIDE_SPEED = -0.05;     // wall-slide speed on honey
export const SOUL_SAND_FACTOR = 0.4;        // horizontal speed multiplier
export const PISTON_LAUNCH = 0.5;           // vertical kick from a piston head

// --- Assist mode (default ON, for younger / new players) ------------------
// Minecraft has neither of these. They do not change what a jump can reach,
// only how forgiving the timing is, so level design is unaffected.
export const COYOTE_TICKS = 2;        // ~100 ms of grace after leaving an edge
export const JUMP_BUFFER_TICKS = 2;   // ~100 ms of "I pressed jump slightly early"

// --- World ----------------------------------------------------------------
export const VOID_Y = -24;            // fall below this and you die
export const RESPAWN_FADE_MS = 260;
