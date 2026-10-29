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
 * Anchor slots around the clearing (degrees, metres). Hand-placed for the
 * pixel composition: the pond owns the foreground-left, the footpath leaves
 * the foreground-right, the bench and signpost face the viewer from the right,
 * and the small things — mushrooms, grass, flowers — keep the front where
 * they can be seen.
 */
const SLOTS: { angle: number; radius: number }[] = [
  { angle: 150, radius: 1.9 }, // 0 · log
  { angle: -50, radius: 1.45 }, // 1 · fern
  { angle: 120, radius: 1.7 }, // 2 · stump
  { angle: -112, radius: 1.35 }, // 3 · grass
  { angle: 70, radius: 2.4 }, // 4 · rock
  { angle: -78, radius: 2.2 }, // 5 · rocks
  { angle: -98, radius: 1.05 }, // 6 · bird
  { angle: -152, radius: 2.1 }, // 7 · lantern
  { angle: 12, radius: 2.5 }, // 8 · rock (deep right)
  { angle: 104, radius: 1.5 }, // 9 · mushrooms
  { angle: 78, radius: 1.9 }, // 10 · mushrooms
  { angle: 56, radius: 1.75 }, // 11 · mushrooms
  { angle: -137, radius: 2.3 }, // 12 · cairn
  { angle: 36, radius: 2.0 }, // 13 · grass (second)
  { angle: 96, radius: 2.55 }, // 14 · flowers
  { angle: 44, radius: 2.6 }, // 15 · flowers (second)
  { angle: -58, radius: 2.55 }, // 16 · rock (back right)
  { angle: 168, radius: 1.4 }, // 17 · grass (left)
  { angle: 40, radius: 2.5 }, // 18 · bench
  { angle: -20, radius: 2.55 }, // 19 · signpost
];

function placement(
  prop: GardenProp,
  slot: number,
  notches?: number,
): PropPlacement {
  const rand = mulberry32(hashString(`garden-prop:${prop}:${slot}`));
  const { angle, radius } = SLOTS[slot % SLOTS.length];
  const radians = (angle * Math.PI) / 180;
  const radiusJitter = (rand() - 0.5) * 0.06;
  const angleJitter = (rand() - 0.5) * 0.1;
  return {
    prop,
    slot,
    angle: radians + angleJitter,
    radius: radius + radiusJitter,
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
