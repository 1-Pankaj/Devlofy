/**
 * Garden stages — the growth ladder, shared by the Garden tab and the Today
 * teaser.
 *
 * Five stages: seed → sprout → sapling → young → canopy. The first two are
 * hand-authored sprites (`sprites.ts`); the last three are grown by the
 * procedural pixel tree (`tree.ts`), which regenerates only when growth
 * crosses a 5% bucket. In the 3D days this file lazily loaded one Blender GLB
 * per stage; the pixel garden needs no assets and no loading state at all.
 */

import { growthFromStats, type GrowthInput } from './model';

export type GardenVariant = 'seed' | 'sprout' | 'sapling' | 'young' | 'canopy';

export const GARDEN_VARIANTS: readonly GardenVariant[] = [
  'seed',
  'sprout',
  'sapling',
  'young',
  'canopy',
];

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
