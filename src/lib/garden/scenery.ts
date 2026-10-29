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
 *   - a meadow in three green bands, textured with light dashes and young
 *     blades (the blades carry a phase so the scene can sway them), dotted
 *     with tiny flowers, and crossed by a footpath that leaves the clearing
 *     for the bottom of the frame;
 *   - a pond in the foreground-left, under the moon, with lily pads and
 *     cattails — the water keeps its shimmer data so the scene can move it;
 *   - the soil clearing with its rim, clods and stones, the accent growth
 *     rings, and the tree's contact shadow.
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
      : Math.max(18, Math.min(90, Math.floor(width / 4)));
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

/** Pixels where the ellipse metric crosses radius k — a ring outline. */
function ellipseRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  k: number,
  color: string,
): Run[] {
  const runs: Run[] = [];
  for (let row = Math.ceil(cy - ry * k); row <= Math.floor(cy + ry * k); row += 1) {
    const t = (row - cy) / (ry * k);
    const inside = 1 - t * t;
    if (inside <= 0) continue;
    const half = rx * k * Math.sqrt(inside);
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    runs.push({ row, col: left, len: 1, color });
    if (right !== left) runs.push({ row, col: right, len: 1, color });
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

  // Meadow bands + texture dashes.
  const bands = mode === 'gold' ? GOLD_GROUND_BANDS : GROUND_BANDS;
  const meadow: Run[] = [];
  for (const band of bands) {
    for (let row = band.from; row < band.to; row += 1) {
      meadow.push(...bandRuns(row, 0, width, band.color));
    }
  }
  const fleckRand = mulberry32(seed ^ 0x0f10c2);
  const flecks = Math.floor(width * 0.8);
  for (let i = 0; i < flecks; i += 1) {
    const col = Math.floor(fleckRand() * width);
    const row = HORIZON + 2 + Math.floor(fleckRand() * (SCENE_ROWS - HORIZON - 3));
    const light = fleckRand() < 0.45;
    meadow.push({
      row,
      col,
      len: fleckRand() < 0.3 ? 2 : 1,
      color: mode === 'gold'
        ? light ? '#6FA653' : '#2C4F28'
        : light ? '#357447' : '#16301F',
    });
  }

  // The clearing, before anything else claims the meadow floor.
  const rx = Math.max(36, Math.min(90, width * 0.28));
  const ry = 8.5;
  const clearing = { col: width / 2, row: CLEARING_ROW, rx, ry };
  const clearingRuns: Run[] = [
    // Top rim: grass overhangs the soil.
    ...ellipseRuns(clearing.col, clearing.row - 0.6, rx * 1.04, ry * 0.6, '#16301F'),
    ...ellipseRuns(clearing.col, clearing.row, rx, ry, '#3D2B16'),
    // A lit pocket toward the moon.
    ...ellipseRuns(clearing.col - rx * 0.22, clearing.row - 1.5, rx * 0.52, ry * 0.5, '#4C3720'),
    ...ellipseRuns(clearing.col, clearing.row, rx, ry, '#1C1207', true),
  ];
  const clodRand = mulberry32(seed ^ 0x6e21a7);
  const clods = Math.floor(rx * 0.9);
  for (let i = 0; i < clods; i += 1) {
    const a = clodRand() * Math.PI * 2;
    const d = Math.sqrt(clodRand()) * 0.92;
    const col = Math.round(clearing.col + Math.cos(a) * rx * d);
    const row = Math.round(clearing.row + Math.sin(a) * ry * d);
    const roll = clodRand();
    clearingRuns.push({ row, col, len: roll < 0.3 ? 2 : 1, color: roll < 0.5 ? '#5E4526' : roll < 0.8 ? '#4C3720' : '#2A1B0C' });
    if (roll > 0.93) clearingRuns.push({ row, col: col + 1, len: 1, color: '#353B54' });
  }

  const rings: Run[] = [
    ...ellipseRing(clearing.col, clearing.row, rx, ry, 0.52, '#8B7CFF'),
    ...ellipseRing(clearing.col, clearing.row, rx, ry, 0.8, '#8B7CFF'),
  ];

  const shadow = ellipseRuns(clearing.col, clearing.row + 1.2, rx * 0.36, 1.7, '#0A0A0F');

  // The pond, foreground-left, under the moon.
  let pond: Scenery['pond'] = null;
  let pondRuns: Run[] = [];
  const lilies: Scenery['lilies'] = [];
  const reeds: Scenery['reeds'] = [];
  if (wide) {
    const pondRand = mulberry32(seed ^ 0x24d1b3);
    const col = Math.max(18, Math.round(width * 0.12));
    const row = 90;
    const prx = 14 + Math.round(pondRand() * 3);
    const pry = 5.5;
    pond = { col, row, rx: prx, ry: pry };
    pondRuns = [
      ...ellipseRuns(col, row, prx, pry, '#16304F'),
      ...ellipseRuns(col, row - 0.4, prx * 0.94, pry * 0.82, '#24406E'),
      ...ellipseRuns(col, row - 1.6, prx * 0.8, pry * 0.45, '#46699C'),
      ...ellipseRuns(col, row, prx, pry, '#16304F', true),
      // A moon glint: a short stack of light where the water faces the sky.
      { row: row - 3, col: col - 1, len: 3, color: '#7FA0D0' },
      { row: row - 1, col: col - 2, len: 4, color: '#7FA0D0' },
    ];
    lilies.push(
      { col: col - prx * 0.4, row: row - 1, flower: pondRand() < 0.6 },
      { col: col + prx * 0.35, row: row + 1, flower: pondRand() < 0.4 },
    );
    reeds.push(
      { col: col + prx - 2, row: row - 9, flip: false },
      { col: col - prx + 1, row: row - 8, flip: true },
    );
  }

  // The footpath: leaves the clearing's right edge, wanders to the frame.
  let path: Run[] | null = null;
  if (wide) {
    path = [];
    const startCol = clearing.col + rx * 0.42;
    for (let row = Math.round(clearing.row + ry * 0.72); row < SCENE_ROWS; row += 1) {
      const t = (row - clearing.row) / (SCENE_ROWS - clearing.row);
      const centre = startCol - t * 10 + Math.sin(row * 0.45) * 1.6;
      const halfW = 1.6 + t * 2.4;
      const from = Math.round(centre - halfW);
      const to = Math.round(centre + halfW);
      path.push({ row, col: from, len: to - from, color: '#4C3720' });
      if (to > from) path.push({ row, col: to - 1, len: 1, color: '#3D2B16' });
      if ((row * 7) % 5 === 0) path.push({ row, col: from + 1, len: 1, color: '#2A1B0C' });
    }
  }

  // Young blades — the scene sways them, four phases out of step.
  const blades: Blade[] = [];
  const bladeRand = mulberry32(seed ^ 0x7b1d55);
  const bladeCount = Math.floor(width * 1.1);
  for (let i = 0; i < bladeCount; i += 1) {
    const col = Math.floor(bladeRand() * width);
    const row = HORIZON + 3 + Math.floor(bladeRand() * (SCENE_ROWS - HORIZON - 4));
    if (inClearing(col, row, clearing, 3)) continue;
    if (pond && inPond(col, row, pond, 3)) continue;
    if (path && onPath(col, row, path)) continue;
    blades.push({
      col,
      row,
      len: bladeRand() < 0.3 ? 2 : 1,
      color: bladeRand() < 0.55 ? '#4E9B52' : '#6FBF5E',
      phase: Math.floor(bladeRand() * 4),
    });
  }

  // Tiny meadow flowers: three petals around a gold centre, painted straight.
  // Two of every three dots cluster, so the meadow reads in drifts, not polka.
  const flowerDots: Run[] = [];
  const dotRand = mulberry32(seed ^ 0x3fa912);
  const dots = Math.floor(width * 0.075);
  const dotSpots: { col: number; row: number }[] = [];
  for (let i = 0; i < dots; i += 1) {
    let col = Math.floor(dotRand() * (width - 2)) + 1;
    let row = HORIZON + 4 + Math.floor(dotRand() * (SCENE_ROWS - HORIZON - 6));
    if (inClearing(col, row, clearing, 3)) continue;
    if (pond && inPond(col, row, pond, 3)) continue;
    // Every third dot pulls two companions close — a drift, not a scatter.
    if (i % 3 === 0) {
      dotSpots.push({ col, row });
    } else if (dotSpots.length > 0) {
      const spot = dotSpots[dotSpots.length - 1];
      col = spot.col + (dotRand() < 0.5 ? -2 : 2);
      row = spot.row + (dotRand() < 0.5 ? -1 : 1);
    }
    const rose = dotRand() < 0.3;
    flowerDots.push(
      { row: row - 1, col, len: 1, color: rose ? '#D96B8C' : '#F5F2E6' },
      { row, col: col - 1, len: 1, color: rose ? '#D96B8C' : '#F5F2E6' },
      { row, col: col + 1, len: 1, color: rose ? '#D96B8C' : '#F5F2E6' },
      { row, col, len: 1, color: '#F2C14E' },
    );
  }

  // Scatter: grass tufts, kept out of the soil, the water and the path.
  const scatter: ScatterItem[] = [];
  const scatterCount = Math.max(6, Math.floor(width / 10));
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
