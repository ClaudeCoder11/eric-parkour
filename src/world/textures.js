// ---------------------------------------------------------------------------
// Every block texture in this game is DRAWN BY CODE at load time into a canvas.
// No Minecraft image files are used or needed. Each tile is 16x16, packed into
// one atlas so the whole world can be drawn with a single material.
// ---------------------------------------------------------------------------
import * as THREE from '../../lib/three.module.js';

const TILE = 16;
const COLS = 8;                 // atlas is COLS x COLS tiles

// --- tiny deterministic RNG so textures look identical every run -----------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

const hex = (c) => [ (c >> 16) & 255, (c >> 8) & 255, c & 255 ];
const clamp255 = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;

// A tiny painting surface: 16x16 of RGBA, with helpers.
class Tile {
  constructor(seed) {
    this.px = new Uint8ClampedArray(TILE * TILE * 4);
    this.rand = rng(seed);
    this.px.fill(255);
  }
  set(x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    this.px[i] = clamp255(r); this.px[i + 1] = clamp255(g);
    this.px[i + 2] = clamp255(b); this.px[i + 3] = clamp255(a);
  }
  setHex(x, y, color, a = 255) {
    const [r, g, b] = hex(color);
    this.set(x, y, r, g, b, a);
    return this;
  }
  // Fill with a base colour plus per-pixel brightness noise (the pixel-art look)
  noise(color, amount = 18, alpha = 255) {
    const [r, g, b] = hex(color);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const d = (this.rand() - 0.5) * 2 * amount;
        this.set(x, y, r + d, g + d, b + d, alpha);
      }
    }
    return this;
  }
  // Scatter a few darker/lighter speckles
  speckle(color, count = 20, size = 1) {
    const [r, g, b] = hex(color);
    for (let i = 0; i < count; i++) {
      const x = (this.rand() * TILE) | 0, y = (this.rand() * TILE) | 0;
      for (let dy = 0; dy < size; dy++)
        for (let dx = 0; dx < size; dx++) this.set(x + dx, y + dy, r, g, b);
    }
    return this;
  }
  hline(y, color, x0 = 0, x1 = TILE) {
    const [r, g, b] = hex(color);
    for (let x = x0; x < x1; x++) this.set(x, y, r, g, b);
    return this;
  }
  vline(x, color, y0 = 0, y1 = TILE) {
    const [r, g, b] = hex(color);
    for (let y = y0; y < y1; y++) this.set(x, y, r, g, b);
    return this;
  }
  rect(x0, y0, w, h, color) {
    const [r, g, b] = hex(color);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) this.set(x, y, r, g, b);
    return this;
  }
  // Darken the outer 1px ring a little: reads as a bevelled cube edge
  bevel(strength = 22) {
    for (let i = 0; i < TILE; i++) {
      for (const [x, y] of [[i, 0], [i, TILE - 1], [0, i], [TILE - 1, i]]) {
        const k = (y * TILE + x) * 4;
        this.px[k] -= strength; this.px[k + 1] -= strength; this.px[k + 2] -= strength;
      }
    }
    return this;
  }
  clear() { this.px.fill(0); return this; }
}

