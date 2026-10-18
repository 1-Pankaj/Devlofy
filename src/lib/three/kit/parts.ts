/**
 * Building blocks for the code-authored garden kit.
 *
 * The kit exists because the Blender file is not always reachable: the GLBs in
 * `assets/models/` are the preferred read of every prop, and this is the same
 * vocabulary expressed as geometry the app can build itself, synchronously, on
 * any platform, with no asset fetch and no parse step ([[05-blender-pipeline]]).
 *
 * Two properties matter and both are enforced here rather than hoped for:
 *
 *  - **Deterministic.** Surface noise is a hash of the vertex *position*, so the
 *    same model is byte-identical on every device and in every session, and two
 *    vertices that share a corner receive the same offset — a faceted rock never
 *    cracks open along an edge.
 *  - **One draw call per model.** Parts merge into a single non-indexed geometry
 *    with vertex colours, so a bench is one mesh with one material instead of
 *    fifteen, which is what keeps a tablet at 60fps.
 */
import {
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

import { hashString } from '../../garden/model';

/** One solid in a model: a geometry, a face colour, and where it sits. */
export type Part = {
  geometry: BufferGeometry;
  /** sRGB hex. Converted to linear once, on merge. */
  color: string;
  position?: [number, number, number];
  /** Radians, XYZ. Ignored when `quaternion` is given. */
  rotation?: [number, number, number];
  /** Explicit orientation, for parts aimed at something (see `aimY`/`aimZ`). */
  quaternion?: [number, number, number, number];
  scale?: number | [number, number, number];
  /** Surface noise in metres (deterministic, crack-free). 0 = machined. */
  jitter?: number;
};

export function part(
  geometry: BufferGeometry,
  color: string,
  rest: Omit<Part, 'geometry' | 'color'> = {},
): Part {
  return { geometry, color, ...rest };
}

/**
 * Orientation whose **+Y** points along `direction` — the shape of every stick:
 * a blade of grass, a post, a tree limb. Built from a unit-vector rotation, so
 * it cannot compose the wrong way round the way stacked Euler angles can.
 */
export function aimY(direction: [number, number, number]): [number, number, number, number] {
  const q = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    new Vector3(...direction).normalize(),
  );
  return [q.x, q.y, q.z, q.w];
}

/**
 * Orientation whose **+Z** points along `direction` with +Y kept as near to
 * world-up as the direction allows — the shape of every ribbon and plate: a
 * frond segment, a sign, a root.
 */
export function aimZ(direction: [number, number, number]): [number, number, number, number] {
  const z = new Vector3(...direction).normalize();
  const up = Math.abs(z.y) > 0.98 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const x = new Vector3().crossVectors(up, z).normalize();
  const y = new Vector3().crossVectors(z, x);
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  return [q.x, q.y, q.z, q.w];
}

function matrixOf(item: Part): Matrix4 {
  const position = new Vector3(...(item.position ?? [0, 0, 0]));
  const quaternion = item.quaternion
    ? new Quaternion(...item.quaternion)
    : new Quaternion().setFromEuler(new Euler(...(item.rotation ?? [0, 0, 0])));
  const raw = item.scale ?? 1;
  const scale = new Vector3(...(typeof raw === 'number' ? [raw, raw, raw] : raw));
  return new Matrix4().compose(position, quaternion, scale);
}

/**
 * Displace every vertex by a hash of its own *position*, quantised to a fifth of
 * a millimetre. Two vertices sharing a corner read the same key, so the surface
 * stays welded — this is what makes an icosahedron read as a rock rather than as
 * a shattered one.
 */
function jitterPositions(geometry: BufferGeometry, amount: number, seed: number): void {
  if (amount <= 0) return;
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const hash = hashString(
      `${seed}:${Math.round(x * 5000)}:${Math.round(y * 5000)}:${Math.round(z * 5000)}`,
    );
    position.setXYZ(
      i,
      x + ((hash & 255) / 255 - 0.5) * amount,
      y + (((hash >>> 8) & 255) / 255 - 0.5) * amount,
      z + (((hash >>> 16) & 255) / 255 - 0.5) * amount,
    );
  }
  position.needsUpdate = true;
}

/** Position + matrix + noise, welded into a triangle soup of its own. */
function prepare(item: Part, seed: number): BufferGeometry {
  const geometry = item.geometry.clone().applyMatrix4(matrixOf(item));
  const soup = geometry.index ? geometry.toNonIndexed() : geometry;
  if (soup !== geometry) geometry.dispose();
  jitterPositions(soup, item.jitter ?? 0, seed);
  // Normals are recomputed on the whole model so flat shading is per triangle
  // (a non-indexed soup gives every triangle its own face normal). UVs are not
  // used: the kit is vertex-coloured by design.
  soup.deleteAttribute('uv');
  soup.deleteAttribute('normal');
  return soup;
}

export function buildGeometry(parts: Part[], seed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];

  for (const item of parts) {
    const soup = prepare(item, seed);
    const position = soup.getAttribute('position');
    // `Color` already reads a hex as sRGB and stores linear working-space values
    // (ColorManagement is on), so no extra conversion — doing it twice is how a
    // rock ends up black.
    const color = new Color(item.color);
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      colors.push(color.r, color.g, color.b);
    }
    soup.dispose();
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

/** Triangles in a geometry — `position.count / 3` for a triangle soup. */
export function triCount(geometry: BufferGeometry): number {
  return geometry.getAttribute('position').count / 3;
}

/** Degrees, for hand-placed rotations that were easier to think about in them. */
export function degrees(value: number): number {
  return (value * Math.PI) / 180;
}
