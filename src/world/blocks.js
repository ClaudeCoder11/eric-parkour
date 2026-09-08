// ---------------------------------------------------------------------------
// The block registry. Every block the game knows about, its collision shape,
// and how it changes movement. Adding a block here is all it takes to use it
// in a level JSON file.
// ---------------------------------------------------------------------------
import { DEFAULT_SLIPPERINESS } from '../constants.js';

// Collision / render boxes are [x0, y0, z0, x1, y1, z1] inside a 1x1x1 block.
export const SHAPES = {
  full:        [[0, 0, 0, 1, 1, 1]],
  slab:        [[0, 0, 0, 1, 0.5, 1]],
  slab_top:    [[0, 0.5, 0, 1, 1, 1]],
  layer:       [[0, 0, 0, 1, 0.125, 1]],       // snow layer, carpet
  // A fence renders 1 block tall but collides 1.5 blocks tall. That is real
  // Minecraft behaviour and it is why you can never jump a fence (apex 1.2522).
  fence:       [[0.375, 0, 0.375, 0.625, 1.5, 0.625]],
  fence_render:[[0.375, 0, 0.375, 0.625, 1, 0.625]],
  trapdoor:    [[0, 0.8125, 0, 1, 1, 1]],      // closed, in the "top" position
  post:        [[0.25, 0, 0.25, 0.75, 1, 0.75]],
  none:        [],
  // Stairs = a bottom slab plus the back half of the top. Facing is the side
  // the tall part is on, so `stairs_n` has its step-up on the -Z side.
  stairs_n:    [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]],
  stairs_s:    [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0.5, 1, 1, 1]],
  stairs_w:    [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 0.5, 1, 1]],
  stairs_e:    [[0, 0, 0, 1, 0.5, 1], [0.5, 0.5, 0, 1, 1, 1]],
};

// Shorthand for defining a block.
const B = (id, opts) => ({
  id,
  shape: 'full',
  solid: true,
  slip: DEFAULT_SLIPPERINESS,   // 0.6 = normal ground
  bounce: 0,
  climbable: false,
  fluid: null,
  hazard: null,                 // 'lava' | 'fire' | 'magma'
  effect: null,                 // potion granted by walking through
  drag: 1,                      // velocity multiplier while inside (cobweb etc.)
  speedFactor: 1,               // horizontal speed multiplier while standing on
  transparent: false,
  opacity: 1,
  light: 0,
  tags: [],
  ...opts,
});

