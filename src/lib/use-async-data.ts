/**
 * useAsyncData — one loader, four honest states.
 *
 * Every screen in this app has to answer the same four questions: is it still
 * reading, did it fail, is there nothing, or here it is. Screens were starting
 * to each invent their own shape for that, so the shape lives here instead.
 *
 * Two properties are worth knowing about the implementation:
 *
 *  - **A failed reload does not throw away what is on screen.** The last good
 *    value is kept and the error is set beside it, so a repo screen that loses
 *    the network shows the tree it already had plus one sentence about it.
 *  - **`loading` and `refreshing` are derived, not stored.** A run is "pending"
 *    when the key it settled under is not the current key, which means the first
 *    render after a dependency change already reads as pending — no state write,
 *    no cascade, no flash of stale-empty. `deps` must therefore be primitives.
 *
 * The newest run wins: each run takes a sequence number, so a slow answer to an
 * old question can never overwrite a fast answer to a new one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Monotonic across every hook instance: the newest run is the one that counts. */
let sequence = 0;

export type AsyncData<T> = {
  data: T | null;
  error: string | null;
  /** True only while there is nothing to show yet. */
  loading: boolean;
  /** A reload is in flight with data already on screen. */
  refreshing: boolean;
  reload: () => void;
  /** Optimistic updates after a write, so the screen does not flash a spinner. */
  setData: (next: T | null) => void;
};

export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

export function useAsyncData<T>(
  load: () => Promise<T>,
  deps: readonly (string | number | boolean | null | undefined)[],
  options: { enabled?: boolean } = {},
): AsyncData<T> {
  const enabled = options.enabled ?? true;
  const loadRef = useRef(load);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{
    seq: number;
    key: string;
    data: T | null;
    error: string | null;
  }>({ seq: 0, key: '', data: null, error: null });

  // The key names *which question* this render is asking. When it stops matching
  // the key the last answer settled under, the screen is waiting again.
  const key = `${enabled ? 'on' : 'off'}::${deps.map((dep) => String(dep)).join('|')}::${tick}`;

  useEffect(() => {
    if (!enabled) return;
    loadRef.current = load;

    const id = (sequence += 1);
    let alive = true;

    loadRef.current().then(
      (data) => {
        if (!alive) return;
        setState((prev) => (id > prev.seq ? { seq: id, key, data, error: null } : prev));
      },
      (error: unknown) => {
        if (!alive) return;
        setState((prev) =>
          id > prev.seq ? { seq: id, key, data: prev.data, error: messageOf(error) } : prev,
        );
      },
    );

    return () => {
      alive = false;
    };
    // `load` is a fresh closure every render by design — `key` is what says when a
    // new question is being asked, so the loader is refreshed inside, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  const setData = useCallback((next: T | null) => {
    setState((prev) => ({ ...prev, data: next }));
  }, []);

  if (!enabled) {
    return { data: null, error: null, loading: false, refreshing: false, reload, setData };
  }

  const settled = state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : null,
    loading: !settled && state.data === null,
    refreshing: !settled && state.data !== null,
    reload,
    setData,
  };
}
