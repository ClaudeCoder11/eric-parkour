// ---------------------------------------------------------------------------
// Turns the block world into geometry.
//
// Levels are static, so instead of instancing we merge everything into two
// buffers (opaque + transparent) and drop faces that are hidden between solid
// blocks. That is one draw call each, and a typical level loses ~70% of its
// faces to the hidden-face check.
//
// Face shading is baked into vertex colours the way Minecraft does it:
// top brightest, north/south mid, east/west darker, bottom darkest.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { getBlock, renderBoxes, texturesFor } from './blocks.js';
import { buildAtlas } from './textures.js';

const SHADE = { top: 1.0, bottom: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };

// face -> [normal, which texture, shade, and the 4 corners as (u,v) of the box]
const FACES = [
  { dir: [0, 1, 0],  tex: 'top',    shade: SHADE.top },
  { dir: [0, -1, 0], tex: 'bottom', shade: SHADE.bottom },
  { dir: [0, 0, 1],  tex: 'side',   shade: SHADE.south },
  { dir: [0, 0, -1], tex: 'side',   shade: SHADE.north },
  { dir: [1, 0, 0],  tex: 'side',   shade: SHADE.east },
  { dir: [-1, 0, 0], tex: 'side',   shade: SHADE.west },
];

const isFullCube = (b) => b[0] === 0 && b[1] === 0 && b[2] === 0 &&
                          b[3] === 1 && b[4] === 1 && b[5] === 1;

// Corners of one face of a box, counter-clockwise seen from outside,
// returned as [x, y, z, u, v] where u,v are 0..1 across that face.
function faceCorners(box, dir) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const [dx, dy, dz] = dir;
  if (dy === 1)  return [[x0,y1,z1,0,0],[x1,y1,z1,1,0],[x1,y1,z0,1,1],[x0,y1,z0,0,1]];
  if (dy === -1) return [[x0,y0,z0,0,0],[x1,y0,z0,1,0],[x1,y0,z1,1,1],[x0,y0,z1,0,1]];
  if (dz === 1)  return [[x0,y0,z1,0,0],[x1,y0,z1,1,0],[x1,y1,z1,1,1],[x0,y1,z1,0,1]];
  if (dz === -1) return [[x1,y0,z0,0,0],[x0,y0,z0,1,0],[x0,y1,z0,1,1],[x1,y1,z0,0,1]];
  if (dx === 1)  return [[x1,y0,z1,0,0],[x1,y0,z0,1,0],[x1,y1,z0,1,1],[x1,y1,z1,0,1]];
  return           [[x0,y0,z0,0,0],[x0,y0,z1,1,0],[x0,y1,z1,1,1],[x0,y1,z0,0,1]];
}

class Buffers {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.norm = []; this.idx = []; this.n = 0; }
  quad(corners, ox, oy, oz, uvRect, shade, dir, tint) {
    const [u0, v0, u1, v1] = uvRect;
    for (const [x, y, z, fu, fv] of corners) {
      this.pos.push(x + ox, y + oy, z + oz);
      this.uv.push(u0 + (u1 - u0) * fu, v0 + (v1 - v0) * fv);
      this.col.push(shade * tint[0], shade * tint[1], shade * tint[2]);
      this.norm.push(dir[0], dir[1], dir[2]);
    }
    const i = this.n;
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    this.n += 4;
  }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Build meshes for a world. Returns a THREE.Group plus a dispose() function.
 * `tint` optionally recolours specific blocks per biome (e.g. jungle grass).
 */
export function buildWorldMesh(world, { tint = {} } = {}) {
  const atlas = buildAtlas();
  const opaque = new Buffers();
  const alpha = new Buffers();
  const WHITE = [1, 1, 1];

  for (const b of world.blocks.values()) {
    const def = getBlock(b.id);
    const tex = texturesFor(b.id);
    const buf = def.transparent ? alpha : opaque;
    const tintRGB = tint[b.id] || WHITE;

    // Ladders, vines and cobwebs are drawn as two crossed quads, like Minecraft.
    if (def.cross) {
      const rect = atlas.uv(tex.side);
      const s = 0.5, lo = 0.5 - s * 0.707, hi = 0.5 + s * 0.707;
      const crosses = [
        [[lo, 0, lo, 0, 0], [hi, 0, hi, 1, 0], [hi, 1, hi, 1, 1], [lo, 1, lo, 0, 1]],
        [[lo, 0, hi, 0, 0], [hi, 0, lo, 1, 0], [hi, 1, lo, 1, 1], [lo, 1, hi, 0, 1]],
      ];
      for (const c of crosses) {
        buf.quad(c, b.x, b.y, b.z, rect, 0.95, [0, 1, 0], tintRGB);
        buf.quad([...c].reverse(), b.x, b.y, b.z, rect, 0.95, [0, -1, 0], tintRGB);
      }
      continue;
    }

    const boxes = renderBoxes(b.id, b.facing);
    for (const box of boxes) {
      const full = isFullCube(box);
      for (const f of FACES) {
        // Hidden-face removal: only safe when this face fills the whole block
        // side and the neighbour is an opaque full cube.
        if (full) {
          const n = world.get(b.x + f.dir[0], b.y + f.dir[1], b.z + f.dir[2]);
          if (n) {
            const nd = getBlock(n.id);
            const nBoxes = renderBoxes(n.id, n.facing);
            if (nd.solid && !nd.transparent && !nd.cross &&
                nBoxes.length === 1 && isFullCube(nBoxes[0])) continue;
          }
        }
        buf.quad(faceCorners(box, f.dir), b.x, b.y, b.z,
                 atlas.uv(tex[f.tex]), f.shade, f.dir, tintRGB);
      }
    }
  }

  const group = new THREE.Group();
  const materials = [];

  if (opaque.n) {
    const m = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true });
    materials.push(m);
    group.add(new THREE.Mesh(opaque.toGeometry(), m));
  }
  if (alpha.n) {
    const m = new THREE.MeshBasicMaterial({
      map: atlas.texture, vertexColors: true, transparent: true,
      alphaTest: 0.1, depthWrite: true, side: THREE.DoubleSide,
    });
    materials.push(m);
    const mesh = new THREE.Mesh(alpha.toGeometry(), m);
    mesh.renderOrder = 1;
    group.add(mesh);
  }

  group.userData.dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    materials.forEach((m) => m.dispose());
  };
  group.userData.faceCount = (opaque.n + alpha.n) / 4;
  return group;
}
