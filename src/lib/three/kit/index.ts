/**
 * The kit's public surface: a catalogue, a builder, and the shared materials.
 *
 * Everything here is synchronous and pure-ish — `buildKit` is a deterministic
 * function of (id, options), so the same garden grows the same props on every
 * device, and `kitObject` mints a fresh `Group` per placement (geometry and
 * materials are shared, transforms are not) exactly like the GLB path's
 * `clone(true)`. That symmetry is the point: a placement in
 * `src/lib/garden/props.ts` does not know whether it was answered by Blender or
 * by this file.
 *
 * See `tools/preview/render.js` for the offline renderer that draws this kit to
 * a PNG without a GPU, and checks its invariants at the same time.
 */
import { Color, Group, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three';

import { hashString, mulberry32 } from '../../garden/model';
import { bench, fern, grass, KIT_COLORS, lantern, log, rock, signpost, stump, type KitParts } from './models';
import { buildGeometry, triCount } from './parts';

export { KIT_COLORS } from './models';

export type KitModelId =
  | 'bench'
  | 'signpost'
  | 'rock'
  | 'grass'
  | 'fern'
  | 'log'
  | 'stump'
  | 'lantern';

export type KitOptions = {
  /** Signpost: one plate per active project (clamped to 5). */
  notches?: number;
  /** Rock: stones in the cluster (1–3). */
  stones?: number;
  /** Overrides the deterministic seed derived from the model id. */
  seed?: number;
};

/** The name the scene matches on to make the lamp answer the clock. */
export const GLOW_MATERIAL = 'DevlofyKitGlow';

export type KitEntry = {
  id: KitModelId;
  name: string;
  kind: 'seating' | 'marker' | 'stone' | 'flora' | 'wood' | 'light';
  /** Where the garden actually uses it. The kit has no decorative members. */
  used: string;
  note: string;
};

/** The kit, as a list — the shelf `Atelier` will one day browse. */
export const KIT: KitEntry[] = [
  {
    id: 'bench',
    name: 'Focus bench',
    kind: 'seating',
    used: 'the clearing, once the tree is a sapling',
    note: 'Three seat planks, a back on a 12° lean, four legs, one stretcher.',
  },
  {
    id: 'signpost',
    name: 'Project signpost',
    kind: 'marker',
    used: 'the clearing, always — one plate per active project',
    note: 'Data-driven: a bare post when nothing is running, up to five plates.',
  },
  {
    id: 'rock',
    name: 'Stone',
    kind: 'stone',
    used: 'dressing, and the stand-in when the rock GLB is missing',
    note: 'One to three jittered icosahedra; position-keyed noise, so no cracks.',
  },
  {
    id: 'grass',
    name: 'Grass tuft',
    kind: 'flora',
    used: 'dressing, and the stand-in for the grass GLB',
    note: 'Seven blades leaning outward from one root.',
  },
  {
    id: 'fern',
    name: 'Fern',
    kind: 'flora',
    used: 'dressing, and the stand-in for the fern GLB',
    note: 'Six fronds of overlapping tapering ribbon.',
  },
  {
    id: 'log',
    name: 'Fallen log',
    kind: 'wood',
    used: 'dressing, and the stand-in for the log GLB',
    note: 'Cut ends, a branch stub, moss on the up-side.',
  },
  {
    id: 'stump',
    name: 'Stump',
    kind: 'wood',
    used: 'dressing, and the stand-in for the stump GLB',
    note: 'Root flare at four angles, rings on the sawn face.',
  },
  {
    id: 'lantern',
    name: 'Focus lantern',
    kind: 'light',
    used: 'dressing, and the stand-in for the lantern GLB',
    note: 'Glass on the emissive material: dim at rest, lit mid-session.',
  },
];

const BUILDERS: Record<
  KitModelId,
  (options: { notches: number; stones: number; seed: number }, rand: () => number) => KitParts
> = {
  bench: () => bench(),
  signpost: (options) => signpost(options.notches),
  rock: (options, rand) => rock(options.stones, rand),
  grass: (_options, rand) => grass(rand),
  fern: (_options, rand) => fern(rand),
  log: (_options, rand) => log(rand),
  stump: (_options, rand) => stump(rand),
  lantern: () => lantern(),
};

export type KitBuild = {
  id: KitModelId;
  /** The body: vertex-coloured, flat-shaded, one draw call. */
  solid: BufferGeometry;
  /** Glass on the emissive material, when the model has any. */
  glow: BufferGeometry | null;
  tris: number;
};

const cache = new Map<string, KitBuild>();

/** The options the garden actually varies, clamped to what the models expect. */
function bounds(options: KitOptions): { notches: number; stones: number } {
  return {
    notches: Math.max(0, Math.min(5, Math.round(options.notches ?? 0))),
    stones: Math.max(1, Math.min(3, Math.round(options.stones ?? 1))),
  };
}

/** Deterministic. Same id and options, same geometry — cached per variant. */
export function buildKit(id: KitModelId, options: KitOptions = {}): KitBuild {
  const { notches, stones } = bounds(options);
  const base = options.seed ?? hashString(id);
  const key = `${id}:${base}:${notches}:${stones}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const seed = hashString(`${id}:${base}`);
  const parts = BUILDERS[id]({ notches, stones, seed }, mulberry32(seed));
  const solid = buildGeometry(parts.solid, seed);
  const glow = parts.glow ? buildGeometry(parts.glow, seed + 7) : null;
  const build: KitBuild = {
    id,
    solid,
    glow,
    tris: triCount(solid) + (glow ? triCount(glow) : 0),
  };
  cache.set(key, build);
  return build;
}

let solidMaterial: MeshStandardMaterial | null = null;
let glowMaterial: MeshStandardMaterial | null = null;

/** Shared across every placement: geometry and material are one, transforms are not. */
function materials(): { solid: MeshStandardMaterial; glow: MeshStandardMaterial } {
  if (!solidMaterial) {
    solidMaterial = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.88,
      metalness: 0,
    });
    solidMaterial.name = 'DevlofyKitSolid';
  }
  if (!glowMaterial) {
    glowMaterial = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      emissive: new Color(KIT_COLORS.glow),
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0,
      toneMapped: false,
    });
    glowMaterial.name = GLOW_MATERIAL;
  }
  return { solid: solidMaterial, glow: glowMaterial };
}

/** A fresh group per consumer — safe to transform, since nothing is shared but geometry. */
export function kitObject(id: KitModelId, options: KitOptions = {}): Group {
  const build = buildKit(id, options);
  const { solid, glow } = materials();
  const group = new Group();
  group.name = `kit:${id}`;

  const body = new Mesh(build.solid, solid);
  body.name = `${id}:body`;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  if (build.glow) {
    // Glass does not cast; it would put a hard shadow under a lamp that is
    // supposed to be making light.
    group.add(new Mesh(build.glow, glow));
  }

  return group;
}

/** Triangle count for a variant — the preview tool checks these against budget. */
export function kitTriCount(id: KitModelId, options: KitOptions = {}): number {
  return buildKit(id, options).tris;
}