// --- the texture recipes ---------------------------------------------------
// Each entry gets its own seed so it is stable and independent of draw order.
const RECIPES = {
  // Plains / overworld
  grass_top:    (t) => t.noise(0x6aab3c, 16).speckle(0x77bb44, 26),
  dirt:         (t) => t.noise(0x8a5a34, 20).speckle(0x6f4526, 18),
  grass_side:   (t) => { t.noise(0x8a5a34, 20).speckle(0x6f4526, 14);
                         for (let x = 0; x < TILE; x++) {
                           const h = 3 + ((t.rand() * 2.6) | 0);
                           for (let y = 0; y < h; y++) {
                             const d = (t.rand() - 0.5) * 26;
                             t.set(x, y, 0x6a + d, 0xab + d, 0x3c + d);
                           } } },
  stone:        (t) => t.noise(0x828282, 14).speckle(0x6e6e6e, 24),
  cobblestone:  (t) => { t.noise(0x7a7a7a, 10);
                         for (let i = 0; i < 9; i++) {
                           const x = (t.rand() * 13) | 0, y = (t.rand() * 13) | 0;
                           const w = 3 + ((t.rand() * 3) | 0), h = 3 + ((t.rand() * 3) | 0);
                           t.rect(x, y, w, h, 0x8f8f8f);
                           t.rect(x, y, w, 1, 0x666666);
                         } t.speckle(0x5e5e5e, 18); },
  oak_planks:   (t) => { t.noise(0xb08a54, 12);
                         for (let y = 3; y < TILE; y += 4) t.hline(y, 0x8a6a3c);
                         for (let i = 0; i < 5; i++)
                           t.vline((t.rand() * TILE) | 0, 0x9c7846,
                                   ((t.rand() * 12) | 0), ((t.rand() * 12) | 0) + 4); },
  oak_log_side: (t) => { t.noise(0x6b5330, 12);
                         for (let x = 0; x < TILE; x += 3) t.vline(x, 0x584327); },
  oak_log_top:  (t) => { t.noise(0xb08a54, 10);
                         for (let r = 2; r < 8; r += 2)
                           for (let a = 0; a < 64; a++) {
                             const th = a / 64 * Math.PI * 2;
                             t.setHex((8 + Math.cos(th) * r) | 0, (8 + Math.sin(th) * r) | 0, 0x8a6a3c);
                           } },
  oak_leaves:   (t) => { t.noise(0x3f7f28, 22).speckle(0x2c5c1c, 34);
                         for (let i = 0; i < 26; i++)
                           t.set((t.rand() * TILE) | 0, (t.rand() * TILE) | 0, 0, 0, 0, 0); },
  sand:         (t) => t.noise(0xdbd08a, 12).speckle(0xcfc077, 22),
  gravel:       (t) => t.noise(0x8b8683, 18).speckle(0x6d6764, 30).speckle(0xa9a4a0, 16),
  fence_wood:   (t) => t.noise(0x9c7846, 14),

  // Snowy tundra
  snow:         (t) => t.noise(0xf2f7f9, 8).speckle(0xe2ecf2, 14),
  ice:          (t) => { t.noise(0x9fc6f0, 10);
                         for (let i = 0; i < 5; i++) {
                           const x = (t.rand() * TILE) | 0;
                           t.vline(x, 0xbcdcff, 0, (t.rand() * TILE) | 0);
                         } },
  packed_ice:   (t) => t.noise(0x8db8e8, 8).speckle(0xa8cdf5, 18),
  blue_ice:     (t) => t.noise(0x6fa3e8, 8).speckle(0x94c2ff, 20),
  powder_snow:  (t) => t.noise(0xfbfeff, 6).speckle(0xdfeaf2, 10),

  // Jungle
  jungle_planks:(t) => { t.noise(0xa2735a, 12);
                         for (let y = 3; y < TILE; y += 4) t.hline(y, 0x7d5541); },
  jungle_leaves:(t) => { t.noise(0x2f7a1e, 24).speckle(0x1f5613, 34);
                         for (let i = 0; i < 22; i++)
                           t.set((t.rand() * TILE) | 0, (t.rand() * TILE) | 0, 0, 0, 0, 0); },
  vine:         (t) => { t.clear();
                         for (let x = 1; x < TILE; x += 4) {
                           let y = 0;
                           while (y < TILE) {
                             const w = 1 + ((t.rand() * 2) | 0);
                             for (let i = 0; i < w; i++) t.setHex(x + i, y, 0x2f6a1c);
                             y += 1;
                           } } },
  slime:        (t) => { t.noise(0x77c34a, 14, 200).rect(3, 3, 10, 10, 0x8ed85e);
                         t.rect(5, 5, 6, 6, 0x66b03c); },
  honey:        (t) => { t.noise(0xe8a52a, 12, 225).rect(2, 2, 12, 12, 0xf4bb3e);
                         t.speckle(0xd8901a, 14); },
  scaffolding:  (t) => { t.clear();
                         t.rect(0, 0, TILE, 2, 0xc9a860); t.rect(0, 14, TILE, 2, 0xc9a860);
                         t.rect(0, 0, 2, TILE, 0xa8873f); t.rect(14, 0, 2, TILE, 0xa8873f); },
  water:        (t) => t.noise(0x3a6fd8, 12, 175).speckle(0x5a8bea, 16),

  // Badlands / deep dark
  terracotta:   (t) => t.noise(0x9a5a3c, 14).speckle(0x81462c, 20),
  red_sand:     (t) => t.noise(0xb2603a, 12).speckle(0xa2532f, 20),
  deepslate:    (t) => t.noise(0x4b4b52, 12).speckle(0x3a3a41, 24),
  sculk:        (t) => { t.noise(0x14232b, 10).speckle(0x1f4b57, 22);
                         for (let i = 0; i < 6; i++)
                           t.setHex((t.rand() * TILE) | 0, (t.rand() * TILE) | 0, 0x2fd6c8); },
  piston_side:  (t) => { t.noise(0x9a8f7d, 10);
                         t.rect(0, 0, TILE, 3, 0x6f665a); t.rect(0, 13, TILE, 3, 0x6f665a); },
  piston_top:   (t) => { t.noise(0xb59a6d, 10); t.rect(2, 2, 12, 12, 0xc9ac7c); },
  sticky_top:   (t) => { t.noise(0x77c34a, 12); t.rect(2, 2, 12, 12, 0x8ed85e); },
  redstone:     (t) => t.noise(0xa81b1b, 16).speckle(0xd93030, 22),
  obsidian:     (t) => t.noise(0x191026, 10).speckle(0x2e1f49, 18),
  iron_block:   (t) => t.noise(0xd6d6d6, 8).speckle(0xbdbdbd, 14),
  trapdoor:     (t) => { t.noise(0x9c7846, 10);
                         t.rect(0, 0, TILE, 2, 0x7a5c35); t.rect(0, 14, TILE, 2, 0x7a5c35);
                         t.rect(7, 2, 2, 12, 0x7a5c35); },

  // Nether wastes
  netherrack:   (t) => t.noise(0x6e2020, 16).speckle(0x521616, 26).speckle(0x8a2c2c, 18),
  soul_sand:    (t) => { t.noise(0x513a2c, 14).speckle(0x3c2b20, 22);
                         for (const [x, y] of [[4, 5], [10, 8]]) {
                           t.rect(x, y, 3, 4, 0x2e2018); t.setHex(x + 1, y + 1, 0x6a5040);
                         } },
  soul_soil:    (t) => t.noise(0x4a3629, 14).speckle(0x38281e, 22),
  magma:        (t) => { t.noise(0x3a1a10, 10);
                         for (let i = 0; i < 7; i++) {
                           const x = (t.rand() * 12) | 0, y = (t.rand() * 12) | 0;
                           t.rect(x, y, 3 + ((t.rand() * 2) | 0), 3, 0xd8641a);
                           t.rect(x + 1, y + 1, 2, 1, 0xffb038);
                         } },
  lava:         (t) => { t.noise(0xd85410, 16).speckle(0xffb43a, 26).speckle(0xa53208, 16); },
  nether_brick: (t) => { t.noise(0x38202a, 8);
                         for (let y = 3; y < TILE; y += 4) t.hline(y, 0x241419);
                         for (let y = 0; y < TILE; y += 4)
                           t.vline(((y / 4) % 2 ? 4 : 11), 0x241419, y, y + 4); },
  glowstone:    (t) => t.noise(0xd8b45a, 14).speckle(0xffe89a, 30),
  crimson:      (t) => { t.noise(0x7b3a55, 12);
                         for (let y = 3; y < TILE; y += 4) t.hline(y, 0x5d2b41); },
  nether_portal:(t) => t.noise(0x7a2ecb, 26, 200).speckle(0xb46bff, 30),

  // Potions (level 5)
  potion_speed:   (t) => potionBottle(t, 0x39b0e8, 0x9fe4ff),
  potion_jump:    (t) => potionBottle(t, 0x8a3ce0, 0xd0a4ff),
  potion_slowfall:(t) => potionBottle(t, 0xdfe6ee, 0xffffff),

  // Utility / goal blocks
  cobweb:       (t) => { t.clear();
                         const line = (x0, y0, x1, y1) => {
                           const n = 20;
                           for (let i = 0; i <= n; i++)
                             t.setHex(Math.round(x0 + (x1 - x0) * i / n),
                                      Math.round(y0 + (y1 - y0) * i / n), 0xe8e8e8);
                         };
                         for (let a = 0; a < 8; a++) {
                           const th = a / 8 * Math.PI * 2;
                           line(8, 8, 8 + Math.cos(th) * 8, 8 + Math.sin(th) * 8);
                         }
                         for (let r = 3; r <= 7; r += 2)
                           for (let a = 0; a < 40; a++) {
                             const th = a / 40 * Math.PI * 2;
                             t.setHex((8 + Math.cos(th) * r) | 0, (8 + Math.sin(th) * r) | 0, 0xdddddd);
                           } },
  ladder:       (t) => { t.clear();
                         t.rect(2, 0, 2, TILE, 0x9c7846); t.rect(12, 0, 2, TILE, 0x9c7846);
                         for (let y = 2; y < TILE; y += 5) t.rect(2, y, 12, 2, 0xb08a54); },
  gold_block:   (t) => t.noise(0xf0c020, 10).speckle(0xfff08a, 16),
  emerald_block:(t) => t.noise(0x2fc46a, 12).speckle(0x6fe89c, 18),
  quartz:       (t) => t.noise(0xeae5dd, 8).speckle(0xd8d2c8, 14),
  bedrock:      (t) => t.noise(0x3a3a3a, 22).speckle(0x1e1e1e, 30).speckle(0x585858, 20),
  checkpoint:   (t) => { t.noise(0x2b3a4a, 10); t.rect(3, 3, 10, 10, 0x1a2836);
                         t.rect(5, 5, 6, 6, 0x35d6ff); t.rect(7, 7, 2, 2, 0xbdf3ff); },
  goal:         (t) => { t.noise(0xd8b45a, 12); t.rect(2, 2, 12, 12, 0xffe89a);
                         t.rect(5, 5, 6, 6, 0xfff8d0); },
};

