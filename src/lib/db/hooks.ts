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

  /**
   * Every read takes a ticket, and only the newest ticket may write. Without
   * this, a slow initial read or an in-flight focus refresh can resolve *after*
   * a newer deps change and put the old result on top of it — changing the
   * invoice period while a refresh was running could render the previous
   * period's rows in the new window.
   */
  const ticketRef = useRef(0);

  const load = useCallback(
    async () => {
      const ticket = ++ticketRef.current;
      try {
        const data = await loader(db);
        if (ticket !== ticketRef.current) return;
        setState({ status: 'ready', data, error: null });
      } catch (error) {
        if (ticket !== ticketRef.current) return;
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
    load();
  }, [load]);

  // Drop anything still in flight when the screen goes away.
  useEffect(
    () => () => {
      ticketRef.current += 1;
    },
    [],
  );

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
