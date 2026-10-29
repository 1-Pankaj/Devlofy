/**
 * The pixel tree — grown in code, one pixel at a time.
 *
 * The 3D garden generated its tree from `(seed, growth)` and the pixel garden
 * keeps exactly that contract: `growPixelTree(seed, growth)` paints a
 * deterministic character buffer and returns it as runs the renderer compiles
 * into path data.
 *
 * How the art is built, in paint order:
 *   1. a trunk with an S-curve spine, four-tone bark, a knot, and a flared
 *      root base that grips the ground line;
 *   2. recursive limbs — tapering strokes, fanned two or three ways a level —
 *      whose tips carry the canopy;
 *   3. foliage clumps, back ones darker than front ones, each a clean disc
 *      whose tone bands step toward the top-left moonlight; band boundaries
 *      are dithered only where two bands meet, so the crown reads as crisp
 *      masses rather than confetti;
 *   4. where a later clump crosses an older one, its lower-right rim paints
 *      contact shadow, so the crown reads as overlapping puffs;
 *   5. the crown's bottom edge gets a shared under-shade, one shared
 *      silhouette outline unifies the clumps into a single crown, and — past
 *      82% growth — blossom opens on the lit side.
 *
 * Pure math on a char buffer: no react-native, no react, fully deterministic.
 * The same (seed, growth) always grows the same tree, and growth only crosses
 * a 5% bucket (see `bucketGrowth`) before the tree is asked to regrow.
 */

import { mulberry32 } from './model';
import type { Run } from './sprites';

const SIZE_W = 96;
const SIZE_H = 76;
/** The row the trunk stands on (bottom row of the buffer). */
export const TREE_BASELINE = SIZE_H - 1;
/** Buffer centre column — the trunk's anchor. */
export const TREE_CENTRE = SIZE_W / 2;

type Buffer = string[][];

function makeBuffer(): Buffer {
  return Array.from({ length: SIZE_H }, () => Array<string>(SIZE_W).fill('.'));
}

/** Cheap position hash — the "wobble" that keeps edges from looking stamped. */
function wobble(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h >>> 8) & 0xff) / 0xff; // 0..1
}

const LEAF_CHARS = new Set(['O', 'D', 'L', 'G', 'H', 'J', 'j']);

function leafAt(buf: Buffer, x: number, y: number): boolean {
  if (y < 0 || y >= SIZE_H || x < 0 || x >= SIZE_W) return false;
  return LEAF_CHARS.has(buf[y][x]);
}

function setPx(buf: Buffer, x: number, y: number, ch: string): void {
  const col = Math.round(x);
  const row = Math.round(y);
  if (col < 0 || col >= SIZE_W || row < 0 || row >= SIZE_H) return;
  buf[row][col] = ch;
}

export type PixelTree = {
  /** Horizontal runs, in buffer coordinates. */
  runs: Run[];
  /** Rows above this line participate in the wind sway. */
  swayRow: number;
  /** Top-most painted row — the tree's height in pixels. */
  topRow: number;
};

/** The foliage clump: clean tone bands toward the top-left light. */
function stampClump(
  buf: Buffer,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  front: boolean,
): void {
  const r = Math.max(2.6, radius);
  const reach = Math.ceil(r + 1.4);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || x >= SIZE_W || y < 0 || y >= SIZE_H) continue;
      const nx = dx / r;
      const ny = dy / r;
      // A gentle edge wobble keeps the disc organic without shredding it.
      const noise = (wobble(x, y, seed) - 0.5) * 0.2;
      const d = Math.sqrt(nx * nx + ny * ny) + noise;
      if (d > 1.1) continue;
      const existing = buf[y][x];
      // t > 0 means "toward the top-left light"; the light vector is biased
      // vertical because the moon sits high.
      const t = -ny * 0.88 - nx * 0.46 + noise * 0.35;
      let ch: string;
      if (front) {
        if (t > 0.58) ch = 'J';
        else if (t > 0.26) ch = (x + y) % 2 === 0 && t > 0.4 ? 'J' : 'H';
        else if (t > -0.12) ch = t > 0.04 && (x + y) % 2 === 0 ? 'H' : 'G';
        else if (t > -0.5) ch = 'L';
        else ch = 'D';
      } else {
        if (t > 0.5) ch = 'H';
        else if (t > 0.04) ch = 'G';
        else if (t > -0.42) ch = 'L';
        else ch = 'D';
      }
      // Contact shadow: where this clump crosses an older one, its lower rim
      // goes darkest so the two masses separate.
      if (LEAF_CHARS.has(existing) && t < -0.26) {
        buf[y][x] = 'O';
        continue;
      }
      buf[y][x] = ch;
    }
  }
}

