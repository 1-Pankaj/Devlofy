/**
 * Blender-authored garden models — one GLB per growth stage
 * (authored in-session, see docs/05-blender-pipeline.md).
 *
 * Loaded lazily, cached per variant, cloned per consumer so the Today teaser
 * and the Garden tab never share scene-graph objects. Any failure simply
 * leaves the procedural tree on screen.
 */
import type { Group } from 'three';

import canopyModule from '@/assets/models/garden-canopy.glb';
import saplingModule from '@/assets/models/garden-sapling.glb';
import sproutModule from '@/assets/models/garden-sprout.glb';
import { growthFromStats, type GrowthInput } from '@/lib/garden/model';
import { loadGltf, type GltfAssetModule } from '@/lib/three/load-model';

export type GardenVariant = 'sprout' | 'sapling' | 'canopy';

/** Growth → variant buckets, matching `lib/garden/model.ts` stage math. */
export function variantForGrowth(growth: number): GardenVariant {
  if (growth < 0.2) return 'sprout';
  if (growth < 0.5) return 'sapling';
  return 'canopy';
}

export const STAGE_LABEL: Record<GardenVariant, string> = {
  sprout: 'Seedling',
  sapling: 'Sapling',
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
  sprout: sproutModule,
  sapling: saplingModule,
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
