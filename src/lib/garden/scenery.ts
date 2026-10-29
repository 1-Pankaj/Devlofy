/**
 * Garden scenery — the world around the tree, generated as pixel runs.
 *
 * Given a width in scene units, a seed and a mode, `buildScenery` lays out the
 * whole backdrop:
 *
 *   - a twelve-stop sky — indigo night burning into a rose-and-amber horizon
 *     at dusk, a violet-to-gold burn while a block runs — with a dithered
 *     "last light" band sitting on the horizon;
 *   - a star field (dim pinpricks, bright twinkles, a few four-point crosses),
 *     the moon top-left — where the light comes from — or a low half-set sun;
 *   - three hill ridges with atmospheric fade, silhouette pines on the near
 *     crest, and a small windmill turning on the far one;
 *   - a meadow in three green bands, textured with quiet light dashes and
 *     young blades that lean as they sway, dotted with tiny flowers planted
 *     in drifts, and crossed by a footpath that leaves the clearing for the
 *     bottom of the frame;
 *   - a pond in the foreground-left, under the moon, with a dark shore, a
 *     mud rim, layered water and a moon glint — plus lily pads and cattails;
 *   - a soil clearing with a wobbled edge, a lit pocket toward the moon, a
 *     sparse scatter of clods, two clean accent rings around the trunk, and
 *     the tree's contact shadow.
 *
 * Deterministic: the same (width, seed, mode) returns the same world. Pure
 * data, no react — the component just compiles runs into paths.
 */

import { mulberry32 } from './model';
import {
  SPRITE_CLOUD_1,
  SPRITE_CLOUD_1G,
  SPRITE_CLOUD_2,
  SPRITE_CLOUD_2G,
  SPRITE_GRASS,
  SPRITE_MOON,
  SPRITE_SUN,
  type Run,
  type Sprite,
} from './sprites';

/** Scene height in units — the vertical design space, fixed. */
export const SCENE_ROWS = 96;
/** Where the meadow starts. Everything above is sky. */
export const HORIZON = 50;
/** The clearing's centre row (soil the tree stands on). */
export const CLEARING_ROW = 73;

export type SceneryMode = 'dusk' | 'gold';

// ── skies ────────────────────────────────────────────────────────────────────
// Twelve stops, zenith to horizon. Dusk: indigo into dusty rose. Gold: the
// earned sky — deep violet burning into amber while a block runs.

const DUSK_SKY = [
  '#0A0D24',
  '#101430',
  '#181A40',
  '#212250',
  '#2C2A5E',
  '#3A356C',
  '#4C4178',
  '#5F4A80',
  '#754F82',
  '#8C5580',
  '#A56078',
  '#BE6C6C',
];

const GOLD_SKY = [
  '#221A44',
  '#332052',
  '#4A2757',
  '#632C56',
  '#7E3554',
  '#98424C',
  '#B25444',
  '#C96A3C',
  '#DE8338',
  '#EE9C33',
  '#F7B434',
  '#FFC94A',
];

/** The warm band that sits on the horizon, dithered into the last sky stop. */
const DUSK_HORIZON_GLOW = ['#D0865E', '#E89A5E'];
const GOLD_HORIZON_GLOW = ['#FFDF6B', '#FFE98F'];

/** The meadow's three green bands, far to near. */
const GROUND_BANDS = [
  { from: HORIZON, to: 64, color: '#1C3E2C' },
  { from: 64, to: 80, color: '#245033' },
  { from: 80, to: SCENE_ROWS, color: '#2C613C' },
];

/** The meadow at golden hour — warmer, lit from the west. */
const GOLD_GROUND_BANDS = [
  { from: HORIZON, to: 64, color: '#497036' },
  { from: 64, to: 80, color: '#57803C' },
  { from: 80, to: SCENE_ROWS, color: '#6B9247' },
];

/** Three ridges, far to near: lighter = farther (atmospheric fade). */
const RIDGES = {
  dusk: [
    { base: 47.5, amp: 3.4, color: '#453B6E', rim: '#544980' },
    { base: 51.5, amp: 3.0, color: '#342D58', rim: '#403866' },
    { base: 55.0, amp: 2.4, color: '#272347', rim: '#302B55' },
  ],
  gold: [
    { base: 47.5, amp: 3.4, color: '#8A5570', rim: '#9C6276' },
    { base: 51.5, amp: 3.0, color: '#66445E', rim: '#745066' },
    { base: 55.0, amp: 2.4, color: '#4A3350', rim: '#563C5A' },
  ],
};

