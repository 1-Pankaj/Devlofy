/**
 * The Garden's known-answer checks.
 *
 * The garden is generated art — a tree grown from `(seed, growth)`, a
 * world built from `(width, seed, mode)`, and placements that are pure
 * functions of focus history — so its honesty is checkable the same way the
 * Bench and the Engine are: pin the numbers. If the stage ladder, the tier
 * unlocks, the trophy rules or the sprite grids ever drift, one of these
 * fails before a wrong garden can render.
 *
 * What is checked:
 *  - `model.ts`  — the growth weights (55/30/15), the clamps, the 5% buckets,
 *    and the deterministic randomness the whole garden leans on.
 *  - `models.ts` — every stage boundary and label (seed → canopy).
 *  - `props.ts`  — the dressing tiers, the signpost's project plates, the
 *    trophy rules with their exact thresholds, determinism and slot identity.
 *  - `sprites.ts`— every grid rectangular, every character priced in the
 *    palette, run merging and mirroring exact.
 *  - `tree.ts`   — determinism, bounds, monotone growth (more focus, more
 *    tree), a trunk that reaches the ground, an outlined canopy, and no
 *    blossom before its season.
 *  - `scenery.ts`— determinism, a full-width sky and ground, stars that stay
 *    in the sky, a clearing that keeps its floor, the pond/windmill/path on
 *    wide frames, and the accent growth rings.
 *
 * Nothing imports this module, so it never reaches a bundle. Run it with
 * `npm run check`.
 */
import { bucketGrowth, growthFromStats, hashString, mulberry32 } from './model';
import { GARDEN_VARIANTS, STAGE_LABEL, stageFromStats, variantForGrowth } from './models';
import { dressingFor, trophiesFor, type GardenProp } from './props';
import {
  mergeRuns,
  PALETTE,
  placeRuns,
  PROP_SPRITES,
  runsToPaths,
  spriteRuns,
  SPRITE_BUTTERFLY,
  SPRITE_BUTTERFLY_CLOSED,
  SPRITE_CLOUD_1,
  SPRITE_CLOUD_1G,
  SPRITE_CLOUD_2,
  SPRITE_CLOUD_2G,
  SPRITE_LANTERN,
  SPRITE_LANTERN_LIT,
  SPRITE_LILYPAD,
  SPRITE_LILYPAD_FLOWER,
  SPRITE_MOON,
  SPRITE_REEDS,
  SPRITE_SUN,
  type Run,
  type Sprite,
} from './sprites';
import { buildScenery, CLEARING_ROW, HORIZON, SCENE_ROWS } from './scenery';
import { growPixelTree, TREE_BASELINE, TREE_CENTRE } from './tree';

export type CheckResult = { name: string; pass: boolean; detail: string };

function check(name: string, actual: unknown, expected: unknown): CheckResult {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return { name, pass: a === e, detail: a === e ? a : `got ${a}, wanted ${e}` };
}

function ok(name: string, pass: boolean, detail: string): CheckResult {
  return { name, pass, detail: pass ? 'ok' : detail };
}

// ── growth model ─────────────────────────────────────────────────────────────

