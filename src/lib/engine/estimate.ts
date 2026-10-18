/**
 * Estimate drift — does the user finish work in the time they predicted?
 *
 * This is the one number a task manager can compute from data it already has
 * (estimate vs. actually focused minutes per task) that a to-do list cannot. It
 * is deliberately reported as a *ratio* rather than a verdict, and the UI is
 * expected to phrase it as a fact about the past, never as a promise.
 */
import type { EstimateSample } from '@/lib/db/repo';

export type EstimateDrift = {
  /** Tasks that had both an estimate and real focused time. */
  samples: number;
  /** actual ÷ estimate across all samples. 1.4 means "40% over". */
  ratio: number;
  /** Median of the per-task ratios — resists one runaway task. */
  medianRatio: number;
  typicalEstimateMinutes: number;
  typicalActualMinutes: number;
  /** False while the sample is too small for the sentence to be honest. */
  calibrated: boolean;
};

const MIN_SAMPLES = 4;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function estimateDrift(samples: EstimateSample[]): EstimateDrift | null {
  const usable = samples.filter((s) => s.est_minutes > 0 && s.actual_minutes > 0);
  if (usable.length === 0) return null;

  const estimateTotal = usable.reduce((sum, s) => sum + s.est_minutes, 0);
  const actualTotal = usable.reduce((sum, s) => sum + s.actual_minutes, 0);
  const ratios = usable.map((s) => s.actual_minutes / s.est_minutes);

  return {
    samples: usable.length,
    ratio: actualTotal / estimateTotal,
    medianRatio: median(ratios),
    typicalEstimateMinutes: Math.round(estimateTotal / usable.length),
    typicalActualMinutes: Math.round(actualTotal / usable.length),
    calibrated: usable.length >= MIN_SAMPLES,
  };
}

/** One sentence, or null when there is nothing defensible to say. */
export function driftInsight(drift: EstimateDrift | null): string | null {
  if (!drift || !drift.calibrated) return null;
  const percent = Math.round((drift.ratio - 1) * 100);
  if (percent >= 15) {
    return `Your ${drift.typicalEstimateMinutes}m estimates actually take about ${drift.typicalActualMinutes}m — plan ${percent}% more.`;
  }
  if (percent <= -15) {
    return `You pad well: ${drift.typicalEstimateMinutes}m estimates land in about ${drift.typicalActualMinutes}m.`;
  }
  return `Your estimates are honest — ${drift.typicalEstimateMinutes}m predicted, ${drift.typicalActualMinutes}m actual.`;
}
