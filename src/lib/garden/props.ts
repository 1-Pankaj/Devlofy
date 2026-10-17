/**
 * Blender-authored garden props — life beyond the tree.
 *
 * Eleven small GLBs (source of truth: `tools/blender/garden_props.py`) placed
 * deterministically around the tree. Two layers:
 *
 *  - `dressingFor(growth)`   — always-on world: rocks, grass, fern, log, stump,
 *    the focus lantern. Unlocks in tiers as the tree grows.
 *  - `trophiesFor(stats)`    — earned objects: mushroom clusters per hours
 *    focused, daisy patches per streak, a cairn for depth, a sparrow for
 *    consistency. Pure functions of history — same data, same garden.
 *
 * Loaded lazily and cached per prop, cloned per consumer (same contract as
 * `models.ts`).
 */
import type { Group } from 'three';

import birdModule from '@/assets/models/props/prop-bird.glb';
import cairnModule from '@/assets/models/props/prop-cairn.glb';
import fernModule from '@/assets/models/props/prop-fern.glb';
import flowersModule from '@/assets/models/props/prop-flowers.glb';
import grassModule from '@/assets/models/props/prop-grass.glb';
import lanternModule from '@/assets/models/props/prop-lantern.glb';
import logModule from '@/assets/models/props/prop-log.glb';
import mushroomsModule from '@/assets/models/props/prop-mushrooms.glb';
import rockModule from '@/assets/models/props/prop-rock.glb';
import rocksModule from '@/assets/models/props/prop-rocks.glb';
import stumpModule from '@/assets/models/props/prop-stump.glb';
import { hashString, mulberry32, type GrowthInput } from '@/lib/garden/model';
import { loadGltf, type GltfAssetModule } from '@/lib/three/load-model';

export type GardenProp =
  | 'rock'
  | 'rocks'
  | 'grass'
  | 'fern'
  | 'log'
  | 'stump'
  | 'mushrooms'
  | 'flowers'
  | 'cairn'
  | 'lantern'
  | 'bird';

const MODULES: Record<GardenProp, GltfAssetModule> = {
  rock: rockModule,
  rocks: rocksModule,
  grass: grassModule,
  fern: fernModule,
  log: logModule,
  stump: stumpModule,
  mushrooms: mushroomsModule,
  flowers: flowersModule,
  cairn: cairnModule,
  lantern: lanternModule,
  bird: birdModule,
};

const cache = new Map<GardenProp, Promise<Group>>();

/** Resolves to the shared scene graph — clone it before rendering. */
export function loadProp(prop: GardenProp): Promise<Group> {
  let entry = cache.get(prop);
  if (!entry) {
    entry = loadGltf(MODULES[prop]);
    cache.set(prop, entry);
  }
  return entry;
}

export type PropPlacement = {
  prop: GardenProp;
  /** Slot id — stable render key and jitter seed. */
  slot: number;
  /** World position; y = 0 rests the prop on the soil disc. */
  position: [number, number, number];
  /** Facing, radians. */
  rotationY: number;
  scale: number;
};

/**
 * Anchor slots around the tree (degrees, metres). Hand-placed once so props
 * never overlap each other or the trunk; every prop keeps its own slot.
 */
const SLOTS: { angle: number; radius: number }[] = [
  { angle: 30, radius: 1.25 }, // 0 · log
  { angle: -40, radius: 1.05 }, // 1 · fern
  { angle: 120, radius: 1.45 }, // 2 · stump
  { angle: -118, radius: 0.95 }, // 3 · grass
  { angle: 78, radius: 2.0 }, // 4 · rock
  { angle: -82, radius: 1.85 }, // 5 · rocks
  { angle: 170, radius: 1.05 }, // 6 · bird
  { angle: -160, radius: 1.9 }, // 7 · lantern
  { angle: 5, radius: 2.35 }, // 8 · rock (deep)
  { angle: 105, radius: 0.78 }, // 9 · mushrooms
  { angle: 88, radius: 1.15 }, // 10 · mushrooms
  { angle: 118, radius: 0.95 }, // 11 · mushrooms
  { angle: -142, radius: 1.35 }, // 12 · cairn
  { angle: 55, radius: 1.75 }, // 13 · grass (second)
  { angle: -8, radius: 0.8 }, // 14 · flowers
  { angle: -25, radius: 1.45 }, // 15 · flowers (second)
  { angle: -55, radius: 2.3 }, // 16 · rock (third)
  { angle: 145, radius: 0.8 }, // 17 · grass (third)
];

function placement(prop: GardenProp, slot: number, scaleBoost = 1): PropPlacement {
  const rand = mulberry32(hashString(`garden-prop:${prop}:${slot}`));
  const { angle, radius } = SLOTS[slot % SLOTS.length];
  const radians = (angle * Math.PI) / 180;
  const radiusJitter = (rand() - 0.5) * 0.08;
  const angleJitter = (rand() - 0.5) * 0.12;
  const r = radius + radiusJitter;
  const a = radians + angleJitter;
  const position: [number, number, number] = [
    Math.cos(a) * r,
    0,
    Math.sin(a) * r,
  ];
  const facing = Math.atan2(-position[0], -position[2]) + (rand() - 0.5) * 0.7;
  return {
    prop,
    slot,
    position,
    rotationY: facing,
    scale: (0.92 + rand() * 0.22) * scaleBoost,
  };
}

/**
 * The always-present world, unlocking in tiers as the tree grows:
 * bare seed keeps only stones and grass; a sprout gets a fern and its
 * lantern; saplings live with a fallen log and stump; grown trees keep the
 * fullest garden.
 */
export function dressingFor(growth: number): PropPlacement[] {
  const items: [GardenProp, number][] = [
    ['grass', 3],
    ['rocks', 5],
  ];
  if (growth >= 0.12) {
    items.push(['fern', 1], ['lantern', 7]);
  }
  if (growth >= 0.32) {
    items.push(['log', 0], ['stump', 2], ['rock', 4]);
  }
  if (growth >= 0.58) {
    items.push(['grass', 13], ['rock', 16]);
  }
  return items.map(([prop, slot]) => placement(prop, slot));
}

/**
 * Earned objects. Rules stay legible on purpose — every trophy answers
 * "what did I do to deserve this?":
 *
 *  - mushrooms  one cluster per 2 h focused, up to three
 *  - flowers    a daisy patch at a 3-day streak, a second at 7
 *  - cairn      six hours of depth, stacked
 *  - bird       a five-day streak visitor
 */
export function trophiesFor({ totalMinutes, streakDays }: GrowthInput): PropPlacement[] {
  const items: PropPlacement[] = [];
  const clusters = Math.min(3, Math.floor(totalMinutes / 120));
  for (let i = 0; i < clusters; i += 1) {
    items.push(placement('mushrooms', 9 + i, 0.85 + i * 0.12));
  }
  if (streakDays >= 3) items.push(placement('flowers', 14));
  if (streakDays >= 7) items.push(placement('flowers', 15, 1.15));
  if (totalMinutes >= 360) items.push(placement('cairn', 12));
  if (streakDays >= 5) items.push(placement('bird', 6, 1.1));
  return items;
}
