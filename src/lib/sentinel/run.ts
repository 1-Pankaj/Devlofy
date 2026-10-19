/**
 * Running the checks — the only place that writes a measurement.
 *
 * Three deliberate choices, each of which the feature would be worse without:
 *
 *  1. **Sequential, never parallel.** Ten requests at once contend for the same
 *     radio, which inflates exactly the number this feature exists to report. A
 *     check a second is fast enough for a board of your own sites.
 *  2. **One bad target never stops the run.** Every site is probed in its own
 *     try/catch and a thrown probe is recorded as a failure, so the loop always
 *     finishes and the board always has a complete answer.
 *  3. **The verdict is frozen into the row at the moment it is made.** See
 *     `./status.ts` for why that is a record and not a re-derivation.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { insertWatchCheck, type WatchSiteRow } from '@/lib/db/repo';

import { probe } from './probe';
import { PROBE_TIMEOUT_MS, verdictFor, type CheckSource, type Verdict } from './status';

export type CheckOutcome = {
  siteId: string;
  verdict: Verdict;
  status: number | null;
  ms: number;
  source: CheckSource;
  detail: string | null;
  checkedAt: string;
};

/** One target, one request, one row. */
export async function checkSite(
  db: SQLiteDatabase,
  site: WatchSiteRow,
  now: number = Date.now(),
): Promise<CheckOutcome> {
  let facts;
  try {
    facts = await probe(site.url, PROBE_TIMEOUT_MS);
  } catch (error) {
    // `probe` is written not to throw; if a runtime still does, it is a failed
    // check, not a failed run.
    facts = {
      reached: false,
      status: null,
      ms: 0,
      detail: error instanceof Error ? error.message : 'The request failed.',
      source: 'native' as CheckSource,
    };
  }

  const verdict = verdictFor(facts, {
    expectStatus: site.expect_status,
    expectMs: site.expect_ms,
  });
  const checkedAt = new Date(now).toISOString();

  await insertWatchCheck(db, {
    site_id: site.id,
    checked_at: checkedAt,
    verdict,
    status: facts.status,
    ms: facts.ms,
    source: facts.source,
    detail: facts.detail,
  });

  return {
    siteId: site.id,
    verdict,
    status: facts.status,
    ms: facts.ms,
    source: facts.source,
    detail: facts.detail,
    checkedAt,
  };
}

/**
 * Every enabled target, one after another. Paused targets are skipped — they stay
 * on the board, but they cost a request only when the user asks for one.
 */
export async function checkSites(
  db: SQLiteDatabase,
  sites: WatchSiteRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<CheckOutcome[]> {
  const due = sites.filter((site) => site.enabled === 1);
  const outcomes: CheckOutcome[] = [];
  let done = 0;
  for (const site of due) {
    outcomes.push(await checkSite(db, site));
    done += 1;
    onProgress?.(done, due.length);
  }
  return outcomes;
}
