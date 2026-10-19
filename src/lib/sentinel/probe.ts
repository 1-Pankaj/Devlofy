/**
 * The probe — one request, measured, and no trust.
 *
 * This is the **native** implementation, and the platform anchor: Metro resolves
 * `probe.web.ts` in the browser, where the same request cannot read a status code
 * ([[09-platform-ceiling]]). Both return the same `CheckFacts`, so the verdict
 * logic never learns which runtime it is on — it only records it.
 *
 * Rules that matter:
 *
 *  - **Any answer is a fact.** A 500, a 403 and a 301 all resolve; only a
 *    transport failure rejects. The *verdict* decides whether that is bad, and
 *    that judgement belongs to `./status.ts` (pure, checked against known
 *    answers) rather than to the transport.
 *  - **`ms` is how long `fetch` took to resolve.** On web that is the response
 *    headers (the body is opaque and never read). On native React Native's
 *    XMLHttpRequest resolves when the response is *complete*, so a heavy page
 *    reads slower than it responds. It is a per-target round trip you can compare
 *    week to week, not a TTFB.
 *  - **Nothing is sent that identifies you.** No auth, no body, no custom
 *    headers, and the body is never read — a check is a knock on the door.
 *  - **One at a time.** Callers run probes sequentially on purpose: firing ten
 *    requests at once would make every target look slow, which is the one number
 *    this feature exists to report.
 */
import { PROBE_TIMEOUT_MS, type CheckFacts } from './status';

/** Sentence for a transport failure, without leaking a stack trace at the user. */
function describe(error: unknown, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) return `No answer within ${Math.round(timeoutMs / 1000)}s.`;
  if (error instanceof Error && error.message) return error.message;
  return 'The request failed.';
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
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: '*/*' },
      // Web only; React Native ignores it. A cached 200 is not a check.
      cache: 'no-store',
    });
    return {
      reached: true,
      status: response.status,
      ms: Date.now() - started,
      detail: null,
      source: 'native',
    };
  } catch (error) {
    return {
      reached: false,
      status: null,
      ms: Date.now() - started,
      detail: describe(error, timedOut, timeoutMs),
      source: 'native',
    };
  } finally {
    clearTimeout(timer);
  }
}
