/**
 * `useEngine` — the Engine wired to the database.
 *
 * Reads three cheap queries with the app's normal `useLiveQuery` (so it obeys
 * the same loading/error/refresh contract as every screen), then derives the
 * analysis in a memo. Screens never call this directly: `useEngine` is what
 * Today and Garden share, so "what's next" and "when do I work" can never
 * disagree with each other.
 */
import { useCallback, useMemo } from 'react';

import { useLiveQuery } from '@/lib/db/hooks';
import { listEstimateSamples, listOpenTasks, listSessionsSince } from '@/lib/db/repo';
import { driftInsight, estimateDrift, type EstimateDrift } from './estimate';
import { projectMinutesToday, rankTasks, type RankedTask } from './next-up';
import { buildRhythm, rhythmInsights, type Rhythm } from './rhythm';

/** Long enough to cover a season of work; short enough to stay "now". */
const HISTORY_DAYS = 120;

function historyStart(): string {
  const start = new Date();
  start.setDate(start.getDate() - HISTORY_DAYS);
  return start.toISOString();
}

export type EngineState = {
  status: 'loading' | 'error' | 'ready';
  error: string | null;
  rhythm: Rhythm;
  ranked: RankedTask[];
  drift: EstimateDrift | null;
  /** Sentences for the UI, already filtered for honesty. */
  insights: string[];
  refresh: () => void;
};

export function useEngine(): EngineState {
  const since = useMemo(() => historyStart(), []);
  const sessions = useLiveQuery((d) => listSessionsSince(d, since), { deps: [since] });
  const tasks = useLiveQuery((d) => listOpenTasks(d));
  const samples = useLiveQuery((d) => listEstimateSamples(d));

  const rhythm = useMemo(() => buildRhythm(sessions.data ?? []), [sessions.data]);
  const drift = useMemo(() => estimateDrift(samples.data ?? []), [samples.data]);
  const ranked = useMemo(
    () =>
      rankTasks(tasks.data ?? [], {
        now: new Date(),
        rhythm,
        projectMinutesToday: projectMinutesToday(sessions.data ?? [], new Date()),
      }),
    [tasks.data, rhythm, sessions.data],
  );

  const insights = useMemo(() => {
    const lines = [...rhythmInsights(rhythm)];
    const drift_ = driftInsight(drift);
    if (drift_) lines.push(drift_);
    return lines;
  }, [rhythm, drift]);

  const status: EngineState['status'] =
    tasks.status === 'error' || sessions.status === 'error' || samples.status === 'error'
      ? sessions.data === null || tasks.data === null
        ? 'error'
        : 'ready'
      : tasks.data === null || sessions.data === null || samples.data === null
        ? 'loading'
        : 'ready';

  const { refresh: refreshSessions } = sessions;
  const { refresh: refreshTasks } = tasks;
  const { refresh: refreshSamples } = samples;
  const refresh = useCallback(() => {
    refreshSessions();
    refreshTasks();
    refreshSamples();
  }, [refreshSessions, refreshTasks, refreshSamples]);

  return {
    status,
    error: tasks.error ?? sessions.error ?? samples.error,
    rhythm,
    ranked,
    drift,
    insights,
    refresh,
  };
}
