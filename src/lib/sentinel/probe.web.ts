/**
 * The probe in a browser — the honest half of Sentinel.
 *
 * A browser cannot read another origin's response: without CORS headers the only
 * permitted answer is an **opaque** one, whose `status` is always 0 and whose body
 * is unreadable. So this probe deliberately asks for the opaque response
 * (`mode: 'no-cors'`) and reports exactly what it can prove:
 *
 *  - the request **resolved** → something at that address answered, and we know
 *    how long it took;
 *  - the request **rejected** → the network never got an answer (DNS, refused,
 *    TLS, or an inconclusive CORS failure).
 *
 * It cannot say "200" and it cannot say "500" — a broken site that still serves a
 * page is "reachable". That is why `verdictLabel` calls a web result *reachable*
 * rather than *up*, and why the board says which runtime produced the numbers.
 * Nothing here pretends to be a status check.
 */
import { PROBE_TIMEOUT_MS, type CheckFacts } from './status';

const NOTE = 'The browser cannot read a cross-origin status, so this only proves something answered.';

function describe(error: unknown, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) return `No answer within ${Math.round(timeoutMs / 1000)}s.`;
  const raw = error instanceof Error && error.message ? error.message.trim() : 'The request failed.';
  const message = raw.endsWith('.') || raw.endsWith('!') ? raw : `${raw}.`;
  // A browser reports the same "failed" for a refused connection, a DNS failure
  // and a cross-origin request it would not let us see the answer to, so we say so
  // rather than implying we know which.
  return `${message} A browser cannot tell a refused connection from a blocked one.`;
}

export async function probe(url: string, timeoutMs: number = PROBE_TIMEOUT_MS): Promise<CheckFacts> {
  const started = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    });
    return {
      reached: true,
      status: null,
      ms: Date.now() - started,
      detail: NOTE,
      source: 'web',
    };
  } catch (error) {
    return {
      reached: false,
      status: null,
      ms: Date.now() - started,
      detail: describe(error, timedOut, timeoutMs),
      source: 'web',
    };
  } finally {
    clearTimeout(timer);
  }
}
