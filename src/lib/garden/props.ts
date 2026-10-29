/**
 * Garden props — life beyond the tree, placed by data alone.
 *
 * The placement layer survived the move from 3D to pixels almost untouched,
 * because it never described geometry — it described *meaning*:
 *
 *  - `dressingFor(growth, projects)` — the always-on world: stones, grass, fern,
 *    log, stump, the focus lantern, the bench and the project signpost,
 *    unlocking in tiers as the tree grows.
 *  - `trophiesFor(stats)`           — earned objects: mushroom clusters per two
 *    hours focused, daisy patches per streak day, a cairn for depth, a sparrow
 *    for consistency. Pure functions of history — same data, same garden.
 *
 * Where the 3D scene placed props on a soil disc by (angle, radius, y=0), the
 * pixel scene places them around the clearing by (angle, radius) in scene
 * units: `angle` sweeps the ellipse, `radius` is metres of the old world
 * mapped to pixels, and depth (the sine of the angle) orders the painting.
 *
 * The slots were re-placed for the pixel world's composition: the pond owns
 * the foreground-left, the footpath leaves the foreground-right, so the big
 * props (bench, signpost) sit right and back while the small ones (mushrooms,
 * grass, flowers) keep the front. Every position is jittered by a hash of
 * (prop, slot), so the garden is stable across renders and devices — and
 * fully covered by `self-check.ts`.
 */

import { hashString, mulberry32, type GrowthInput } from './model';

export type GardenProp =
  | 'rock'
  | 'rocks'
  | 'grass'
  | 'fern'
  | 'log'
  | 'stump'
  | 'mushrooms'
  | 'flowers'
  | 'flowers2'
  | 'cairn'
  | 'lantern'
  | 'bird'
  | 'bench'
  | 'signpost';

export type PropPlacement = {
  prop: GardenProp;
  /** Slot id — stable render key and jitter seed. */
  slot: number;
  /** Angle around the clearing, radians (0 = in front of the tree). */
  angle: number;
  /** Distance from the clearing's centre, in metres of the old world. */
  radius: number;
  /** Always 1 — the art is authored at its final size, never scaled. */
  scale: number;
  /** Mirror the sprite — organic props only. */
  flip: boolean;
  /** Signpost only: plates to hang — the count of active projects. */
  notches?: number;
};

/** Props that must never mirror (they have a "right way round"). */
const NO_FLIP: ReadonlySet<GardenProp> = new Set([
  'lantern',
  'signpost',
  'bench',
  'cairn',
  'log',
  'bird',
]);

/**
 * Anchor slots around the clearing. Each slot is a pixel offset from the
 * clearing's centre: `x` spans the frame, `y` is the prop's base row relative
 * to the soil line (positive = toward the viewer). `placement` solves the
 * polar (angle, radius) form from these so the placement API — and the
 * self-check that pins it — stay stable while the composition stays exact:
 * hand-placing anchors in pixels is the only way to guarantee that twenty
 * sprites share one frame without colliding.
 *
 * The layout, left to right: a bench and boulder anchor the far left meadow,
 * the log and fern dress the soil's back edge, the mushroom trophies line
 * the front, the lantern sits on the soil beside the trunk, and the right
 * meadow carries the roses' bed, the cairn, the signpost and the rock
 * scatter. Every position is jittered by a hash of (prop, slot), so the
 * garden is stable across renders and devices.
 */