const PINE_COLORS = {
  dusk: { body: '#1C1A3E', rim: '#2A2856' },
  gold: { body: '#37284A', rim: '#453456' },
};

const SKY_BAND_HEIGHT = HORIZON / 12;

export type CloudPlacement = {
  /** Anchor column; the component drifts it with the tick. */
  col: number;
  row: number;
  sprite: Sprite;
  /** Units per tick. */
  speed: number;
  layer: 'far' | 'near';
};

export type ScatterItem = {
  sprite: Sprite;
  col: number;
  row: number;
  flip: boolean;
};

export type Blade = {
  col: number;
  row: number;
  len: number;
  color: string;
  /** Sway group 0..3 — the scene steps the groups out of phase. */
  phase: number;
  /** Static lean of the blade tip: -1, 0 or 1. */
  lean: number;
};

export type Scenery = {
  /** Width the scenery was built for, in units. */
  width: number;
  mode: SceneryMode;
  clearing: { col: number; row: number; rx: number; ry: number };
  /** Sky rows (0..HORIZON-1) plus the dithered horizon glow. */
  sky: Run[];
  /** 1-px stars; the component twinkles the bright ones. */
  stars: { col: number; row: number; bright: boolean; cross: boolean; phase: number }[];
  /** Moon (dusk) or low sun (gold), top-left anchor. */
  lamp: { col: number; row: number; sprite: Sprite };
  clouds: CloudPlacement[];
  /** Three ridges, their rims, and the pines on the near crest. */
  ridgeRuns: Run[];
  /** The far ridge's windmill; the scene turns the blades. */
  windmill: { col: number; row: number } | null;
  /** Meadow bands plus texture dashes. */
  meadow: Run[];
  /** Young blades the scene sways. */
  blades: Blade[];
  /** Tiny meadow flowers, painted as runs. */
  flowerDots: Run[];
  /** The footpath, when the frame is wide enough for one. */
  path: Run[] | null;
  pond: { col: number; row: number; rx: number; ry: number } | null;
  pondRuns: Run[];
  lilies: { col: number; row: number; flower: boolean }[];
  reeds: { col: number; row: number; flip: boolean }[];
  /** Soil clearing, its rim, clods and stones. */
  clearingRuns: Run[];
  /** Growth rings — the accent the scene shares with the interface. */
  rings: Run[];
  /** The tree's contact shadow. */
  shadow: Run[];
  /** Grass tufts and flower clumps scattered outside the clearing. */
  scatter: ScatterItem[];
};

/** Fill one row range with a single colour and return it as runs. */
function bandRuns(row: number, from: number, to: number, color: string): Run[] {
  if (to <= from) return [];
  return [{ row, col: from, len: to - from, color }];
}

function skyRuns(width: number, mode: SceneryMode): Run[] {
  const palette = mode === 'gold' ? GOLD_SKY : DUSK_SKY;
  const glow = mode === 'gold' ? GOLD_HORIZON_GLOW : DUSK_HORIZON_GLOW;
  const runs: Run[] = [];
  for (let row = 0; row < HORIZON; row += 1) {
    const index = Math.min(11, Math.floor(row / SKY_BAND_HEIGHT));
    runs.push(...bandRuns(row, 0, width, palette[index]));
  }
  // The last-light band: two dithered rows of warmth sitting on the horizon.
  for (let row = HORIZON - 3; row < HORIZON; row += 1) {
    const color = glow[row - (HORIZON - 3)] ?? glow[1];
    for (let col = 0; col < width; col += 4) {
      runs.push({ row, col, len: 2, color });
      runs.push({ row, col: col + 2, len: 2, color: palette[11] });
    }
  }
  return runs;
}