// A little glass bottle, drawn once and tinted per potion type.
function potionBottle(t, liquid, glint) {
  t.clear();
  t.rect(6, 1, 4, 2, 0xb8c4cc);          // neck
  t.rect(5, 3, 6, 2, 0xcdd8de);          // shoulder
  t.rect(4, 5, 8, 9, 0xcdd8de);          // body glass
  t.rect(5, 7, 6, 6, liquid);            // the potion itself
  t.rect(5, 7, 6, 1, glint);             // surface highlight
  t.setHex(5, 9, glint); t.setHex(6, 12, glint);
  return t;
}

export const TEXTURE_NAMES = Object.keys(RECIPES);

let _atlas = null;

// Build the atlas once. Returns { texture, uv(name) -> [u0,v0,u1,v1] }.
export function buildAtlas() {
  if (_atlas) return _atlas;

  const size = COLS * TILE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const slots = new Map();
  TEXTURE_NAMES.forEach((name, i) => {
    const tile = new Tile(0x9e3779b9 ^ (i * 2654435761));
    RECIPES[name](tile);
    if (name !== 'cobweb' && name !== 'ladder' && name !== 'vine' &&
        name !== 'scaffolding' && name !== 'water' && name !== 'nether_portal') {
      tile.bevel();
    }
    const col = i % COLS, row = (i / COLS) | 0;
    ctx.putImageData(new ImageData(tile.px, TILE, TILE), col * TILE, row * TILE);
    slots.set(name, { col, row });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;   // crisp pixels, never blurry
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // Inset by a fraction of a texel so neighbouring tiles never bleed through.
  const inset = 0.5 / size;
  const uv = (name) => {
    const s = slots.get(name) || slots.get('stone');
    const u0 = s.col / COLS + inset, v1 = 1 - s.row / COLS - inset;
    const u1 = (s.col + 1) / COLS - inset, v0 = 1 - (s.row + 1) / COLS + inset;
    return [u0, v0, u1, v1];
  };

  _atlas = { texture, uv, canvas, tileSize: TILE, cols: COLS };
  return _atlas;
}
