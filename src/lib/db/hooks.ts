/**
 * `useLiveQuery` — the bridge between screens and the repository. Runs a typed
 * loader against the local database, survives re-focus (silent refresh), and
 * exposes the four screen states: loading / error / empty / ready.
 */
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type LiveState<T> = {
  status: 'loading' | 'error' | 'ready';
  data: T | null;
  error: string | null;
};

export function useLiveQuery<T>(
  loader: (db: SQLiteDatabase) => Promise<T>,
  options: { deps?: unknown[]; refreshOnFocus?: boolean } = {},
) {
  const db = useSQLiteContext();
  const { deps = [], refreshOnFocus = true } = options;

  const [state, setState] = useState<LiveState<T>>({ status: 'loading', data: null, error: null });
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(
    async () => {
      try {
        const data = await loader(db);
        setState({ status: 'ready', data, error: null });
      } catch (error) {
        setState((prev) => ({
          status: prev.data === null ? 'error' : 'ready',
          data: prev.data,
          error: String(error),
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, ...deps],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loader(db);
        if (!cancelled) setState({ status: 'ready', data, error: null });
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({
            status: prev.data === null ? 'error' : 'ready',
            data: prev.data,
            error: String(error),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  // Silent refresh when the screen regains focus (edits made elsewhere show up).
  useFocusEffect(
    useCallback(() => {
      if (!refreshOnFocus) return;
      if (stateRef.current.data === null && stateRef.current.status === 'loading') return;
      load();
    }, [load, refreshOnFocus]),
  );

  return { ...state, refresh: load };
}