function starField(width: number, seed: number, mode: SceneryMode, lamp: { col: number; row: number }) {
  const rand = mulberry32(seed ^ 0x51ab3f);
  const ceiling = mode === 'gold' ? 16 : HORIZON - 10;
  const count =
    mode === 'gold'
      ? Math.max(4, Math.floor(width / 12))
      : Math.max(18, Math.min(80, Math.floor(width / 4.4)));
  const stars: Scenery['stars'] = [];
  let crosses = 0;
  for (let i = 0; i < count; i += 1) {
    const col = Math.floor(rand() * width);
    const row = 1 + Math.floor(rand() * (ceiling - 2));
    // Keep the lamp's neighbourhood clear — stars don't shine through it.
    if (Math.abs(col - lamp.col - 6) < 10 && Math.abs(row - lamp.row - 6) < 10) continue;
    const bright = rand() < 0.2;
    const cross = bright && crosses < 5 && rand() < 0.4;
    if (cross) crosses += 1;
    stars.push({
      col,
      row,
      bright,
      cross,
      phase: Math.floor(rand() * 4),
    });
  }
  return stars;
}

/** A ridge line: a seeded sine crest, filled down to the horizon. */
function ridgeRuns(
  width: number,
  seed: number,
  baseRow: number,
  amplitude: number,
  color: string,
  rim: string,
): { runs: Run[]; crest: number[] } {
  const rand = mulberry32(seed);
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  const f1 = 0.045 + rand() * 0.02;
  const f2 = 0.012 + rand() * 0.008;
  const crest: number[] = [];
  for (let col = 0; col < width; col += 1) {
    const h =
      baseRow -
      (amplitude * (0.55 + 0.7 * Math.sin(col * f1 + p1)) + amplitude * 0.5 * Math.sin(col * f2 + p2));
    crest.push(Math.round(h));
  }
  const runs: Run[] = [];
  const top = Math.min(...crest);
  for (let row = Math.max(0, top); row < HORIZON; row += 1) {
    let col = 0;
    while (col < width) {
      if (crest[col] <= row) {
        let len = 1;
        while (col + len < width && crest[col + len] <= row) len += 1;
        runs.push({ row, col, len, color });
        col += len;
      } else {
        col += 1;
      }
    }
  }
  // A 1-px lighter rim along the crest — the haze catching the sky.
  for (let col = 0; col < width; col += 1) {
    runs.push({ row: crest[col], col, len: 1, color: rim });
  }
  return { runs, crest };
}

/** A tiered pine silhouette standing on `baseRow`. */
function pineRuns(
  col: number,
  baseRow: number,
  height: number,
  body: string,
  rim: string,
): Run[] {
  const runs: Run[] = [];
  const tiers = 3;
  const tierH = Math.max(2, Math.round(height / (tiers + 1)));
  for (let t = 0; t < tiers; t += 1) {
    const tierTop = baseRow - height + t * tierH;
    const tierBase = tierTop + tierH;
    const halfBase = 1 + t * 1.6;
    for (let row = tierTop; row <= tierBase; row += 1) {
      const k = (row - tierTop) / Math.max(1, tierH);
      const half = Math.max(0.5, Math.round(0.6 + halfBase * k));
      runs.push({ row, col: col - half, len: half * 2 + 1, color: body });
    }
    runs.push({ row: tierTop, col: col - 1, len: 1, color: rim });
  }
  // Trunk nub.
  runs.push({ row: baseRow + 1, col: col - 0.5, len: 2, color: body } as Run);
  runs.push({ row: baseRow, col: Math.round(col - 1), len: 2, color: body });
  return runs.map((run) => ({ ...run, col: Math.round(run.col) }));
}

/** The far ridge's windmill: a stone tower with a cap, seen small. */
function windmillRuns(col: number, baseRow: number, color: string, cap: string): Run[] {
  const runs: Run[] = [];
  for (let row = baseRow - 10; row <= baseRow; row += 1) {
    const k = (baseRow - row) / 10;
    const half = Math.round(2.4 - k * 1.1);
    runs.push({ row, col: col - half, len: half * 2 + 1, color });
  }
  runs.push({ row: baseRow - 12, col: col - 1, len: 3, color: cap });
  runs.push({ row: baseRow - 11, col: col - 1, len: 3, color: cap });
  // The door, one warm pixel — someone keeps the light on.
  runs.push({ row: baseRow - 1, col, len: 1, color: '#E89A5E' });
  return runs;
}

