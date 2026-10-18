/**
 * The garden kit, authored in code.
 *
 * Eight props the app can build itself — no asset, no fetch, no parse — for the
 * two jobs the Blender GLBs cannot cover: the props that have no model at all
 * (the focus bench and the project signpost, `05-blender-pipeline`'s open
 * backlog item) and the stand-in when a GLB never arrives.
 *
 * Every model is part-built, then merged to one vertex-coloured geometry (see
 * `parts.ts`), so a prop costs one draw call. Measurements are metres and every
 * base sits at y = 0, matching the GLB convention, so a placement can swap
 * between the two without moving.
 *
 * Craft rules it inherits from the authored kit ([[05-blender-pipeline]]):
 * hierarchy of masses, asymmetry, 3–4 tones per model, per-vertex noise on every
 * organic surface, and a grounded base — nothing floats.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Vector3,
} from 'three';

import { aimY, aimZ, part, type Part } from './parts';

/** The authored palette ([[05-blender-pipeline]]), so code and Blender agree. */
export const KIT_COLORS = {
  bark: '#6E5B4C',
  wood: '#8A6E52',
  woodDark: '#4E3E30',
  plate: '#D9CBB4',
  plateAlt: '#BFAC90',
  leafDeep: '#1E7B4E',
  leafMid: '#2FA96C',
  grass: '#1F6B45',
  grassLight: '#2C8A5A',
  stone: '#57534C',
  stoneDark: '#45413A',
  metal: '#3D3B38',
  glow: '#FFD98A',
} as const;

export type KitParts = {
  /** The body: one vertex-coloured mesh. */
  solid: Part[];
  /** Glass and light: a second mesh on the emissive material. */
  glow?: Part[];
};

function degrees(value: number): number {
  return (value * Math.PI) / 180;
}

/**
 * The focus bench — the seat under the tree (the item `05-blender-pipeline`
 * left open). Three seat planks, a tilted back, four legs and a stretcher:
 * fifteen solids, ≈144 triangles, two wood tones.
 */
export function bench(): KitParts {
  const seat = [-0.17, 0, 0.17].map((z) =>
    part(new BoxGeometry(1.55, 0.055, 0.145), KIT_COLORS.wood, { position: [0, 0.45, z] }),
  );

  const legs: Part[] = [];
  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.17, 0.17]) {
      legs.push(
        part(new BoxGeometry(0.07, 0.42, 0.07), KIT_COLORS.woodDark, { position: [x, 0.21, z] }),
      );
    }
  }

  // The back leans away from the seat by 12°, and the slats ride that plane.
  const back = [-0.62, 0.62].map((x) =>
    part(new BoxGeometry(0.07, 0.5, 0.07), KIT_COLORS.woodDark, {
      position: [x, 0.68, -0.205],
      rotation: [degrees(-12), 0, 0],
    }),
  );
  const slats = [
    { y: 0.63, z: -0.245 },
    { y: 0.79, z: -0.28 },
  ].map(({ y, z }) =>
    part(new BoxGeometry(1.55, 0.085, 0.04), KIT_COLORS.wood, {
      position: [0, y, z],
      rotation: [degrees(-12), 0, 0],
    }),
  );

  return {
    solid: [
      ...legs,
      ...seat,
      ...back,
      ...slats,
      part(new BoxGeometry(1.42, 0.045, 0.045), KIT_COLORS.woodDark, { position: [0, 0.15, 0.17] }),
    ],
  };
}

/**
 * The project signpost: one plate per project you are actually running. The
 * count is data, not decoration — pass `notches` and the sign says how much is
 * on your plate; pass zero and it is an honest bare post.
 */
export function signpost(notches: number): KitParts {
  const solid: Part[] = [
    part(new BoxGeometry(0.34, 0.09, 0.34), KIT_COLORS.stone, {
      position: [0, 0.045, 0],
      jitter: 0.02,
    }),
    part(new CylinderGeometry(0.05, 0.068, 1.55, 6), KIT_COLORS.woodDark, {
      position: [0, 0.86, 0],
    }),
    part(new ConeGeometry(0.085, 0.15, 6), KIT_COLORS.wood, { position: [0, 1.7, 0] }),
    // A bilateral arm: plates hang off *both* sides, and neither side of a sign
    // is left floating in the air without a beam over it.
    part(new BoxGeometry(0.98, 0.05, 0.05), KIT_COLORS.wood, { position: [0, 1.52, 0] }),
  ];

  for (let index = 0; index < notches; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const rank = Math.floor(index / 2);
    solid.push(
      part(
        new BoxGeometry(0.38, 0.16, 0.028),
        index % 2 === 0 ? KIT_COLORS.plate : KIT_COLORS.plateAlt,
        {
          position: [side * 0.29, 1.415 - rank * 0.19, 0.02],
          rotation: [degrees(2), 0, degrees(side * 2)],
          jitter: 0.004,
        },
      ),
    );
  }

  return { solid };
}

