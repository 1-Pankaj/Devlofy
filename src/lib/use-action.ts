/**
 * useAction — the shape of a write.
 *
 * A write in this app is always the same four beats: a button goes busy, GitHub
 * may refuse with a sentence, it may succeed, and the screen needs to say which.
 * Screens that hand-roll that invariably lose one of the beats (usually the
 * refusal), so the beats live here.
 *
 * `run` never throws. It answers with an outcome, because a `409` on a stale
 * file is a normal event in a two-way client, not an exception.
 */
import { useCallback, useState } from 'react';
import { messageOf } from './use-async-data';

export type ActionOutcome<R> = { ok: true; value: R } | { ok: false; error: string };

export type ActionState = {
  busy: boolean;
  /** What GitHub said when it refused — verbatim, including its own words. */
  error: string | null;
  /** A sentence about what just happened, when it worked. */
  message: string | null;
  run: <R>(work: () => Promise<R>, options?: { success?: string }) => Promise<ActionOutcome<R>>;
  /** Clear both lines (e.g. when leaving the panel that showed them). */
  reset: () => void;
  dismiss: () => void;
};

export function useAction(): ActionState {
  const [state, setState] = useState<{ busy: boolean; error: string | null; message: string | null }>({
    busy: false,
    error: null,
    message: null,
  });

  const run = useCallback(async <R,>(work: () => Promise<R>, options?: { success?: string }) => {
    setState({ busy: true, error: null, message: null });
    try {
      const value = await work();
      setState({ busy: false, error: null, message: options?.success ?? null });
      return { ok: true, value } as ActionOutcome<R>;
    } catch (error) {
      const message = messageOf(error);
      setState({ busy: false, error: message, message: null });
      return { ok: false, error: message } as ActionOutcome<R>;
    }
  }, []);

  const reset = useCallback(() => setState({ busy: false, error: null, message: null }), []);
  const dismiss = useCallback(() => setState((prev) => ({ ...prev, error: null, message: null })), []);

  return { ...state, run, reset, dismiss };
}
