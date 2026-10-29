/**
 * Garden growth model — pure math, no rendering, no React.
 *
 * The same inputs always produce the same garden: growth is a weighted reading
 * of real focus history, bucketed so the artwork only rebuilds when the change
 * is actually visible (every 5%), and every random-looking detail (branch
 * angles, prop jitter, star field) is seeded from a stable hash.
 *
 * v0.9: the tree is drawn as pixel art (see `tree.ts` and `sprites.ts`), so the
 * 3D branch/leaf geometry that used to live here moved out. What stays is the
 * part every renderer — and every test — depends on.
 */

// ── deterministic randomness ─────────────────────────────────────────────────

/** mulberry32 — small, fast, good enough for scenery and prop jitter. */
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

/** FNV-1a — turns a string (a project id, a slot name) into a seed. */
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

/** Quantise growth to 5% buckets — the artwork only rebuilds on a crossing. */
export function bucketGrowth(growth: number): number {
  return Math.round(Math.min(1, Math.max(0, growth)) * 20) / 20;
}
