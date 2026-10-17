/**
 * Garden growth model — pure math, no three.js, no React.
 *
 * The tree is generated deterministically from (seed + bucketed growth) so the
 * same data always draws the same tree, and it only regenerates when growth
 * crosses a bucket (every 5%) instead of on every focus minute.
 */

export type Vec3 = [number, number, number];

export type Branch = {
  start: Vec3;
  end: Vec3;
  radius: number;
  depth: number;
};

export type Leaf = {
  position: Vec3;
  scale: number;
  /** 0 = healthy accent green, 1 = ember (thin week / low vigor). */
  tint: number;
};

export type TreeSpec = {
  branches: Branch[];
  leaves: Leaf[];
  height: number;
};

// ── tiny vector math ─────────────────────────────────────────────────────────

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: Vec3): Vec3 => {
  const len = length(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
};
/** Rotate `v` around unit axis `axis` by `angle` (Rodrigues). */
function rotate(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const [x, y, z] = axis;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = v[0] * x + v[1] * y + v[2] * z;
  const cross: Vec3 = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
  return [
    v[0] * cos + cross[0] * sin + x * dot * (1 - cos),
    v[1] * cos + cross[1] * sin + y * dot * (1 - cos),
    v[2] * cos + cross[2] * sin + z * dot * (1 - cos),
  ];
}

// ── deterministic randomness ─────────────────────────────────────────────────

/** mulberry32 — small, fast, good enough for branch structure. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ── growth from real data ────────────────────────────────────────────────────

export type GrowthInput = {
  /** All-time focused minutes. */
  totalMinutes: number;
  /** Consecutive days with at least one focus session. */
  streakDays: number;
  /** Focused minutes today. */
  todayMinutes: number;
};

/** 0 → seedling, 1 → fully grown. All-time depth dominates; the streak and
 *  today carry the "alive right now" part. */
export function growthFromStats({ totalMinutes, streakDays, todayMinutes }: GrowthInput): number {
  const depth = Math.min(1, totalMinutes / 900) * 0.55;
  const streak = Math.min(1, streakDays / 7) * 0.3;
  const today = Math.min(1, todayMinutes / 120) * 0.15;
  return Math.min(1, depth + streak + today);
}

export function bucketGrowth(growth: number): number {
  return Math.round(Math.min(1, Math.max(0, growth)) * 20) / 20;
}

// ── tree generation ──────────────────────────────────────────────────────────

const UP: Vec3 = [0, 1, 0];

function perpendicular(dir: Vec3, rand: () => number): Vec3 {
  const rough: Vec3 = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
  // Reject dots too close to the direction to avoid degenerate rotations.
  const candidate = normalize(add(rough, scale(dir, -0.35)));
  return length(candidate) < 0.01 ? [1, 0, 0] : candidate;
}

/**
 * Recursive stylized tree. Depth 0 is the trunk; children fan out and shrink.
 * Leaf count and tree height both follow `growth`.
 */
export function makeTree(seed: number, growth: number): TreeSpec {
  const rand = mulberry32(seed);
  const branches: Branch[] = [];
  const leaves: Leaf[] = [];

  const trunkHeight = 1.15 + growth * 1.45;
  const trunkRadius = 0.075 + growth * 0.075;
  const maxDepth = growth < 0.15 ? 1 : growth < 0.45 ? 2 : 3;

  const grow = (start: Vec3, dir: Vec3, segLength: number, radius: number, depth: number, spreadBias: number) => {
    const end = add(start, scale(dir, segLength));
    branches.push({ start, end, radius, depth });

    const isTip = depth >= maxDepth;
    if (isTip) {
      const leafCount = growth < 0.15 ? 1 : rand() < 0.75 ? 2 : 1;
      for (let i = 0; i < leafCount; i += 1) {
        const jitter: Vec3 = [
          (rand() - 0.5) * 0.16,
          rand() * 0.12,
          (rand() - 0.5) * 0.16,
        ];
        leaves.push({
          position: add(end, jitter),
          scale: 0.05 + growth * 0.11 + rand() * 0.03,
          tint: rand() * 0.35,
        });
      }
      return;
    }

    const childCount = depth === 0 ? 3 : rand() < 0.55 ? 2 : 3;
    for (let i = 0; i < childCount; i += 1) {
      // Fan around the parent direction on a steeper angle near the trunk.
      const angle = spreadBias + (rand() - 0.5) * 0.5;
      const axis = perpendicular(dir, rand);
      const childDir = normalize(rotate(dir, axis, angle));
      const childLength = segLength * (0.62 + rand() * 0.14);
      const childRadius = radius * (0.52 + rand() * 0.12);
      grow(end, childDir, childLength, childRadius, depth + 1, 0.42 + rand() * 0.3);
    }
  };

  grow([0, 0, 0], UP, trunkHeight, trunkRadius, 0, 0.55);

  return { branches, leaves, height: trunkHeight };
}