/**
 * Stone, as one boulder or as a cluster of three. Jitter on every vertex with
 * position-keyed noise (see `parts.ts`), which is what turns a twenty-triangle
 * icosahedron into something that reads as rock and not as a gem.
 */
export function rock(stones: number, rand: () => number): KitParts {
  const solid: Part[] = [];

  const place = (x: number, z: number, radius: number, squash: number, tone: string) => {
    solid.push(
      part(new IcosahedronGeometry(radius, 0), tone, {
        position: [x, radius * squash - 0.03, z],
        rotation: [rand() * 0.6, rand() * Math.PI, rand() * 0.4],
        scale: [1, squash, 0.86 + rand() * 0.16],
        jitter: radius * 0.19,
      }),
    );
  };

  place(0, 0, 0.26, 0.68, KIT_COLORS.stone);
  if (stones >= 2) place(0.29 + rand() * 0.05, 0.13, 0.15, 0.74, KIT_COLORS.stoneDark);
  if (stones >= 3) place(-0.21, 0.24 + rand() * 0.06, 0.12, 0.7, KIT_COLORS.stone);

  return { solid };
}

/** A tuft of nine blades, leaning outward from a shared root. */
export function grass(rand: () => number): KitParts {
  const solid: Part[] = [];
  const blades = 9;

  for (let index = 0; index < blades; index += 1) {
    const phi = (index / blades) * Math.PI * 2 + rand() * 0.5;
    const lean = degrees(16 + rand() * 30);
    const reach = 0.03 + rand() * 0.075;
    const height = 0.2 + rand() * 0.17;
    const direction: [number, number, number] = [
      Math.sin(lean) * Math.cos(phi),
      Math.cos(lean),
      Math.sin(lean) * Math.sin(phi),
    ];
    // Plant the blade's base on the soil and let it lean, rather than rotating
    // it about its own centre and burying one end.
    const base = [Math.cos(phi) * reach, 0.005, Math.sin(phi) * reach];
    solid.push(
      part(
        // A four-sided tapered prism (open-ended — the caps are never seen),
        // flattened on one axis: that reads as a blade, where a box reads as a
        // fence post.
        new CylinderGeometry(0.0035, 0.016, height, 4, 1, true),
        index % 3 === 0 ? KIT_COLORS.grassLight : KIT_COLORS.grass,
        {
          position: [
            base[0] + (direction[0] * height) / 2,
            base[1] + (direction[1] * height) / 2,
            base[2] + (direction[2] * height) / 2,
          ],
          quaternion: aimY(direction),
          scale: [1, 1, 0.42],
          jitter: 0.006,
        },
      ),
    );
  }

  return { solid };
}

/**
 * Seven fronds, each a chain of tapering ribbons along an arc that opens
 * *outward* rather than upward — a fern is wider than it is tall, and getting
 * that proportion wrong is the difference between a fern and a leek. Segments
 * overlap by 6% so the chain reads as one frond rather than as beads.
 */
export function fern(rand: () => number): KitParts {
  const solid: Part[] = [];
  const fronds = 7;
  const segments = 5;
  // The arc starts at the soil, not in the air: a frond whose lowest vertex
  // floats is a frond that reads as a decal.
  const arc = (t: number) => ({
    radius: 0.1 + 0.46 * t,
    height: 0.02 + 0.26 * Math.sin(Math.PI * t * 0.72),
  });

  // A tight crown at the root, so the fronds read as one plant.
  solid.push(
    part(new ConeGeometry(0.13, 0.06, 7), KIT_COLORS.leafDeep, {
      position: [0, 0.03, 0],
      jitter: 0.006,
    }),
  );

  for (let frond = 0; frond < fronds; frond += 1) {
    const phi = (frond / fronds) * Math.PI * 2 + rand() * 0.4;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    for (let step = 0; step < segments; step += 1) {
      const from = arc(step / segments);
      const to = arc((step + 1) / segments);
      const start = new Vector3(cos * from.radius, from.height, sin * from.radius);
      const end = new Vector3(cos * to.radius, to.height, sin * to.radius);
      const direction = end.clone().sub(start);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const midT = (step + 0.5) / segments;

      solid.push(
        part(
          new BoxGeometry(0.075 * (1 - 0.72 * midT), 0.009, direction.length() * 1.06),
          step % 2 === 0 ? KIT_COLORS.leafDeep : KIT_COLORS.leafMid,
          {
            position: [mid.x, mid.y, mid.z],
            quaternion: aimZ([direction.x, direction.y, direction.z]),
            jitter: 0.004,
          },
        ),
      );
    }
  }

  return { solid };
}

