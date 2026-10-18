/**
 * The Engine — Devlofy's local intelligence layer.
 *
 * The product's claim is that useful recommendations do not require a server or
 * a model: they require *your own record*, read carefully. Everything the Engine
 * needs already exists in the database because the app prompted for it earlier —
 * tasks carry priority/due/estimate/energy, sessions carry real minutes and
 * attribution, projects carry rates.
 *
 * This module is the public surface; the pieces live next to it:
 *   - `rhythm.ts`   when you actually work, and how long a block usually runs
 *   - `next-up.ts`  what to do next, and the reason for saying so
 *   - `estimate.ts` whether your estimates survive contact with reality
 *
 * Keep it pure. No database, no React, no network — so it stays unit-testable
 * and cannot be the reason a screen fails to render.
 */
export {
  buildRhythm,
  formatHour,
  inPeakBand,
  rhythmInsights,
  type Rhythm,
  type SessionLike,
} from './rhythm';
export {
  projectMinutesToday,
  rankTasks,
  scoreTask,
  type EngineContext,
  type RankedTask,
} from './next-up';
export {
  driftInsight,
  estimateDrift,
  type EstimateDrift,
} from './estimate';
export { useEngine, type EngineState } from './use-engine';