/**
 * Grow the tree. `growth` is the raw 0..1 value; callers bucket it first so
 * the shape only regenerates when the change can actually be seen.
 */
export function growPixelTree(seed: number, growth: number): PixelTree {
  const buf = makeBuffer();
  const rand = mulberry32(seed ^ 0x51ab1e);
  const wobbleSeed = seed & 0xffff;

  const trunkLength = 11 + 17 * growth;
  const trunkHalfWidth = 1.4 + 2.9 * growth;
  const maxDepth = growth < 0.15 ? 1 : growth < 0.32 ? 2 : growth < 0.58 ? 3 : 4;
  const clumpRadius = 3.4 + 4.1 * growth;

  let topRow = TREE_BASELINE;
  let forkRow = TREE_BASELINE;
  const tips: { x: number; y: number }[] = [];

  const paint = (x: number, y: number) => {
    if (y < topRow) topRow = y;
  };

  /** One trunk/bark stroke: tapering, four tones, outlined. */
  const stroke = (
    x0: number,
    y0: number,
    angle: number,
    length: number,
    halfWidth: number,
  ): { x: number; y: number } => {
    const steps = Math.max(1, Math.round(length));
    for (let k = 0; k <= steps; k += 1) {
      const px = x0 + Math.sin(angle) * k;
      const py = y0 - Math.cos(angle) * k;
      const w = Math.max(0.55, halfWidth * (1 - (0.42 * k) / steps));
      const left = Math.round(px - w);
      const right = Math.round(px + w);
      for (let col = left; col <= right; col += 1) {
        let ch = 'u';
        if (col === left) ch = w >= 1.4 ? 'T' : 't';
        else if (col === left + 1) ch = w >= 2.6 ? 'v' : 'u';
        else if (col === right) ch = w >= 1.4 ? 'T' : 't';
        else if (col === right - 1) ch = 't';
        else ch = wobble(col, py, wobbleSeed) < 0.05 ? 't' : 'u';
        setPx(buf, col, py, ch);
        paint(col, py);
      }
    }
    return { x: x0 + Math.sin(angle) * steps, y: y0 - Math.cos(angle) * steps };
  };

  const grow = (
    x: number,
    y: number,
    angle: number,
    length: number,
    halfWidth: number,
    depth: number,
  ): void => {
    const tip = stroke(x, y, angle, length, halfWidth);
    paint(tip.x, tip.y - 1);

    if (depth >= maxDepth || halfWidth < 0.62) {
      tips.push(tip);
      return;
    }
    const children = depth === 0 ? 3 : rand() < 0.55 ? 2 : 3;
    const fan = depth === 0 ? 0.5 : 0.82;
    for (let i = 0; i < children; i += 1) {
      const spread = fan * (i - (children - 1) / 2) * 2;
      const jitter = (rand() - 0.5) * 0.2;
      // Keep the crown from folding back under itself.
      const clamped = Math.max(-1.15, Math.min(1.15, angle + spread + jitter));
      grow(
        tip.x,
        tip.y,
        clamped,
        length * (0.52 + rand() * 0.22),
        Math.max(0.55, halfWidth * (0.52 + rand() * 0.1)),
        depth + 1,
      );
    }
  };

  // A slight lean, then the trunk. The fork row anchors the sway line.
  const lean = (rand() - 0.5) * 0.1;
  const fork = stroke(TREE_CENTRE, TREE_BASELINE, lean, trunkLength, trunkHalfWidth);
  forkRow = Math.round(fork.y);

  // A knot on the lower trunk — the scar every old tree carries.
  const knotRow = TREE_BASELINE - Math.max(3, Math.round(trunkLength * 0.34));
  const knotCol = Math.round(TREE_CENTRE + trunkHalfWidth * 0.3);
  setPx(buf, knotCol, knotRow, 'T');
  setPx(buf, knotCol + 1, knotRow, 't');
  setPx(buf, knotCol, knotRow + 1, 't');
  setPx(buf, knotCol + 1, knotRow + 1, 'T');

  // Root flare: knuckles that widen the base where it meets the soil, stepped
  // so it reads as roots gripping the ground rather than a painted slab.
  const baseW = Math.max(2, Math.round(trunkHalfWidth * 1.15) + 1);
  for (let col = TREE_CENTRE - baseW; col <= TREE_CENTRE + baseW; col += 1) {
    const edge = col === TREE_CENTRE - baseW || col === TREE_CENTRE + baseW;
    setPx(buf, col, TREE_BASELINE, edge ? 'T' : 'u');
    paint(col, TREE_BASELINE);
  }
  setPx(buf, TREE_CENTRE - baseW - 1, TREE_BASELINE, 'T');
  setPx(buf, TREE_CENTRE + baseW + 1, TREE_BASELINE, 'T');
  setPx(buf, TREE_CENTRE - baseW, TREE_BASELINE, 'v');
  setPx(buf, TREE_CENTRE + baseW, TREE_BASELINE, 't');
  for (let row = TREE_BASELINE - 2; row < TREE_BASELINE; row += 1) {
    const inset = row === TREE_BASELINE - 2 ? 1 : 0;
    setPx(buf, TREE_CENTRE - baseW + inset, row, 't');
    setPx(buf, TREE_CENTRE + baseW - inset, row, 't');
    if (inset === 0) {
      setPx(buf, TREE_CENTRE - baseW + 1, row, 'v');
      setPx(buf, TREE_CENTRE + baseW - 1, row, 't');
    }
  }

  // The limbs.
  grow(fork.x, fork.y, lean, trunkLength * 0.52, Math.max(1.1, trunkHalfWidth * 0.62), 1);

  // The canopy: a clump on every limb tip, fillers pulled toward the crown's
  // centre so the masses merge, and — at fuller growth — two low shoulder
  // clumps that round the crown's underside. Back clumps paint first, front
  // clumps last: the order is the depth.
  const clumps: { x: number; y: number; front: boolean; r: number }[] = tips.map((tip) => ({
    x: tip.x,
    y: tip.y - 1,
    front: rand() < 0.45,
    r: 1,
  }));
  if (clumps.length > 0) {
    const cx = clumps.reduce((sum, c) => sum + c.x, 0) / clumps.length;
    const cy = clumps.reduce((sum, c) => sum + c.y, 0) / clumps.length;
    const fillers = growth < 0.32 ? 1 : growth < 0.58 ? 3 : 5 + (rand() < 0.5 ? 1 : 0);
    for (let i = 0; i < fillers; i += 1) {
      const a = rand() * Math.PI * 2;
      const d = (0.22 + rand() * 0.46) * clumpRadius * 1.3;
      clumps.push({
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d * 0.62 - clumpRadius * 0.22,
        front: rand() < 0.4,
        r: 0.9 + rand() * 0.25,
      });
    }
    if (growth >= 0.58) {
      // Shoulders: low clumps left and right that round the crown's bottom
      // and drop the outline below the limb tips, so the crown never ends in
      // a flat shelf.
      clumps.push({ x: cx - clumpRadius * 1.15, y: cy + clumpRadius * 0.52, front: false, r: 0.85 });
      clumps.push({ x: cx + clumpRadius * 1.2, y: cy + clumpRadius * 0.42, front: false, r: 0.8 });
    }
  }
  // Stable paint order: seeded, back before front.
  clumps.sort((a, b) => Number(a.front) - Number(b.front) || a.x - b.x);
  for (const clump of clumps) {
    stampClump(
      buf,
      clump.x,
      clump.y,
      clumpRadius * clump.r * (0.86 + wobble(clump.x, clump.y, wobbleSeed) * 0.28),
      wobbleSeed + Math.round(clump.x),
      clump.front,
    );
  }

  // Crown under-shade: any leaf with open ground below it darkens, so the
  // canopy's bottom edge carries weight instead of dissolving into the sky.
  for (let row = 0; row < SIZE_H; row += 1) {
    for (let col = 0; col < SIZE_W; col += 1) {
      if (!leafAt(buf, col, row)) continue;
      const below = row + 1 < SIZE_H ? buf[row + 1][col] : '.';
      if (below !== '.') continue;
      const ch = buf[row][col];
      buf[row][col] =
        ch === 'O' || ch === 'D' ? 'O' : ch === 'L' || ch === 'G' ? 'D' : 'L';
    }
  }

  // One shared silhouette: any empty pixel that touches a leaf becomes
  // outline, so the separate clumps read as a single crown.
  const edges: [number, number, string][] = [];
  for (let row = 0; row < SIZE_H; row += 1) {
    for (let col = 0; col < SIZE_W; col += 1) {
      if (!leafAt(buf, col, row)) continue;
      const neighbours: [number, number][] = [
        [col - 1, row],
        [col + 1, row],
        [col, row - 1],
        [col, row + 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || nx >= SIZE_W || ny < 0 || ny >= SIZE_H) {
          edges.push([nx, ny, 'K']);
          continue;
        }
        if (buf[ny][nx] === '.') edges.push([nx, ny, 'K']);
      }
    }
  }
  for (const [x, y, ch] of edges) setPx(buf, x, y, ch);

  // Sparkles and blossom, on the lit tones only.
  if (growth >= 0.6) {
    for (let row = 0; row < SIZE_H; row += 1) {
      for (let col = 0; col < SIZE_W; col += 1) {
        if (buf[row][col] !== 'J') continue;
        const roll = wobble(col * 3 + 11, row * 7 + 3, wobbleSeed + 5);
        if (roll < 0.035) buf[row][col] = 'j';
        else if (growth >= 0.82 && roll > 0.985) buf[row][col] = rand() < 0.4 ? 'P' : 'p';
      }
    }
  }

  // Collect runs.
  const runs: Run[] = [];
  for (let row = 0; row < SIZE_H; row += 1) {
    const line = buf[row];
    let col = 0;
    while (col < SIZE_W) {
      const ch = line[col];
      let len = 1;
      while (col + len < SIZE_W && line[col + len] === ch) len += 1;
      if (ch !== '.') {
        const color = PALETTE_OF[ch];
        if (color) runs.push({ row, col, len, color });
      }
      col += len;
    }
  }

  return { runs, swayRow: Math.max(0, forkRow - Math.round(trunkLength * 0.18)), topRow };
}

/** Local mirror of the tree palette (kept tiny; see sprites.ts for the source). */
const PALETTE_OF: Record<string, string> = {
  K: '#10131F',
  O: '#0E2B1A',
  D: '#16452A',
  L: '#256B36',
  G: '#2E8544',
  H: '#48A853',
  J: '#7BC263',
  j: '#A9DE7E',
  P: '#F2C7D8',
  p: '#E39CBE',
  T: '#241608',
  t: '#3E2817',
  u: '#5C3B22',
  v: '#7A5230',
};