const SLOTS: { x: number; y: number }[] = [
  { x: -36, y: -4 }, // 0 · log — back edge, left of the trunk
  { x: -6, y: -4 }, // 1 · fern — back edge, right of the log
  { x: 4.5, y: 4 }, // 2 · stump — on the soil, in front of the trunk
  { x: -38, y: 13 }, // 3 · grass — front meadow, left
  { x: -52, y: -4 }, // 4 · rock — back-left corner
  { x: 36, y: -5 }, // 5 · rocks — back meadow, right
  { x: 9, y: 2 }, // 6 · bird — perched at the stump
  { x: -18, y: 1 }, // 7 · lantern — on the soil, left of the trunk
  { x: 0, y: 6 }, // 8 · (reserve)
  { x: -22.5, y: 13 }, // 9 · mushrooms — front row, left
  { x: -1.5, y: 15 }, // 10 · mushrooms — front row, centre
  { x: 15.5, y: 13 }, // 11 · mushrooms — front row, right
  { x: 19, y: -5 }, // 12 · cairn — back meadow, right of the trunk
  { x: 24, y: 15 }, // 13 · grass (second) — front meadow, right of centre
  { x: 54, y: 8 }, // 14 · flowers — right meadow corner
  { x: 34, y: 9 }, // 15 · flowers (second) — front meadow, right
  { x: 7, y: -5 }, // 16 · rock (second) — back edge, right of the trunk
  { x: 0, y: 6 }, // 17 · (reserve)
  { x: -51, y: 9 }, // 18 · bench — front-left meadow
  { x: 56, y: -4 }, // 19 · signpost — back-right corner
];

/** Scene-units per metre — kept in step with `garden-scene`'s METER. */
const METER = 20;
/** Depth factors: front props drop faster than back ones. */
const FRONT_FACTOR = 0.34;
const BACK_FACTOR = 0.22;

function placement(
  prop: GardenProp,
  slot: number,
  notches?: number,
): PropPlacement {
  const rand = mulberry32(hashString(`garden-prop:${prop}:${slot}`));
  const { x, y } = SLOTS[slot % SLOTS.length];
  // Jitter the anchor, then solve the polar form that `garden-scene` renders
  // from: cos(a) * reach = x, sin(a) * reach * f = y, f front/back by sign.
  const ax = x + (rand() - 0.5) * 2;
  const ay = y + (rand() - 0.5) * 1.2;
  const f = ay >= 0 ? FRONT_FACTOR : BACK_FACTOR;
  const reach = Math.sqrt(ax * ax + (ay / f) * (ay / f));
  return {
    prop,
    slot,
    angle: Math.atan2(ay / f, ax),
    radius: reach / METER,
    scale: 1,
    flip: !NO_FLIP.has(prop) && rand() < 0.4,
    ...(notches !== undefined ? { notches } : {}),
  };
}

/**
 * The always-present world, unlocking in tiers as the tree grows: a bare seed
 * keeps only stones, grass and the signpost; a sprout gets a fern and its
 * lantern; saplings live with a fallen log, a stump, a boulder and the bench;
 * grown trees keep the fullest garden.
 *
 * `projects` is the count of active projects: the signpost hangs one plate per
 * project, so the garden says how much is on your plate. It is the only prop
 * whose *shape* is data.
 */
export function dressingFor(growth: number, projects = 0): PropPlacement[] {
  const items: [GardenProp, number][] = [
    ['grass', 3],
    ['rocks', 5],
    ['signpost', 19],
  ];
  if (growth >= 0.12) {
    items.push(['fern', 1], ['lantern', 7]);
  }
  if (growth >= 0.32) {
    items.push(['log', 0], ['stump', 2], ['rock', 4], ['bench', 18]);
  }
  if (growth >= 0.58) {
    items.push(['grass', 13], ['rock', 16]);
  }
  return items.map(([prop, slot]) =>
    prop === 'signpost' ? placement(prop, slot, projects) : placement(prop, slot),
  );
}

/**
 * Earned objects. Rules stay legible on purpose — every trophy answers
 * "what did I do to deserve this?":
 *
 *  - mushrooms  one cluster per 2 h focused, up to three
 *  - flowers    a daisy patch at a 3-day streak, a rose patch at 7
 *  - cairn      six hours of depth, stacked
 *  - bird       a five-day streak visitor
 */
export function trophiesFor({ totalMinutes, streakDays }: GrowthInput): PropPlacement[] {
  const items: PropPlacement[] = [];
  const clusters = Math.min(3, Math.floor(totalMinutes / 120));
  for (let i = 0; i < clusters; i += 1) {
    items.push(placement('mushrooms', 9 + i));
  }
  if (streakDays >= 3) items.push(placement('flowers', 14));
  if (streakDays >= 7) items.push(placement('flowers2', 15));
  if (totalMinutes >= 360) items.push(placement('cairn', 12));
  if (streakDays >= 5) items.push(placement('bird', 6));
  return items;
}