function growthChecks(): CheckResult[] {
  return okAll(
    check('no focus, no growth', growthFromStats({ totalMinutes: 0, streakDays: 0, todayMinutes: 0 }), 0),
    check('900 all-time minutes alone reach 55%', round2(growthFromStats({ totalMinutes: 900, streakDays: 0, todayMinutes: 0 })), 0.55),
    check('a 7-day streak alone reaches 30%', round2(growthFromStats({ totalMinutes: 0, streakDays: 7, todayMinutes: 0 })), 0.3),
    check('120 minutes today alone reach 15%', round2(growthFromStats({ totalMinutes: 0, streakDays: 0, todayMinutes: 120 })), 0.15),
    check('everything maxed caps at 1', growthFromStats({ totalMinutes: 5000, streakDays: 30, todayMinutes: 600 }), 1),
    check('growth is monotone in total minutes', growthFromStats({ totalMinutes: 400, streakDays: 0, todayMinutes: 0 }) < growthFromStats({ totalMinutes: 800, streakDays: 0, todayMinutes: 0 }), true),
    check('buckets quantise to 5%', bucketGrowth(0.47), 0.45),
    check('buckets clamp below zero', bucketGrowth(-0.4), 0),
    check('buckets clamp above one', bucketGrowth(1.4), 1),
    check('buckets leave 1 where it is', bucketGrowth(1), 1),
    check('hashString is deterministic', hashString('devlofy-garden'), hashString('devlofy-garden')),
    check('hashString separates inputs', hashString('a') !== hashString('b'), true),
    check('mulberry32 repeats its sequence', [mulberry32(42)(), mulberry32(42)(), mulberry32(42)()], [mulberry32(42)(), mulberry32(42)(), mulberry32(42)()]),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function okAll(...results: CheckResult[]): CheckResult[] {
  return results;
}

// ── stages ───────────────────────────────────────────────────────────────────

function stageChecks(): CheckResult[] {
  const stats = { totalMinutes: 0, streakDays: 0, todayMinutes: 0 };
  return [
    check('stage order is seed → canopy', GARDEN_VARIANTS, ['seed', 'sprout', 'sapling', 'young', 'canopy']),
    check('0 growth is a seed', variantForGrowth(0), 'seed'),
    check('0.119 is still a seed', variantForGrowth(0.119), 'seed'),
    check('0.12 is a sprout', variantForGrowth(0.12), 'sprout'),
    check('0.319 is still a sprout', variantForGrowth(0.319), 'sprout'),
    check('0.32 is a sapling', variantForGrowth(0.32), 'sapling'),
    check('0.579 is still a sapling', variantForGrowth(0.579), 'sapling'),
    check('0.58 is a young tree', variantForGrowth(0.58), 'young'),
    check('0.799 is still young', variantForGrowth(0.799), 'young'),
    check('0.8 is in full canopy', variantForGrowth(0.8), 'canopy'),
    check('1 stays canopy', variantForGrowth(1), 'canopy'),
    check('seed label', STAGE_LABEL.seed, 'Seed'),
    check('sprout label', STAGE_LABEL.sprout, 'Seedling'),
    check('sapling label', STAGE_LABEL.sapling, 'Sapling'),
    check('young label', STAGE_LABEL.young, 'Young tree'),
    check('canopy label', STAGE_LABEL.canopy, 'In full canopy'),
    check('stageFromStats carries all three readings', stageFromStats({ ...stats, totalMinutes: 900 }).label, 'Sapling'),
  ];
}

// ── props ────────────────────────────────────────────────────────────────────

function names(placements: { prop: GardenProp }[]): string[] {
  return placements.map((p) => p.prop);
}

function propChecks(): CheckResult[] {
  const bare = dressingFor(0.05, 0);
  const sprout = dressingFor(0.2, 0);
  const sapling = dressingFor(0.4, 0);
  const grown = dressingFor(0.7, 0);
  const again = dressingFor(0.7, 0);
  const trophies0 = trophiesFor({ totalMinutes: 0, streakDays: 0, todayMinutes: 0 });
  const mushrooms1 = trophiesFor({ totalMinutes: 120, streakDays: 0, todayMinutes: 0 });
  const deep = trophiesFor({ totalMinutes: 360, streakDays: 0, todayMinutes: 0 });
  const daisy = trophiesFor({ totalMinutes: 0, streakDays: 3, todayMinutes: 0 });
  const pink = trophiesFor({ totalMinutes: 0, streakDays: 7, todayMinutes: 0 });
  const sparrow = trophiesFor({ totalMinutes: 0, streakDays: 5, todayMinutes: 0 });
  const everything = trophiesFor({ totalMinutes: 600, streakDays: 7, todayMinutes: 0 });
  const slots = grown.map((p) => p.slot);

  return [
    check('bare garden: grass, rocks, signpost', names(bare), ['grass', 'rocks', 'signpost']),
    check('a sprout earns fern and lantern', names(sprout), ['grass', 'rocks', 'signpost', 'fern', 'lantern']),
    check('a sapling earns log, stump, rock and bench', names(sapling).length, 9),
    check('a grown tree keeps the fullest garden', names(grown).length, 11),
    check('the signpost hangs one plate per project', dressingFor(0.05, 4).find((p) => p.prop === 'signpost')?.notches, 4),
    check('dressing is deterministic', names(again), names(grown)),
    ok('every prop keeps its own slot', new Set(slots).size === slots.length, `slots: ${slots.join(',')}`),
    ok('radii stay in the ring', grown.every((p) => p.radius > 0.5 && p.radius < 2.6), 'radius out of range'),
    ok('props render at native pixel size', grown.every((p) => p.scale === 1), 'a prop was scaled — the art is authored at final size'),
    ok('mirrored props are organic only', grown.every((p) => !['lantern', 'signpost', 'bench', 'cairn', 'log', 'bird'].includes(p.prop) || !p.flip), 'a one-way prop was flipped'),
    check('no history, no trophies', trophies0, []),
    check('one cluster per first two hours', names(mushrooms1), ['mushrooms']),
    check('six hours stack mushrooms and the cairn', names(deep), ['mushrooms', 'mushrooms', 'mushrooms', 'cairn']),
    check('a 3-day streak plants a daisy patch', names(daisy), ['flowers']),
    check('a 7-day streak adds the rose patch — and keeps the bird', names(pink), ['flowers', 'flowers2', 'bird']),
    check('a 5-day streak earns the sparrow (with its daisy)', names(sparrow), ['flowers', 'bird']),
    check('a full history earns everything', names(everything), ['mushrooms', 'mushrooms', 'mushrooms', 'flowers', 'flowers2', 'cairn', 'bird']),
  ];
}

// ── sprites ──────────────────────────────────────────────────────────────────

const ALL_SPRITES: Record<string, Sprite> = {
  ...PROP_SPRITES,
  lanternLit: SPRITE_LANTERN_LIT,
  butterfly: SPRITE_BUTTERFLY,
  butterflyClosed: SPRITE_BUTTERFLY_CLOSED,
  reeds: SPRITE_REEDS,
  lilypad: SPRITE_LILYPAD,
  lilypadFlower: SPRITE_LILYPAD_FLOWER,
  cloud1: SPRITE_CLOUD_1,
  cloud1Gold: SPRITE_CLOUD_1G,
  cloud2: SPRITE_CLOUD_2,
  cloud2Gold: SPRITE_CLOUD_2G,
  moon: SPRITE_MOON,
  sun: SPRITE_SUN,
};

function spriteChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  for (const [name, sprite] of Object.entries(ALL_SPRITES)) {
    results.push(
      ok(
        `sprite ${name} is rectangular`,
        sprite.rows.every((row) => row.length === sprite.w) && sprite.h === sprite.rows.length,
        `w=${sprite.w} h=${sprite.h}`,
      ),
      ok(
        `sprite ${name} dims are sane`,
        sprite.w >= 3 && sprite.w <= 26 && sprite.h >= 2 && sprite.h <= 22,
        `w=${sprite.w} h=${sprite.h}`,
      ),
      ok(
        `sprite ${name} characters are all priced`,
        sprite.rows.every((row) => [...row].every((ch) => ch === '.' || PALETTE[ch] !== undefined)),
        'an unpriced character would render as nothing',
      ),
    );
  }
  results.push(
    check('prop registry covers every prop', Object.keys(PROP_SPRITES).length, 14),
    ok(
      'spriteRuns merges horizontal runs',
      spriteRuns(PROP_SPRITES.grass).length < 25,
      `grass produced ${spriteRuns(PROP_SPRITES.grass).length} runs`,
    ),
    ok(
      'the lantern has a rest frame and a lit frame of one shape',
      SPRITE_LANTERN.w === SPRITE_LANTERN_LIT.w && SPRITE_LANTERN.h === SPRITE_LANTERN_LIT.h,
      'the flame would jump between frames',
    ),
    ok(
      'the monarch has two frames of one shape',
      SPRITE_BUTTERFLY.w === SPRITE_BUTTERFLY_CLOSED.w && SPRITE_BUTTERFLY.h === SPRITE_BUTTERFLY_CLOSED.h,
      'the wings would jump between frames',
    ),
    ok(
      'the gold clouds share the dusk clouds\' shapes',
      SPRITE_CLOUD_1.w === SPRITE_CLOUD_1G.w && SPRITE_CLOUD_2.w === SPRITE_CLOUD_2G.w,
      'the sky would change shape with the light',
    ),
    flipCheck(),
    placeCheck(),
    mergeCheck(),
    pathCheck(),
  );
  return results;
}

function flipCheck(): CheckResult {
  const runs = spriteRuns(PROP_SPRITES.mushrooms);
  const flipped = spriteRuns(PROP_SPRITES.mushrooms, true);
  const width = PROP_SPRITES.mushrooms.w;
  const originalLeft = Math.min(...runs.map((r) => r.col));
  const originalRight = Math.max(...runs.map((r) => r.col + r.len - 1));
  const flippedLeft = Math.min(...flipped.map((r) => r.col));
  const flippedRight = Math.max(...flipped.map((r) => r.col + r.len - 1));
  return ok(
    'flipping mirrors a sprite',
    flippedLeft === width - 1 - originalRight && flippedRight === width - 1 - originalLeft,
    `original [${originalLeft}..${originalRight}] of ${width}, flipped [${flippedLeft}..${flippedRight}]`,
  );
}

function placeCheck(): CheckResult {
  const runs = placeRuns(spriteRuns(PROP_SPRITES.rock), 10, 20);
  return ok(
    'placing offsets a sprite',
    runs.every((r) => r.col >= 10 && r.row >= 20),
    'a run escaped its origin',
  );
}

function mergeCheck(): CheckResult {
  const runs: Run[] = [
    { row: 1, col: 0, len: 2, color: '#000000' },
    { row: 1, col: 2, len: 3, color: '#000000' },
    { row: 1, col: 6, len: 1, color: '#000000' },
  ];
  const merged = mergeRuns(runs);
  return check('mergeRuns joins contiguous runs', merged.length, 2);
}

function pathCheck(): CheckResult {
  const runs: Run[] = [
    { row: 0, col: 0, len: 4, color: '#111111' },
    { row: 0, col: 5, len: 2, color: '#222222' },
  ];
  const paths = runsToPaths(runs);
  return ok(
    'runsToPaths groups by colour',
    paths.length === 2 && paths[0].d === 'M0 0h4v1h-4z' && paths[1].d === 'M5 0h2v1h-2z',
    JSON.stringify(paths),
  );
}

// ── tree ─────────────────────────────────────────────────────────────────────

function treeChecks(): CheckResult[] {
  const young = growPixelTree(1234, 0.25);
  const grown = growPixelTree(1234, 0.9);
  const again = growPixelTree(1234, 0.25);
  const leafColors = new Set(['#0E2B1A', '#16452A', '#256B36', '#2E8544', '#48A853', '#7BC263', '#A9DE7E']);
  const leafPixels = (tree: typeof young) =>
    tree.runs.filter((run) => leafColors.has(run.color)).reduce((sum, run) => sum + run.len, 0);
  const trunkColors = new Set(['#241608', '#3E2817', '#5C3B22', '#7A5230']);
  const colorsOf = (tree: typeof young) => new Set(tree.runs.map((run) => run.color));
  const inBounds = young.runs.every(
    (run) =>
      run.row >= 0 &&
      run.row <= TREE_BASELINE &&
      run.col >= 0 &&
      run.col + run.len <= TREE_CENTRE * 2,
  );
  return [
    ok('the tree is deterministic', JSON.stringify(young) === JSON.stringify(again), 'two grows disagreed'),
    ok('every pixel stays in the buffer', inBounds, 'a run escaped the buffer'),
    ok('nothing paints below the ground line', young.runs.every((run) => run.row <= TREE_BASELINE), 'roots would float over the soil'),
    ok('more focus grows more leaves', leafPixels(grown) > leafPixels(young) * 1.5, `leaf pixels ${leafPixels(young)} → ${leafPixels(grown)}`),
    ok('more focus grows a taller tree', grown.topRow < young.topRow, `top row ${young.topRow} → ${grown.topRow}`),
    ok('a sapling is not empty', young.runs.length > 10, `only ${young.runs.length} runs`),
    ok('the trunk reaches the ground', growPixelTree(7, 0.7).runs.some((run) => run.row === TREE_BASELINE && trunkColors.has(run.color)), 'no trunk pixel on the baseline'),
    ok('the grown crown is outlined', colorsOf(grown).has('#10131F'), 'no outline — the clumps would read as separate blobs'),
    ok('contact shadow separates the clumps', colorsOf(grown).has('#0E2B1A'), 'no under-shadow — the crown would read flat'),
    ok('blossom waits for its season', !colorsOf(growPixelTree(1234, 0.5)).has('#F2C7D8'), 'blossom before 82% growth'),
  ];
}

// ── scenery ──────────────────────────────────────────────────────────────────

function sceneryChecks(): CheckResult[] {
  const dusk = buildScenery({ width: 140, seed: 99, mode: 'dusk' });
  const again = buildScenery({ width: 140, seed: 99, mode: 'dusk' });
  const gold = buildScenery({ width: 140, seed: 99, mode: 'gold' });
  const narrow = buildScenery({ width: 10, seed: 99, mode: 'dusk' });
  const skyFullRow = dusk.sky.some((run) => run.row === 0 && run.col === 0 && run.len === 140);
  const groundFullRow = dusk.meadow.some((run) => run.row === HORIZON && run.col === 0 && run.len === 140);
  const starsInSky = dusk.stars.every((star) => star.row < HORIZON - 4 && star.col >= 0 && star.col < dusk.width);
  const clearingFloor = dusk.clearing.rx >= 30;
  const scatterOutside = dusk.scatter.every((item) => {
    const dx = (item.col - dusk.clearing.col) / (dusk.clearing.rx + 6);
    const dy = (item.row - dusk.clearing.row) / (dusk.clearing.ry + 4);
    return dx * dx + dy * dy >= 1;
  });
  const bladePhases = new Set(dusk.blades.map((b) => b.phase));
  return [
    ok('the world is deterministic', JSON.stringify(dusk) === JSON.stringify(again), 'two builds disagreed'),
    ok('the sky covers the frame', skyFullRow, 'row 0 is not fully painted'),
    ok('the meadow covers the ground', groundFullRow, 'the horizon row is not fully painted'),
    ok('rows are 96 everywhere', SCENE_ROWS === 96 && CLEARING_ROW === 73, 'scene constants moved'),
    ok('stars stay in the sky', starsInSky, 'a star fell into the meadow'),
    ok('the clearing keeps its floor width', clearingFloor, `rx=${dusk.clearing.rx}`),
    ok('scatter respects the clearing', scatterOutside, 'grass grew in the soil'),
    check('dusk hangs the moon', dusk.lamp.sprite.h, 12),
    ok('the moon hangs top-left', dusk.lamp.col < dusk.width / 2 && dusk.lamp.col < 40, `moon at col ${dusk.lamp.col}`),
    check('golden hour raises the sun', gold.lamp.sprite.h, 8),
    ok('the sun sits on the horizon', gold.lamp.row > HORIZON - 20, `sun at row ${gold.lamp.row}`),
    check('gold skies burn amber at the horizon', buildScenery({ width: 100, seed: 5, mode: 'gold' }).sky.some((run) => run.color === '#FFC94A'), true),
    check('tiny frames still get a world', narrow.width, 48),
    ok('tiny frames skip the wide-world furniture', narrow.pond === null && narrow.windmill === null && narrow.path === null, 'a pond cannot fit a postage stamp'),
    ok('the dusk sky ends in a rose glow', dusk.sky.some((run) => run.color === '#BE6C6C'), 'horizon stop missing'),
    ok('the dusk carries a last-light band', dusk.sky.some((run) => run.color === '#E89A5E'), 'the warm band is gone'),
    ok('growth rings carry the accent', dusk.rings.every((run) => run.color === '#8B7CFF'), 'rings drifted off-accent'),
    ok('wide frames get a pond in the foreground', dusk.pond !== null && dusk.pond.row > dusk.clearing.row, 'the pond vanished'),
    ok('the pond sits under the moon', dusk.pond !== null && Math.abs(dusk.pond.col - dusk.lamp.col) < dusk.pond.rx + 24, 'the glint lost its moon'),
    ok('wide frames get a windmill on the far ridge', dusk.windmill !== null && dusk.windmill.row < HORIZON, 'the windmill vanished or fell below the horizon'),
    ok('the footpath leaves the frame', dusk.path !== null && dusk.path.some((run) => run.row === SCENE_ROWS - 1), 'the path never reaches the bottom'),
    ok('young blades sway in four phases', bladePhases.size === 4, `phases: ${[...bladePhases].join(',')}`),
    ok('the pond keeps lily pads and reeds', dusk.lilies.length >= 2 && dusk.reeds.length >= 2, 'the pond is bare'),
    ok('golden hour keeps its own clouds', gold.clouds.every((c) => c.sprite === SPRITE_CLOUD_1G || c.sprite === SPRITE_CLOUD_2G), 'dusk clouds in a gold sky'),
  ];
}

// ── entry point ──────────────────────────────────────────────────────────────

export function runSelfCheck(): CheckResult[] {
  return [
    ...growthChecks(),
    ...stageChecks(),
    ...propChecks(),
    ...spriteChecks(),
    ...treeChecks(),
    ...sceneryChecks(),
  ];
}
