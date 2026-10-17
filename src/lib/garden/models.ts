/**
 * Blender-authored garden models — one GLB per growth stage
 * (authored in-session; source of truth: `tools/blender/garden_models.py`,
 * see docs/05-blender-pipeline.md).
 *
 * Five stages: seed → sprout → sapling → young → canopy. Loaded lazily,
 * cached per variant, cloned per consumer so the Today teaser and the Garden
 * tab never share scene-graph objects. Any failure simply leaves the
 * procedural tree on screen.
 */
import type { Group } from 'three';

import canopyModule from '@/assets/models/garden-canopy.glb';
import saplingModule from '@/assets/models/garden-sapling.glb';
import seedModule from '@/assets/models/garden-seed.glb';
import sproutModule from '@/assets/models/garden-sprout.glb';
import youngModule from '@/assets/models/garden-young.glb';
import { growthFromStats, type GrowthInput } from '@/lib/garden/model';
import { loadGltf, type GltfAssetModule } from '@/lib/three/load-model';

export type GardenVariant = 'seed' | 'sprout' | 'sapling' | 'young' | 'canopy';

/** Growth → variant buckets, matching the stage math in `lib/garden/model.ts`. */
export function variantForGrowth(growth: number): GardenVariant {
  if (growth < 0.12) return 'seed';
  if (growth < 0.32) return 'sprout';
  if (growth < 0.58) return 'sapling';
  if (growth < 0.8) return 'young';
  return 'canopy';
}

export const STAGE_LABEL: Record<GardenVariant, string> = {
  seed: 'Seed',
  sprout: 'Seedling',
  sapling: 'Sapling',
  young: 'Young tree',
  canopy: 'In full canopy',
};

/**
 * One shared reading of growth for the Today teaser and the Garden screen:
 * the 0..1 growth value, its stage variant, and the human label.
 */
export function stageFromStats(input: GrowthInput): {
  growth: number;
  variant: GardenVariant;
  label: string;
} {
  const growth = growthFromStats(input);
  const variant = variantForGrowth(growth);
  return { growth, variant, label: STAGE_LABEL[variant] };
}

const MODULES: Record<GardenVariant, GltfAssetModule> = {
  seed: seedModule,
  sprout: sproutModule,
  sapling: saplingModule,
  young: youngModule,
  canopy: canopyModule,
};

const cache = new Map<GardenVariant, Promise<Group>>();

/** Resolves to the shared scene graph — clone it before rendering. */
export function loadVariant(variant: GardenVariant): Promise<Group> {
  let entry = cache.get(variant);
  if (!entry) {
    entry = loadGltf(MODULES[variant]);
    cache.set(variant, entry);
  }
  return entry;
}