/** A fallen log, lying on its side with cut ends and a branch stub. */
export function log(rand: () => number): KitParts {
  const axis = new Vector3(1, 0, 0.34).normalize();
  const centre = new Vector3(0, 0.19, 0);
  const half = 0.52;
  const at = (distance: number, height: number) =>
    centre.clone().add(axis.clone().multiplyScalar(distance)).setY(height);
  const lying: [number, number, number] = [axis.x, axis.y, axis.z];
  const orientation = aimY(lying);

  const ends = [-half, half].map((distance) => {
    const point = at(distance, 0.19);
    return part(new CylinderGeometry(0.176, 0.176, 0.03, 9), KIT_COLORS.wood, {
      position: [point.x, point.y, point.z],
      quaternion: orientation,
    });
  });

  const stub = at(0.18, 0.3);
  const stumpDirection: [number, number, number] = [0.3, 0.86, 0.4];

  return {
    solid: [
      part(new CylinderGeometry(0.175, 0.205, half * 2, 9), KIT_COLORS.bark, {
        position: [centre.x, centre.y, centre.z],
        quaternion: orientation,
        jitter: 0.02,
      }),
      ...ends,
      part(new CylinderGeometry(0.045, 0.062, 0.26, 6), KIT_COLORS.bark, {
        position: [stub.x, stub.y, stub.z],
        quaternion: aimY(stumpDirection),
        jitter: 0.01,
      }),
      // Moss gathers on the up-side of an old log.
      part(new BoxGeometry(0.34, 0.03, 0.16), KIT_COLORS.grass, {
        position: [centre.x - axis.x * 0.12, 0.365, centre.z - axis.z * 0.12],
        rotation: [0, rand() * 0.4, 0],
        jitter: 0.012,
      }),
    ],
  };
}

/** A cut stump with root flare and growth rings on the sawn face. */
export function stump(rand: () => number): KitParts {
  const roots: Part[] = [];
  const rootCount = 4;
  for (let index = 0; index < rootCount; index += 1) {
    const phi = (index / rootCount) * Math.PI * 2 + 0.35;
    const outward = new Vector3(Math.cos(phi), 0, Math.sin(phi));
    // Roots descend as they leave the trunk and taper to a point, so they read
    // as a flare reaching for the soil rather than as four planks laid on it.
    const direction: [number, number, number] = [outward.x, -0.34, outward.z];
    const reach = 0.36;
    const point = outward.clone().multiplyScalar(reach / 2);
    roots.push(
      part(new CylinderGeometry(0.028, 0.078, reach, 4, 1, true), KIT_COLORS.bark, {
        position: [point.x, 0.13, point.z],
        quaternion: aimY(direction),
        scale: [1, 1, 0.62],
        jitter: 0.02,
      }),
    );
  }

  return {
    solid: [
      part(new CylinderGeometry(0.16, 0.235, 0.44, 8), KIT_COLORS.bark, {
        position: [0, 0.22, 0],
        rotation: [0, rand() * 0.3, 0],
        jitter: 0.02,
      }),
      part(new CylinderGeometry(0.155, 0.16, 0.025, 8), KIT_COLORS.wood, { position: [0, 0.442, 0] }),
      part(new CylinderGeometry(0.082, 0.086, 0.03, 8), KIT_COLORS.plate, {
        position: [0, 0.447, 0],
      }),
      ...roots,
    ],
  };
}

/**
 * The focus lantern: post, roof, tray and four frame posts around a glass body
 * on the emissive material. The scene turns that emission up while a session
 * runs (`PROP_GLOW_MATERIAL`), which is the one thing in the garden that answers
 * the clock.
 */
export function lantern(): KitParts {
  const metal = KIT_COLORS.metal;
  const frame: Part[] = [];
  for (const x of [-0.085, 0.085]) {
    for (const z of [-0.085, 0.085]) {
      frame.push(part(new BoxGeometry(0.022, 0.24, 0.022), metal, { position: [x, 1.31, z] }));
    }
  }

  return {
    solid: [
      part(new CylinderGeometry(0.16, 0.2, 0.09, 6), KIT_COLORS.stone, {
        position: [0, 0.045, 0],
        jitter: 0.02,
      }),
      part(new CylinderGeometry(0.042, 0.058, 1.2, 6), metal, { position: [0, 0.6, 0] }),
      part(new BoxGeometry(0.24, 0.045, 0.24), metal, { position: [0, 1.18, 0] }),
      ...frame,
      part(new BoxGeometry(0.21, 0.04, 0.21), metal, { position: [0, 1.445, 0] }),
      part(new ConeGeometry(0.155, 0.14, 4), metal, { position: [0, 1.53, 0] }),
      part(new CylinderGeometry(0.012, 0.012, 0.06, 4), metal, { position: [0, 1.62, 0] }),
    ],
    glow: [part(new BoxGeometry(0.158, 0.23, 0.158), KIT_COLORS.glow, { position: [0, 1.31, 0] })],
  };
}