const defs = [
  // --- basics --------------------------------------------------------------
  B('bedrock',       { tex: 'bedrock' }),
  B('grass',         { tex: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } }),
  B('dirt',          { tex: 'dirt' }),
  B('stone',         { tex: 'stone' }),
  B('cobblestone',   { tex: 'cobblestone' }),
  B('sand',          { tex: 'sand' }),
  B('gravel',        { tex: 'gravel' }),
  B('oak_planks',    { tex: 'oak_planks' }),
  B('oak_log',       { tex: { top: 'oak_log_top', side: 'oak_log_side', bottom: 'oak_log_top' } }),
  B('oak_leaves',    { tex: 'oak_leaves', transparent: true }),
  B('oak_slab',      { tex: 'oak_planks', shape: 'slab' }),
  B('stone_slab',    { tex: 'stone', shape: 'slab' }),
  B('cobble_slab',   { tex: 'cobblestone', shape: 'slab' }),
  B('oak_stairs',    { tex: 'oak_planks', shape: 'stairs_n' }),
  B('stone_stairs',  { tex: 'stone', shape: 'stairs_n' }),
  B('oak_fence',     { tex: 'fence_wood', shape: 'fence', renderShape: 'fence_render',
                       transparent: true, tags: ['unjumpable'] }),
  B('gold_block',    { tex: 'gold_block' }),
  B('emerald_block', { tex: 'emerald_block' }),
  B('quartz_block',  { tex: 'quartz' }),
  B('quartz_slab',   { tex: 'quartz', shape: 'slab' }),
  B('iron_block',    { tex: 'iron_block' }),
  B('obsidian',      { tex: 'obsidian' }),

  // --- climb / stop --------------------------------------------------------
  B('ladder',        { tex: 'ladder', shape: 'none', solid: false, climbable: true,
                       transparent: true, cross: true }),
  B('vine',          { tex: 'vine', shape: 'none', solid: false, climbable: true,
                       transparent: true, cross: true }),
  B('scaffolding',   { tex: 'scaffolding', solid: true, climbable: true,
                       transparent: true, tags: ['walk_through_side'] }),
  B('cobweb',        { tex: 'cobweb', shape: 'none', solid: false, drag: 0.05,
                       transparent: true, cross: true }),

  // --- level 2: ice & snow -------------------------------------------------
  B('snow_block',    { tex: 'snow' }),
  B('snow_layer',    { tex: 'snow', shape: 'layer' }),
  B('ice',           { tex: 'ice', slip: 0.98, transparent: true, opacity: 0.86 }),
  B('packed_ice',    { tex: 'packed_ice', slip: 0.98 }),
  B('blue_ice',      { tex: 'blue_ice', slip: 0.989 }),
  B('powder_snow',   { tex: 'powder_snow', shape: 'none', solid: false, drag: 0.1,
                       transparent: true, opacity: 0.9, tags: ['sink'] }),

  // --- level 3: jungle -----------------------------------------------------
  B('jungle_planks', { tex: 'jungle_planks' }),
  B('jungle_slab',   { tex: 'jungle_planks', shape: 'slab' }),
  B('jungle_leaves', { tex: 'jungle_leaves', transparent: true }),
  B('slime_block',   { tex: 'slime', slip: 0.8, bounce: 1.0, transparent: true,
                       opacity: 0.78 }),
  B('honey_block',   { tex: 'honey', slip: 0.4, speedFactor: 0.4, transparent: true,
                       opacity: 0.88, tags: ['sticky_wall', 'no_jump_boost'] }),
  B('water',         { tex: 'water', shape: 'none', solid: false, fluid: 'water',
                       transparent: true, opacity: 0.62 }),

  // --- level 4: badlands, redstone, pistons --------------------------------
  B('terracotta',    { tex: 'terracotta' }),
  B('red_sand',      { tex: 'red_sand' }),
  B('deepslate',     { tex: 'deepslate' }),
  B('sculk',         { tex: 'sculk' }),
  B('redstone_block',{ tex: 'redstone' }),
  B('piston',        { tex: { top: 'piston_top', side: 'piston_side', bottom: 'piston_side' },
                       tags: ['piston'] }),
  B('sticky_piston', { tex: { top: 'sticky_top', side: 'piston_side', bottom: 'piston_side' },
                       tags: ['piston', 'sticky'] }),
  B('piston_head',   { tex: 'piston_top', shape: 'slab', tags: ['piston_head'] }),
  B('trapdoor',      { tex: 'trapdoor', shape: 'trapdoor', transparent: true }),

  // --- level 5: the nether -------------------------------------------------
  B('netherrack',    { tex: 'netherrack' }),
  B('nether_bricks', { tex: 'nether_brick' }),
  B('nether_slab',   { tex: 'nether_brick', shape: 'slab' }),
  B('crimson_planks',{ tex: 'crimson' }),
  B('soul_sand',     { tex: 'soul_sand', shape: 'slab_top', speedFactor: 0.4,
                       tags: ['soul'] }),
  B('soul_soil',     { tex: 'soul_soil', speedFactor: 0.4, tags: ['soul'] }),
  B('magma_block',   { tex: 'magma', hazard: 'magma', light: 3 }),
  B('lava',          { tex: 'lava', shape: 'none', solid: false, fluid: 'lava',
                       hazard: 'lava', light: 15, opacity: 1 }),
  B('glowstone',     { tex: 'glowstone', light: 15 }),
  B('nether_portal', { tex: 'nether_portal', shape: 'none', solid: false,
                       transparent: true, opacity: 0.75, light: 11, tags: ['goal'] }),

  // --- potions: walk through one to drink it (you can come back for a refill)
  B('potion_speed',    { tex: 'potion_speed', shape: 'none', solid: false, cross: true,
                         transparent: true, light: 4,
                         effect: { name: 'speed', level: 2, ticks: 600 } }),
  B('potion_jump',     { tex: 'potion_jump', shape: 'none', solid: false, cross: true,
                         transparent: true, light: 4,
                         effect: { name: 'jump_boost', level: 2, ticks: 600 } }),
  B('potion_slowfall', { tex: 'potion_slowfall', shape: 'none', solid: false, cross: true,
                         transparent: true, light: 4,
                         effect: { name: 'slow_falling', level: 1, ticks: 400 } }),

  // --- gameplay markers ----------------------------------------------------
  B('checkpoint',    { tex: 'checkpoint', light: 6, tags: ['checkpoint'] }),
  B('goal',          { tex: 'goal', light: 12, tags: ['goal'] }),
];

export const BLOCKS = new Map(defs.map((b) => [b.id, b]));
export const AIR = B('air', { shape: 'none', solid: false, tex: 'stone' });

export function getBlock(id) {
  if (!id || id === 'air') return AIR;
  return BLOCKS.get(id) || AIR;
}

// Collision boxes for a block, offset into world space at (x, y, z).
export function collisionBoxes(id, x, y, z, facing) {
  const b = getBlock(id);
  if (!b.solid) return [];
  const key = facing && b.shape.startsWith('stairs') ? 'stairs_' + facing : b.shape;
  const boxes = SHAPES[key] || SHAPES[b.shape] || SHAPES.full;
  return boxes.map((s) => [s[0] + x, s[1] + y, s[2] + z, s[3] + x, s[4] + y, s[5] + z]);
}

export function renderBoxes(id, facing) {
  const b = getBlock(id);
  const shapeName = b.renderShape ||
    (facing && b.shape.startsWith('stairs') ? 'stairs_' + facing : b.shape);
  if (b.shape === 'none' && !b.cross) return b.solid ? SHAPES.full : SHAPES.full;
  return SHAPES[shapeName] || SHAPES.full;
}

export function texturesFor(id) {
  const t = getBlock(id).tex;
  return typeof t === 'string' ? { top: t, side: t, bottom: t } : t;
}
