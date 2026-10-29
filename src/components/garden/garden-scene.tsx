/**
 * Focus Garden scene — the app's pixel-art centrepiece.
 *
 * One implementation, every runtime: the scene is painted as **pixel runs**
 * compiled into SVG paths (react-native-svg renders it natively and on web),
 * so there is no GPU context to negotiate, no GLB to load and no platform
 * shim. The tree is grown in code from `(seed, growth)` — see `lib/garden/tree.ts`
 * — and the world around it is generated per frame-size in `lib/garden/scenery.ts`.
 *
 * The scene is a window, and it keeps the one always-dark surface the app had
 * in its 3D days — but it answers focus the way the garden always has: while a
 * block runs the sky burns into golden hour, the lantern's glass fills with
 * flame, butterflies come out over the flowers and the fireflies gather. At
 * rest it is a living twilight: fireflies, a moth at the lantern, a hopping
 * sparrow, a turning windmill, water shimmering under the moon, leaves coming
 * down from the canopy, and the odd shooting star.
 *
 * Motion is stepped, not tweened — about four steps a second, the way a
 * pixel-art world moves. `animated={false}` freezes the frame (teasers render
 * on demand). Every creature is a pure function of the tick, so the whole
 * scene stays deterministic and testable.
 */
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  placeRuns,
  PROP_SPRITES,
  runsToPaths,
  spriteRuns,
  SPRITE_BIRD,
  SPRITE_BIRD_LOOK,
  SPRITE_BIRD_PECK,
  SPRITE_BUTTERFLY,
  SPRITE_BUTTERFLY_CLOSED,
  SPRITE_LANTERN,
  SPRITE_LANTERN_LIT,
  SPRITE_LILYPAD,
  SPRITE_LILYPAD_FLOWER,
  SPRITE_REEDS,
  SPRITE_SEED,
  SPRITE_SPROUT,
  type Run,
  type Sprite,
} from '@/lib/garden/sprites';
import { bucketGrowth, hashString, mulberry32, type GrowthInput } from '@/lib/garden/model';
import { variantForGrowth } from '@/lib/garden/models';
import { dressingFor, trophiesFor, type GardenProp, type PropPlacement } from '@/lib/garden/props';
import {
  buildScenery,
  CLEARING_ROW,
  SCENE_ROWS,
  type Scenery,
} from '@/lib/garden/scenery';
import { growPixelTree, TREE_BASELINE, TREE_CENTRE } from '@/lib/garden/tree';

/** Scene units per metre of the old 3D world — maps prop radii to pixels. */
const METER = 14;
/** The row the tree stands on: a touch above the clearing's centre line. */
const TREE_ROW = CLEARING_ROW - 1;
/** How often the world steps forward, ms. */
const TICK_MS = 250;
/** Fireflies at rest / while a block runs. */
const FLIES_REST = 7;
const FLIES_LIVE = 14;

const SPRITE_FOR: Record<GardenProp, Sprite> = PROP_SPRITES as Record<GardenProp, Sprite>;

export type GardenSceneProps = {
  /** Deterministic structure seed (session volume or a stable app seed). */
  seed?: number;
  /** 0 → seedling, 1 → fully grown. */
  growth?: number;
  /** Focus history — drives dressing tiers and the earned trophies. */
  stats?: GrowthInput;
  /** Active projects — the signpost hangs one plate per project. */
  projects?: number;
  /** A session is running: golden hour, live lantern, gathered fireflies. */
  focusing?: boolean;
  /** False for teasers: renders a still frame instead of a stepping world. */
  animated?: boolean;
  style?: ViewStyle;
};

type Paths = { color: string; d: string }[];
type Layer = { key: string; paths: Paths; opacity?: number };

/** Where a placement lands, in scene units. Front props drop faster than
 * back ones, so the ring of props wraps the soil instead of hovering level. */
function propOrigin(
  placement: PropPlacement,
  scenery: Scenery,
): { col: number; row: number; sprite: Sprite } {
  const sprite = SPRITE_FOR[placement.prop];
  const reach = placement.radius * METER;
  const sine = Math.sin(placement.angle);
  const col =
    scenery.clearing.col + Math.cos(placement.angle) * reach - sprite.w * placement.scale * 0.5;
  const row =
    scenery.clearing.row + sine * reach * (sine > 0 ? 0.42 : 0.3) - sprite.h * placement.scale;
  return { col: Math.round(col), row: Math.round(row), sprite };
}