/** Pixel-ellipse fill: runs per row between cy±ry. */
function ellipseRuns(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  onlyEdge = false,
  edgeColor?: string,
): Run[] {
  const runs: Run[] = [];
  for (let row = Math.ceil(cy - ry); row <= Math.floor(cy + ry); row += 1) {
    const t = (row - cy) / ry;
    const inside = 1 - t * t;
    if (inside <= 0) continue;
    const half = rx * Math.sqrt(inside);
    const from = Math.round(cx - half);
    const to = Math.round(cx + half);
    if (onlyEdge) {
      // Two short runs: the left and right edge pixels of this row.
      runs.push({ row, col: from, len: 1, color: edgeColor ?? color });
      if (to > from + 1) runs.push({ row, col: to - 1, len: 1, color: edgeColor ?? color });
    } else {
      runs.push({ row, col: from, len: Math.max(1, to - from), color });
    }
  }
  return runs;
}

/**
 * A clean connected ellipse outline (midpoint algorithm). Unlike sampling the
 * edge per row, every pixel connects to the next, so a ring never dissolves
 * into stray dots where its arc runs flat.
 */
function ellipseOutline(cx: number, cy: number, rx: number, ry: number, color: string): Run[] {
  const points = new Set<string>();
  const mark = (x: number, y: number) => {
    points.add(`${Math.round(x)},${Math.round(y)}`);
  };
  let x = 0;
  let y = ry;
  let d1 = ry * ry - rx * rx * ry + rx * rx / 4;
  let dx = 2 * ry * ry * x;
  let dy = 2 * rx * rx * y;
  const cxi = Math.round(cx);
  const cyi = Math.round(cy);
  while (dx < dy) {
    mark(cxi + x, cyi + y);
    mark(cxi - x, cyi + y);
    mark(cxi + x, cyi - y);
    mark(cxi - x, cyi - y);
    if (d1 < 0) {
      x += 1;
      dx += 2 * ry * ry;
      d1 += dx + ry * ry;
    } else {
      x += 1;
      y -= 1;
      dx += 2 * ry * ry;
      dy -= 2 * rx * rx;
      d1 += dx - dy + ry * ry;
    }
  }
  let d2 =
    ry * ry * ((x + 0.5) * (x + 0.5)) + rx * rx * ((y - 1) * (y - 1)) - rx * rx * ry * ry;
  while (y >= 0) {
    mark(cxi + x, cyi + y);
    mark(cxi - x, cyi + y);
    mark(cxi + x, cyi - y);
    mark(cxi - x, cyi - y);
    if (d2 > 0) {
      y -= 1;
      dy -= 2 * rx * rx;
      d2 += rx * rx - dy;
    } else {
      y -= 1;
      x += 1;
      dx += 2 * ry * ry;
      dy -= 2 * rx * rx;
      d2 += dx - dy + rx * rx;
    }
  }
  const byRow = new Map<number, number[]>();
  for (const key of points) {
    const [xs, ys] = key.split(',');
    const col = parseInt(xs, 10);
    const row = parseInt(ys, 10);
    const bucket = byRow.get(row);
    if (bucket) bucket.push(col);
    else byRow.set(row, [col]);
  }
  const runs: Run[] = [];
  for (const [row, cols] of byRow) {
    cols.sort((a, b) => a - b);
    runs.push({ row, col: cols[0], len: 1, color });
    const last = cols[cols.length - 1];
    if (last !== cols[0]) runs.push({ row, col: last, len: 1, color });
  }
  return runs;
}