/**
 * The signpost's arrow plates — one per active project, alternating sides.
 * Each plate is a little board hung flush against the post, its pointed tip
 * aiming outward, with one nail near the post. Drawn as runs because the
 * count is live data.
 */
function signpostPlateRuns(placement: PropPlacement, origin: { col: number; row: number }): Run[] {
  const notches = Math.min(6, Math.max(0, placement.notches ?? 0));
  const runs: Run[] = [];
  // The post stands at cols origin.col+5..origin.col+9 of its sprite box.
  const postL = origin.col + 5;
  const postR = origin.col + 9;
  for (let i = 0; i < notches; i += 1) {
    const left = i % 2 === 1;
    const row = origin.row + 3 + Math.floor(i / 2) * 6;
    const from = left ? origin.col - 8 : postR + 1;
    const to = left ? postL - 1 : origin.col + 13;
    const tip = left ? from - 1 : to + 1;
    runs.push({ row, col: from + 1, len: to - from - 1, color: '#6A4926' });
    runs.push({ row: row + 1, col: from, len: to - from + 1, color: '#6A4926' });
    runs.push({ row: row + 1, col: tip, len: 1, color: '#6A4926' });
    runs.push({ row: row + 2, col: from + 1, len: to - from - 1, color: '#6A4926' });
    runs.push({ row: row + 3, col: left ? from + 2 : from + 1, len: to - from - 3, color: '#4C3319' });
    runs.push({ row: row + 1, col: left ? to - 2 : from + 2, len: 1, color: '#606A94' });
  }
  return runs;
}

/** Sprite runs for a placement, including the signpost's data-driven plates. */
function propRuns(placement: PropPlacement, scenery: Scenery): Run[] {
  const origin = propOrigin(placement, scenery);
  const runs = placeRuns(
    spriteRuns(SPRITE_FOR[placement.prop], placement.flip),
    origin.col,
    origin.row,
    placement.scale,
  );
  if (placement.prop === 'signpost') runs.push(...signpostPlateRuns(placement, origin));
  return runs;
}

/** Group a placement list by painter depth: behind the tree, or in front. */
function splitProps(placements: PropPlacement[]): {
  far: PropPlacement[];
  near: PropPlacement[];
} {
  const far: PropPlacement[] = [];
  const near: PropPlacement[] = [];
  for (const placement of placements) {
    (Math.sin(placement.angle) < 0 ? far : near).push(placement);
  }
  return { far, near };
}

/** The lantern's flame centre — fireflies and the moth gather there. */
function lanternOrigin(placements: PropPlacement[], scenery: Scenery) {
  const lantern = placements.find((p) => p.prop === 'lantern');
  if (!lantern) return null;
  const { col, row } = propOrigin(lantern, scenery);
  return { col: col + 4, row: row + 5 };
}

/** Pixel-ellipse halo around a point, as one run set. */
function haloRuns(cx: number, cy: number, r: number, color: string): Run[] {
  const runs: Run[] = [];
  for (let row = Math.ceil(cy - r); row <= Math.floor(cy + r); row += 1) {
    const t = (row - cy) / r;
    const inside = 1 - t * t;
    if (inside <= 0.02) continue;
    const half = r * Math.sqrt(inside);
    runs.push({ row, col: Math.round(cx - half), len: Math.max(1, Math.round(half * 2)), color });
  }
  return runs;
}

/** The windmill's two blade frames, drawn from the hub. */
function windmillBladeRuns(col: number, row: number, frame: number, color: string): Run[] {
  const runs: Run[] = [];
  if (frame === 0) {
    // An X: four diagonal arms.
    for (let k = 1; k <= 3; k += 1) {
      runs.push(
        { row: row - k, col: col - k, len: 1, color },
        { row: row - k, col: col + k, len: 1, color },
        { row: row + k, col: col - k, len: 1, color },
        { row: row + k, col: col + k, len: 1, color },
      );
    }
  } else {
    // A +: vertical and horizontal arms.
    for (let k = 1; k <= 3; k += 1) {
      runs.push(
        { row: row - k, col, len: 1, color },
        { row: row + k, col, len: 1, color },
        { row, col: col - k, len: 1, color },
        { row, col: col + k, len: 1, color },
      );
    }
  }
  runs.push({ row, col, len: 1, color: '#E89A5E' });
  return runs;
}