export function buildScenery(options: {
  width: number;
  seed: number;
  mode: SceneryMode;
}): Scenery {
  const { seed, mode } = options;
  // The width always covers the viewport; keep a sane floor for tiny frames.
  const width = Math.max(48, Math.round(options.width));
  const wide = width >= 110;

  const rand = mulberry32(seed ^ 0x1d7f3c);
  const lamp =
    mode === 'gold'
      ? { col: Math.max(2, Math.min(width - 16, Math.round(width * 0.62))), row: HORIZON - 12, sprite: SPRITE_SUN }
      : { col: Math.max(2, Math.min(width - 16, Math.round(width * 0.14))), row: 5, sprite: SPRITE_MOON };

  const stars = starField(width, seed, mode, lamp);

  // Clouds: two far, one near, all drifting — but none spawns on the moon,
  // which would read as a bite out of it the moment the frame appears.
  const farSprite = mode === 'gold' ? SPRITE_CLOUD_1G : SPRITE_CLOUD_1;
  const nearSprite = mode === 'gold' ? SPRITE_CLOUD_2G : SPRITE_CLOUD_2;
  const clearOfLamp = (col: number, sprite: Sprite): number => {
    let c = col;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (Math.abs(c + sprite.w / 2 - (lamp.col + sprite.w / 2)) > sprite.w + 8) break;
      c = (c + sprite.w + 9) % Math.max(1, width - sprite.w);
    }
    return c;
  };
  const clouds: CloudPlacement[] = [
    {
      col: clearOfLamp(Math.floor(rand() * width), farSprite),
      row: 8 + Math.floor(rand() * 4),
      sprite: farSprite,
      speed: 0.045,
      layer: 'far',
    },
    {
      col: clearOfLamp(Math.floor(rand() * width), farSprite),
      row: 17 + Math.floor(rand() * 4),
      sprite: farSprite,
      speed: 0.03,
      layer: 'far',
    },
    {
      col: clearOfLamp(Math.floor(rand() * width), nearSprite),
      row: 26 + Math.floor(rand() * 4),
      sprite: nearSprite,
      speed: 0.07,
      layer: 'near',
    },
  ];

  // The ridges, then their pines and the windmill.
  const ridgeColors = RIDGES[mode];
  const farRidge = ridgeRuns(width, seed ^ 0x2a11, ridgeColors[0].base, ridgeColors[0].amp, ridgeColors[0].color, ridgeColors[0].rim);
  const midRidge = ridgeRuns(width, seed ^ 0x77d2, ridgeColors[1].base, ridgeColors[1].amp, ridgeColors[1].color, ridgeColors[1].rim);
  const nearRidge = ridgeRuns(width, seed ^ 0x91c3, ridgeColors[2].base, ridgeColors[2].amp, ridgeColors[2].color, ridgeColors[2].rim);

  const pineColors = PINE_COLORS[mode];
  const ridge = [...farRidge.runs, ...midRidge.runs, ...nearRidge.runs];
  const pineCount = Math.max(2, Math.floor(width / 34));
  for (let i = 0; i < pineCount; i += 1) {
    const col = Math.floor(rand() * width);
    if (Math.abs(col - lamp.col) < 10) continue;
    const height = 7 + Math.floor(rand() * 5);
    ridge.push(...pineRuns(col, nearRidge.crest[Math.min(col, width - 1)] + 1, height, pineColors.body, pineColors.rim));
  }

  // The windmill turns on the far ridge, away from the moon.
  let windmill: Scenery['windmill'] = null;
  if (wide) {
    const col = Math.min(width - 10, Math.max(8, Math.round(width * 0.8)));
    windmill = { col, row: farRidge.crest[Math.min(col, width - 1)] + 2 };
    ridge.push(...windmillRuns(col, windmill.row, mode === 'gold' ? '#5E3C58' : '#3A3260', mode === 'gold' ? '#4A3048' : '#2C264E'));
  }

  // Meadow bands + texture dashes: quiet horizontal strokes, biased toward
  // the band seams where a mown field would show its lines.
  const bands = mode === 'gold' ? GOLD_GROUND_BANDS : GROUND_BANDS;
  const dashLight = mode === 'gold' ? '#6FA653' : '#357447';
  const dashDark = mode === 'gold' ? '#2C4F28' : '#16301F';
  const meadow: Run[] = [];
  for (const band of bands) {
    for (let row = band.from; row < band.to; row += 1) {
      meadow.push(...bandRuns(row, 0, width, band.color));
    }
  }
  const fleckRand = mulberry32(seed ^ 0x0f10c2);
  const flecks = Math.floor(width * 0.42);
  for (let i = 0; i < flecks; i += 1) {
    const col = Math.floor(fleckRand() * (width - 3));
    const row = HORIZON + 2 + Math.floor(fleckRand() * (SCENE_ROWS - HORIZON - 3));
    const light = fleckRand() < 0.5;
    meadow.push({
      row,
      col,
      len: 2 + Math.floor(fleckRand() * 2),
      color: light ? dashLight : dashDark,
    });
  }

  // The clearing, before anything else claims the meadow floor. Its edge
  // wobbles a little — a bed, not a stamped ellipse.
  const rx = Math.max(36, Math.min(90, width * 0.28));
  const ry = 8.5;
  const clearing = { col: width / 2, row: CLEARING_ROW, rx, ry };
  const edgePhase = rand() * Math.PI * 2;
  const clearingRuns: Run[] = [];
  const halfWidthAt = (row: number, scale: number): number => {
    const t = (row - clearing.row) / (ry * scale);
    if (Math.abs(t) >= 1) return 0;
    const base = rx * scale * Math.sqrt(1 - t * t);
    const wobble = 1 + 0.05 * Math.sin(row * 0.55 + edgePhase) + 0.035 * Math.sin(row * 1.3 + edgePhase * 2);
    return base * wobble;
  };
  // Grass overhang on the top rim, then the soil body, a broad lit pocket
  // toward the moon, a moon-kissed bright patch, and a dark lower edge —
  // the bed should read as turned earth under a low light, not a shadow.
  for (let row = Math.ceil(clearing.row - ry) - 1; row <= Math.floor(clearing.row + ry) + 1; row += 1) {
    const half = halfWidthAt(row, 1);
    if (half <= 0) continue;
    const from = Math.round(clearing.col - half);
    const to = Math.round(clearing.col + half);
    clearingRuns.push({ row, col: from, len: Math.max(1, to - from), color: '#3D2B16' });
  }
  for (let row = Math.ceil(clearing.row - ry) - 1; row <= Math.floor(clearing.row - ry * 0.55); row += 1) {
    const half = halfWidthAt(row, 1.045);
    if (half <= 0) continue;
    const from = Math.round(clearing.col - half);
    const to = Math.round(clearing.col + half);
    clearingRuns.push({ row, col: from, len: Math.max(1, to - from), color: '#16301F' });
  }
  for (let row = Math.floor(clearing.row + ry * 0.55); row <= Math.floor(clearing.row + ry) + 1; row += 1) {
    const half = halfWidthAt(row, 1.03);
    if (half <= 0) continue;
    clearingRuns.push({ row, col: Math.round(clearing.col - half), len: 1, color: '#2A1B0C' });
    clearingRuns.push({ row, col: Math.round(clearing.col + half) - 1, len: 1, color: '#2A1B0C' });
  }
  for (let row = Math.ceil(clearing.row - ry * 0.78); row <= Math.floor(clearing.row + ry * 0.25); row += 1) {
    const half = halfWidthAt(row, 0.62);
    if (half <= 0) continue;
    const from = Math.round(clearing.col - half - rx * 0.1);
    const to = Math.round(clearing.col + half - rx * 0.1);
    clearingRuns.push({ row, col: from, len: Math.max(1, to - from), color: '#4C3720' });
  }
  for (let row = Math.ceil(clearing.row - ry * 0.5); row <= Math.floor(clearing.row - ry * 0.05); row += 1) {
    const half = halfWidthAt(row, 0.3);
    if (half <= 0) continue;
    const from = Math.round(clearing.col - half - rx * 0.16);
    const to = Math.round(clearing.col + half - rx * 0.16);
    clearingRuns.push({ row, col: from, len: Math.max(1, to - from), color: '#5E4526' });
  }
  // Clods: sparse, small, never a speckle storm.
  const clodRand = mulberry32(seed ^ 0x6e21a7);
  const clods = Math.floor(rx * 0.3);
  for (let i = 0; i < clods; i += 1) {
    const a = clodRand() * Math.PI * 2;
    const d = Math.sqrt(clodRand()) * 0.85;
    const col = Math.round(clearing.col + Math.cos(a) * rx * d);
    const row = Math.round(clearing.row + Math.sin(a) * ry * d);
    const roll = clodRand();
    clearingRuns.push({ row, col, len: roll < 0.25 ? 2 : 1, color: roll < 0.45 ? '#5E4526' : roll < 0.8 ? '#4C3720' : '#2A1B0C' });
  }

  // Growth rings — the accent. Two clean, connected rings hugging the trunk,
  // so they frame the plant at every stage instead of decorating empty soil.
  const rings: Run[] = [
    ...ellipseOutline(clearing.col, clearing.row, rx * 0.13, 2, '#8B7CFF'),
    ...ellipseOutline(clearing.col, clearing.row, rx * 0.2, 2.9, '#8B7CFF'),
  ];

  const shadow = ellipseRuns(clearing.col, clearing.row + 1.2, rx * 0.24, 1.6, '#0A0A0F');

  // The pond, foreground-left, under the moon: a dark shore, a mud rim,
  // layered water and a glint that points at the sky's lamp.
  let pond: Scenery['pond'] = null;
  let pondRuns: Run[] = [];
  const lilies: Scenery['lilies'] = [];
  const reeds: Scenery['reeds'] = [];
  if (wide) {
    const pondRand = mulberry32(seed ^ 0x24d1b3);
    const col = Math.max(18, Math.round(width * 0.12));
    const row = 90;
    const prx = 15 + Math.round(pondRand() * 4);
    const pry = 6;
    pond = { col, row, rx: prx, ry: pry };
    pondRuns = [
      // Dark shore line, mud rim, then the water: deep to lit, toward the moon.
      ...ellipseRuns(col, row, prx + 1.4, pry + 1.2, '#10131F'),
      ...ellipseRuns(col, row, prx + 0.5, pry + 0.4, '#4C3720'),
      ...ellipseRuns(col, row, prx, pry, '#16304F'),
      ...ellipseRuns(col, row - 0.5, prx * 0.92, pry * 0.8, '#24406E'),
      ...ellipseRuns(col, row - 1.8, prx * 0.74, pry * 0.45, '#46699C'),
      // A lit arc on the upper-left limb, facing the moon.
      ...ellipseRuns(col - prx * 0.18, row - 1.2, prx * 0.8, pry * 0.6, '#7FA0D0', true, '#7FA0D0'),
    ];
    // The glint: a short column of light under the lamp, broken by ripple.
    const glintCol = Math.round(col + (lamp.col - col) * 0.3);
    pondRuns.push(
      { row: row - 3, col: glintCol - 1, len: 3, color: '#7FA0D0' },
      { row: row - 1, col: glintCol - 2, len: 4, color: '#8FAAD8' },
      { row: row + 1, col: glintCol, len: 2, color: '#7FA0D0' },
    );
    lilies.push(
      { col: col - prx * 0.42, row: row - 1, flower: pondRand() < 0.6 },
      { col: col + prx * 0.36, row: row + 1, flower: pondRand() < 0.4 },
    );
    reeds.push(
      { col: col + prx - 1, row: row - 12, flip: false },
      { col: col - prx - 4, row: row - 11, flip: true },
    );
  }

  // The footpath: leaves the clearing's right edge, wanders to the frame —
  // lighter than the soil it leaves, with a dark edge and rare stones.
  let path: Run[] | null = null;
  if (wide) {
    path = [];
    const startCol = clearing.col + rx * 0.45;
    for (let row = Math.round(clearing.row + ry * 0.72); row < SCENE_ROWS; row += 1) {
      const t = (row - clearing.row) / (SCENE_ROWS - clearing.row);
      const centre = startCol - t * 9 + Math.sin(row * 0.4) * 2;
      const halfW = 1.6 + t * 2.6;
      const from = Math.round(centre - halfW);
      const to = Math.round(centre + halfW);
      path.push({ row, col: from, len: to - from, color: '#4C3720' });
      path.push({ row, col: from + 1, len: Math.max(1, to - from - 2), color: '#5E4526' });
      if (to > from) path.push({ row, col: to - 1, len: 1, color: '#3D2B16' });
      if ((row * 7) % 11 === 0) path.push({ row, col: from + 1, len: 1, color: '#2A1B0C' });
      if ((row * 13) % 29 === 0) path.push({ row, col: to - 2, len: 1, color: '#353B54' });
    }
  }

  // Young blades — leaning strokes the scene sways, four phases out of step.
  const blades: Blade[] = [];
  const bladeRand = mulberry32(seed ^ 0x7b1d55);
  const bladeCount = Math.floor(width * 0.8);
  for (let i = 0; i < bladeCount; i += 1) {
    const col = Math.floor(bladeRand() * width);
    const row = HORIZON + 3 + Math.floor(bladeRand() * (SCENE_ROWS - HORIZON - 4));
    if (inClearing(col, row, clearing, 3)) continue;
    if (pond && inPond(col, row, pond, 3)) continue;
    if (path && onPath(col, row, path)) continue;
    const roll = bladeRand();
    blades.push({
      col,
      row,
      len: roll < 0.22 ? 2 : 1,
      color: roll < 0.4 ? '#4E9B52' : roll < 0.8 ? '#6FBF5E' : '#2E8544',
      phase: Math.floor(bladeRand() * 4),
      lean: bladeRand() < 0.3 ? -1 : bladeRand() < 0.45 ? 1 : 0,
    });
  }

  // Tiny meadow flowers: a plus of petals over a stem, planted in drifts —
  // three clusters to every loner, so the meadow reads in drifts, not polka.
  const flowerDots: Run[] = [];
  const dotRand = mulberry32(seed ^ 0x3fa912);
  const drifts = Math.max(2, Math.floor(width * 0.024));
  for (let i = 0; i < drifts; i += 1) {
    let col = Math.floor(dotRand() * (width - 6)) + 3;
    let row = HORIZON + 6 + Math.floor(dotRand() * (SCENE_ROWS - HORIZON - 10));
    if (inClearing(col, row, clearing, 3)) continue;
    if (pond && inPond(col, row, pond, 3)) continue;
    if (path && onPath(col, row, path)) continue;
    const companions = 1 + Math.floor(dotRand() * 3);
    for (let f = 0; f <= companions; f += 1) {
      const fc = col + (f === 0 ? 0 : Math.round((dotRand() - 0.5) * 9));
      const fr = row + (f === 0 ? 0 : Math.round((dotRand() - 0.5) * 5));
      if (fc < 1 || fc > width - 2 || fr < HORIZON + 3 || fr > SCENE_ROWS - 4) continue;
      if (inClearing(fc, fr, clearing, 2)) continue;
      if (pond && inPond(fc, fr, pond, 2)) continue;
      if (path && onPath(fc, fr, path)) continue;
      const kind = dotRand();
      const petal = kind < 0.62 ? '#F5F2E6' : kind < 0.85 ? '#D96B8C' : '#F2C7D8';
      flowerDots.push(
        { row: fr - 1, col: fc, len: 1, color: petal },
        { row: fr, col: fc - 1, len: 1, color: petal },
        { row: fr, col: fc + 1, len: 1, color: petal },
        { row: fr, col: fc, len: 1, color: '#F2C14E' },
        { row: fr + 1, col: fc, len: 1, color: '#4E9B52' },
      );
    }
  }

  // Scatter: grass tufts, kept out of the soil, the water and the path.
  const scatter: ScatterItem[] = [];
  const scatterCount = Math.max(5, Math.floor(width / 14));
  const scatterRand = mulberry32(seed ^ 0x3cc1a7);
  for (let i = 0; i < scatterCount; i += 1) {
    const col = Math.floor(scatterRand() * (width - 8));
    const row = HORIZON + 5 + Math.floor(scatterRand() * (SCENE_ROWS - HORIZON - 9));
    if (inClearing(col, row, clearing, 8)) continue;
    if (pond && inPond(col, row, pond, 4)) continue;
    if (path && onPath(col, row, path)) continue;
    scatter.push({ sprite: SPRITE_GRASS, col, row, flip: scatterRand() < 0.5 });
  }

  return {
    width,
    mode,
    clearing,
    sky: skyRuns(width, mode),
    stars,
    lamp,
    clouds,
    ridgeRuns: ridge,
    windmill,
    meadow,
    blades,
    flowerDots,
    path,
    pond,
    pondRuns,
    lilies,
    reeds,
    clearingRuns,
    rings,
    shadow,
    scatter,
  };
}

/** Inside the clearing's ellipse (with a margin), in scene units. */
function inClearing(
  col: number,
  row: number,
  clearing: { col: number; row: number; rx: number; ry: number },
  margin: number,
): boolean {
  const dx = (col - clearing.col) / (clearing.rx + margin);
  const dy = (row - clearing.row) / (clearing.ry + margin * 0.6);
  return dx * dx + dy * dy < 1;
}

/** Inside the pond's ellipse (with a margin). */
function inPond(
  col: number,
  row: number,
  pond: { col: number; row: number; rx: number; ry: number },
  margin: number,
): boolean {
  const dx = (col - pond.col) / (pond.rx + margin);
  const dy = (row - pond.row) / (pond.ry + margin * 0.5);
  return dx * dx + dy * dy < 1;
}

/** On the footpath's painted pixels. */
function onPath(col: number, row: number, path: Run[]): boolean {
  for (const run of path) {
    if (run.row === row && col >= run.col && col < run.col + run.len) return true;
  }
  return false;
}