export function GardenScene({
  seed = 7,
  growth = 0.5,
  stats,
  projects = 0,
  focusing = false,
  animated = true,
  style,
}: GardenSceneProps) {
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const mounted = useRef(true);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame((prev) =>
      prev && Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }, []);

  useEffect(() => {
    mounted.current = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted.current) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);

  const live = animated && !reduceMotion;
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(interval);
  }, [live]);

  // Pixel size: the 96-row design space maps exactly onto the frame height.
  const widthUnits = frame ? Math.round((frame.w / frame.h) * SCENE_ROWS) : 0;
  const mode = focusing ? 'gold' : 'dusk';

  const scenery = useMemo(() => {
    if (!widthUnits) return null;
    return buildScenery({ width: widthUnits, seed, mode });
  }, [widthUnits, seed, mode]);

  const bucketed = bucketGrowth(growth);
  const variant = variantForGrowth(bucketed);

  const placements = useMemo(() => {
    if (!stats) return [];
    return [
      ...dressingFor(bucketed, projects),
      ...trophiesFor({
        totalMinutes: stats.totalMinutes,
        streakDays: stats.streakDays,
        todayMinutes: stats.todayMinutes,
      }),
    ];
  }, [bucketed, projects, stats]);

  const { far: farProps, near: nearProps } = useMemo(() => splitProps(placements), [placements]);

  // ── static world ────────────────────────────────────────────────────────
  const world = useMemo(() => {
    if (!scenery) return null;
    const layers: Layer[] = [
      { key: 'sky', paths: runsToPaths([...scenery.sky, ...scenery.meadow, ...scenery.flowerDots, ...(scenery.path ?? [])]) },
      { key: 'stars', paths: runsToPaths(scenery.stars.filter((s) => !s.bright).map((s): Run => ({ row: s.row, col: s.col, len: 1, color: '#8D95BC' }))) },
      { key: 'ridges', paths: runsToPaths(scenery.ridgeRuns) },
      { key: 'clearing', paths: runsToPaths([...scenery.clearingRuns, ...scenery.rings]) },
      { key: 'shadow', paths: runsToPaths(scenery.shadow), opacity: 0.42 },
    ];
    if (scenery.pond) {
      layers.push({ key: 'pond', paths: runsToPaths(scenery.pondRuns) });
      for (const lily of scenery.lilies) {
        const sprite = lily.flower ? SPRITE_LILYPAD_FLOWER : SPRITE_LILYPAD;
        layers.push({
          key: `lily${lily.col}`,
          paths: runsToPaths(placeRuns(spriteRuns(sprite), Math.round(lily.col - sprite.w / 2), Math.round(lily.row - sprite.h / 2))),
        });
      }
      for (const reed of scenery.reeds) {
        layers.push({
          key: `reed${reed.col}`,
          paths: runsToPaths(placeRuns(spriteRuns(SPRITE_REEDS, reed.flip), reed.col, reed.row)),
        });
      }
    }
    return layers;
  }, [scenery]);

  // The lamp: moon (with halo) or sun (with glow). Static placement.
  const lampLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const { col, row, sprite } = scenery.lamp;
    return {
      key: 'lamp',
      paths: runsToPaths(placeRuns(spriteRuns(sprite), col, row)),
    };
  }, [scenery]);

  const lampGlow = useMemo<Layer[]>(() => {
    if (!scenery) return [];
    const { col, row, sprite } = scenery.lamp;
    const cx = col + sprite.w / 2;
    const cy = row + sprite.h / 2;
    if (scenery.mode === 'gold') {
      return [
        { key: 'glow1', paths: runsToPaths(haloRuns(cx, cy, 16, '#FFC94A')), opacity: 0.1 },
        { key: 'glow2', paths: runsToPaths(haloRuns(cx, cy, 24, '#FFC94A')), opacity: 0.06 },
      ];
    }
    return [
      { key: 'glow1', paths: runsToPaths(haloRuns(cx, cy, 11, '#FFF7D9')), opacity: 0.09 },
      { key: 'glow2', paths: runsToPaths(haloRuns(cx, cy, 17, '#FFF7D9')), opacity: 0.05 },
    ];
  }, [scenery]);

  // ── props ───────────────────────────────────────────────────────────────
  // The lantern renders on its own layer (the flame and halo hang off it), so
  // it is excluded from the batches and re-inserted at its depth below.
  const farPropLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const runs: Run[] = [];
    for (const placement of farProps) {
      if (placement.prop === 'lantern') continue;
      runs.push(...propRuns(placement, scenery));
    }
    return { key: 'farprops', paths: runsToPaths(runs) };
  }, [scenery, farProps]);

  const nearPropLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const runs: Run[] = [];
    for (const placement of nearProps) {
      if (placement.prop === 'lantern') continue;
      runs.push(...propRuns(placement, scenery));
    }
    return { key: 'nearprops', paths: runsToPaths(runs) };
  }, [scenery, nearProps]);

  // ── the plant (seed / sprout / tree) ────────────────────────────────────
  const plant = useMemo(() => {
    if (!scenery) return null;
    const offsetY = TREE_ROW - TREE_BASELINE;
    if (variant === 'seed') {
      return {
        runs: placeRuns(
          spriteRuns(SPRITE_SEED),
          Math.round(scenery.clearing.col - SPRITE_SEED.w / 2),
          TREE_ROW - SPRITE_SEED.h + 1,
        ),
        swayRow: -1,
        topRow: TREE_ROW - SPRITE_SEED.h + 1,
      };
    }
    if (variant === 'sprout') {
      return {
        runs: placeRuns(
          spriteRuns(SPRITE_SPROUT),
          Math.round(scenery.clearing.col - SPRITE_SPROUT.w / 2),
          TREE_ROW - SPRITE_SPROUT.h + 2,
        ),
        swayRow: TREE_ROW - SPRITE_SPROUT.h + 5,
        topRow: TREE_ROW - SPRITE_SPROUT.h + 2,
      };
    }
    const tree = growPixelTree(seed, bucketed);
    return {
      runs: placeRuns(
        tree.runs,
        Math.round(scenery.clearing.col - TREE_CENTRE),
        offsetY,
      ),
      swayRow: tree.swayRow + offsetY,
      topRow: tree.topRow + offsetY,
    };
  }, [scenery, variant, seed, bucketed]);

  // Wind: the crown steps one pixel side-to-side on a slow cycle.
  const swayDx = live ? [0, 1, 0, -1][Math.floor(tick / 3) % 4] : 0;
  const plantLayer = useMemo<Layer | null>(() => {
    if (!plant) return null;
    const runs = plant.runs.map((run) =>
      run.row <= plant.swayRow ? { ...run, col: run.col + swayDx } : run,
    );
    return { key: 'plant', paths: runsToPaths(runs) };
  }, [plant, swayDx]);

  // ── scatter (grass tufts) sway ──────────────────────────────────────────
  const scatterLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const runs: Run[] = [];
    for (let i = 0; i < scenery.scatter.length; i += 1) {
      const item = scenery.scatter[i];
      const dx = live ? [0, 1, 0, -1][(Math.floor(tick / 2) + i) % 4] : 0;
      runs.push(...placeRuns(spriteRuns(item.sprite, item.flip), item.col + dx, item.row));
    }
    return { key: 'scatter', paths: runsToPaths(runs) };
  }, [scenery, tick, live]);

  // ── young blades sway ───────────────────────────────────────────────────
  const bladeLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const runs: Run[] = [];
    for (const blade of scenery.blades) {
      const dx = live ? [0, 1, 0, -1][(Math.floor(tick / 2) + blade.phase) % 4] : 0;
      runs.push({ row: blade.row, col: blade.col + dx, len: 1, color: blade.color });
      if (blade.len > 1) {
        runs.push({ row: blade.row - 1, col: blade.col + dx, len: 1, color: '#6FBF5E' });
      }
    }
    return { key: 'blades', paths: runsToPaths(runs) };
  }, [scenery, tick, live]);

  // ── clouds ──────────────────────────────────────────────────────────────
  const cloudLayers = useMemo<Layer[]>(() => {
    if (!scenery) return [];
    return scenery.clouds.map((cloud, i) => {
      const span = scenery.width + cloud.sprite.w * 2;
      const col = ((((cloud.col + tick * cloud.speed * 3) % span) + span) % span) - cloud.sprite.w;
      return {
        key: `cloud${i}`,
        paths: runsToPaths(placeRuns(spriteRuns(cloud.sprite), Math.round(col), cloud.row)),
        opacity: cloud.layer === 'far' ? 0.85 : 1,
      };
    });
  }, [scenery, tick]);

  // ── the lantern: sprite swap + halo ─────────────────────────────────────
  const lanternLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const lantern = placements.find((p) => p.prop === 'lantern');
    if (!lantern) return null;
    const { col, row } = propOrigin(lantern, scenery);
    const sprite = focusing ? SPRITE_LANTERN_LIT : SPRITE_LANTERN;
    return { key: 'lantern', paths: runsToPaths(placeRuns(spriteRuns(sprite), col, row)) };
  }, [scenery, placements, focusing]);

  const lantern = useMemo(() => {
    if (!scenery) return null;
    return lanternOrigin(placements, scenery);
  }, [scenery, placements]);

  /** The lantern sits behind the tree when its slot is behind the clearing. */
  const lanternIsFar = useMemo(() => {
    const lantern = placements.find((p) => p.prop === 'lantern');
    return lantern ? Math.sin(lantern.angle) < 0 : false;
  }, [placements]);

  const lanternGlow = useMemo<Layer[]>(() => {
    if (!lantern) return [];
    const pulse = focusing ? (tick % 4 < 2 ? 0.14 : 0.1) : 0.07;
    const runs = [
      ...haloRuns(lantern.col, lantern.row, 5, '#FFD98A'),
      ...haloRuns(lantern.col, lantern.row, 9, '#FFD98A'),
      ...haloRuns(lantern.col, lantern.row, 14, '#FFD98A'),
    ];
    return runsToPaths(runs).map((entry, i) => ({
      key: `lanternglow${i}`,
      paths: [entry],
      opacity: pulse * (1 - i * 0.25),
    }));
  }, [lantern, focusing, tick]);

  // ── the windmill's blades ───────────────────────────────────────────────
  const windmillLayer = useMemo<Layer | null>(() => {
    if (!scenery?.windmill) return null;
    const { col, row } = scenery.windmill;
    const frame = Math.floor(tick / 9) % 2;
    const color = scenery.mode === 'gold' ? '#745066' : '#544980';
    return {
      key: 'windmill',
      paths: runsToPaths(windmillBladeRuns(col, row - 12, frame, color)),
    };
  }, [scenery, tick]);

  // ── the pond: shimmer + ripples ─────────────────────────────────────────
  const pondLife = useMemo<Layer[]>(() => {
    if (!scenery?.pond) return [];
    const { col, row, rx, ry } = scenery.pond;
    const rand = mulberry32(hashString(`shimmer:${seed}`));
    const layers: Layer[] = [];
    // Shimmer strokes that slide a pixel either way.
    for (let i = 0; i < 8; i += 1) {
      const baseCol = col - rx + 2 + rand() * (rx * 2 - 4);
      const shimmerRow = row - 3 + Math.floor(rand() * 6);
      const dx = Math.round(Math.sin(tick * 0.15 + i * 2.2) * 2);
      layers.push({
        key: `shimmer${i}`,
        paths: runsToPaths([
          { row: shimmerRow, col: Math.round(baseCol + dx), len: 1 + (i % 2), color: '#7FA0D0' },
        ]),
        opacity: 0.8,
      });
    }
    // Ripples: three rings expanding out of phase.
    for (let k = 0; k < 3; k += 1) {
      const cycle = ((tick + k * 30) % 90) / 90;
      const rr = 0.12 + cycle * 0.75;
      const runs: Run[] = [];
      for (let r2 = Math.ceil(-ry * rr); r2 <= Math.floor(ry * rr); r2 += 1) {
        const t = r2 / (ry * rr);
        const inside = 1 - t * t;
        if (inside <= 0) continue;
        const half = rx * rr * Math.sqrt(inside);
        runs.push({ row: Math.round(row + r2), col: Math.round(col - half), len: 1, color: '#7FA0D0' });
        runs.push({ row: Math.round(row + r2), col: Math.round(col + half), len: 1, color: '#7FA0D0' });
      }
      layers.push({ key: `ripple${k}`, paths: runsToPaths(runs), opacity: 0.4 * (1 - cycle) });
    }
    return layers;
  }, [scenery, tick, seed]);

  // ── the sparrow: perch, look, peck, hop ─────────────────────────────────
  const birdLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const bird = placements.find((p) => p.prop === 'bird');
    if (!bird) return null;
    const origin = propOrigin(bird, scenery);
    const cycle = tick % 36;
    let sprite = SPRITE_BIRD;
    let dx = 0;
    let dy = 0;
    if (cycle >= 14 && cycle < 19) sprite = SPRITE_BIRD_LOOK;
    else if (cycle >= 19 && cycle < 24) {
      sprite = SPRITE_BIRD_PECK;
      dy = 1;
    } else if (cycle >= 24 && cycle < 28) {
      sprite = SPRITE_BIRD_LOOK;
      dx = 1;
      dy = -2;
    } else if (cycle >= 28) {
      dx = 1;
    }
    return {
      key: 'bird',
      paths: runsToPaths(placeRuns(spriteRuns(sprite), origin.col + dx, origin.row + dy)),
    };
  }, [scenery, placements, tick]);

  // ── butterflies — golden hour only ──────────────────────────────────────
  const butterflyLayers = useMemo<Layer[]>(() => {
    if (!scenery || !focusing) return [];
    const layers: Layer[] = [];
    for (let i = 0; i < 3; i += 1) {
      const anchorCol = scenery.clearing.col + (i - 1) * scenery.clearing.rx * 0.42;
      const anchorRow = scenery.clearing.row + 9 + (i % 2) * 4;
      const col =
        anchorCol + Math.sin(tick * 0.09 + i * 2.4) * 9 + Math.cos(tick * 0.31 + i) * 2;
      const row = anchorRow + Math.sin(tick * 0.23 + i * 1.7) * 3;
      const open = tick % 4 < 2;
      const sprite = open ? SPRITE_BUTTERFLY : SPRITE_BUTTERFLY_CLOSED;
      layers.push({
        key: `butterfly${i}`,
        paths: runsToPaths(placeRuns(spriteRuns(sprite), Math.round(col), Math.round(row))),
      });
    }
    return layers;
  }, [scenery, focusing, tick]);

  // ── fireflies + the moth — twilight only ────────────────────────────────
  const flies = useMemo(() => {
    if (!scenery) return [];
    const rand = mulberry32(hashString(`flies:${seed}`));
    return Array.from({ length: FLIES_LIVE }, (_, index) => ({
      col: rand() * scenery.width,
      row: 54 + rand() * 26,
      phase: rand() * Math.PI * 2,
      gather: index >= FLIES_REST,
    }));
  }, [scenery, seed]);

  const flyLayers = useMemo<Layer[]>(() => {
    if (!scenery || scenery.mode !== 'dusk') return [];
    const layers: Layer[] = [];
    const active = focusing ? FLIES_LIVE : FLIES_REST;
    for (let i = 0; i < Math.min(active, flies.length); i += 1) {
      const fly = flies[i];
      const home = fly.gather && lantern ? lantern : { col: fly.col, row: fly.row };
      const col = home.col + Math.sin(tick * 0.31 + fly.phase) * (fly.gather ? 2.4 : 3.4);
      const row = home.row + Math.cos(tick * 0.23 + fly.phase * 1.7) * (fly.gather ? 1.8 : 2.4);
      const bright = (tick + Math.floor(fly.phase * 2)) % 3 === 0;
      layers.push({
        key: `fly${i}`,
        paths: runsToPaths([
          {
            row: Math.round(row),
            col: Math.round(col),
            len: 1,
            color: bright ? '#FFF7D9' : '#FFE9A0',
          },
        ]),
      });
    }
    // One moth circles the lantern.
    if (lantern) {
      const mx = lantern.col + Math.cos(tick * 0.17) * 4;
      const my = lantern.row - 3 + Math.sin(tick * 0.29) * 2.4;
      layers.push({
        key: 'moth',
        paths: runsToPaths([
          { row: Math.round(my), col: Math.round(mx), len: 1, color: tick % 2 ? '#C9CFEA' : '#9BA3BE' },
        ]),
      });
    }
    return layers;
  }, [scenery, flies, lantern, focusing, tick]);

  // ── falling leaves — once the tree has a crown ──────────────────────────
  const leafLayers = useMemo<Layer[]>(() => {
    if (!scenery || !plant || bucketed < 0.45) return [];
    const layers: Layer[] = [];
    for (let i = 0; i < 5; i += 1) {
      const cycle = (tick + i * 47) % 120;
      if (cycle >= 84) continue;
      const col =
        scenery.clearing.col + (i - 2) * 5 + Math.sin(cycle * 0.2 + i) * 3 + swayDx;
      const row = plant.topRow + 4 + cycle * 0.55;
      if (row > scenery.clearing.row + 6) continue;
      const colors = ['#256B36', '#2E8544', '#48A853'];
      layers.push({
        key: `leaf${i}`,
        paths: runsToPaths([
          { row: Math.round(row), col: Math.round(col), len: 1, color: colors[i % 3] },
        ]),
      });
    }
    return layers;
  }, [scenery, plant, bucketed, tick, swayDx]);

  // ── the odd shooting star — twilight only ───────────────────────────────
  const shootingStar = useMemo<Layer | null>(() => {
    if (!scenery || scenery.mode !== 'dusk') return null;
    const cycle = (tick + 40) % 140;
    if (cycle >= 7) return null;
    const x0 = scenery.lamp.col + 26;
    const y0 = 4;
    const col = Math.round(x0 + cycle * 1.7);
    const row = Math.round(y0 + cycle * 0.9);
    if (col >= scenery.width - 2 || row > HORIZON_SAFE) return null;
    return {
      key: 'shooting',
      paths: runsToPaths([
        { row, col, len: 1, color: '#F5F2E6' },
        { row: row - 1, col: col - 1, len: 1, color: '#C9CFEA' },
        { row: row - 2, col: col - 2, len: 1, color: '#8D95BC' },
        { row: row - 3, col: col - 3, len: 1, color: '#4A4F7C' },
      ]),
    };
  }, [scenery, tick]);

  // ── bright stars twinkle; crosses sparkle ───────────────────────────────
  const twinkleLayer = useMemo<Layer | null>(() => {
    if (!scenery) return null;
    const runs: Run[] = [];
    for (const star of scenery.stars) {
      if (!star.bright) continue;
      const on = (tick + star.phase) % 4 !== 0;
      if (!on) continue;
      const color = (tick + star.phase) % 8 < 4 ? '#E8EAF6' : '#C9CFEA';
      runs.push({ row: star.row, col: star.col, len: 1, color });
      if (star.cross) {
        runs.push(
          { row: star.row - 1, col: star.col, len: 1, color: '#C9CFEA' },
          { row: star.row + 1, col: star.col, len: 1, color: '#C9CFEA' },
          { row: star.row, col: star.col - 1, len: 1, color: '#C9CFEA' },
          { row: star.row, col: star.col + 1, len: 1, color: '#C9CFEA' },
        );
      }
    }
    return { key: 'twinkle', paths: runsToPaths(runs) };
  }, [scenery, tick]);

  if (!frame || !scenery) {
    return <View style={[styles.frame, styles.waiting, style]} onLayout={onLayout} />;
  }

  const allLayers: Layer[] = [
    ...(world ?? []),
    ...cloudLayers.filter((l) => l),
    ...(lampGlow),
    ...(lampLayer ? [lampLayer] : []),
    ...(farPropLayer ? [farPropLayer] : []),
    ...(lanternIsFar && lanternLayer ? [lanternLayer] : []),
    ...(plantLayer ? [plantLayer] : []),
    ...leafLayers,
    ...(lanternGlow),
    ...(!lanternIsFar && lanternLayer ? [lanternLayer] : []),
    ...(nearPropLayer ? [nearPropLayer] : []),
    ...(scatterLayer ? [scatterLayer] : []),
    ...(windmillLayer ? [windmillLayer] : []),
    ...pondLife,
    ...(bladeLayer ? [bladeLayer] : []),
    ...(birdLayer ? [birdLayer] : []),
    ...butterflyLayers,
    ...flyLayers,
    ...(shootingStar ? [shootingStar] : []),
    ...(twinkleLayer ? [twinkleLayer] : []),
  ];

  return (
    <View style={[styles.frame, style]} onLayout={onLayout}>
      <Svg
        width={frame.w}
        height={frame.h}
        viewBox={`0 0 ${scenery.width} ${SCENE_ROWS}`}>
        {allLayers.map((layer) =>
          layer.paths.map((path, index) => (
            <Path
              key={`${layer.key}-${index}`}
              d={path.d}
              fill={path.color}
              fillOpacity={layer.opacity ?? 1}
            />
          )),
        )}
      </Svg>
    </View>
  );
}

/** The shooting star dies at the ridge line, not below it. */
const HORIZON_SAFE = 46;

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: 'hidden',
  },
  waiting: {
    backgroundColor: '#101430',
  },
});
