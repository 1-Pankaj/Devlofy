/**
 * useSentinel — the board's and a target's state, in one place.
 *
 * The shape of this feature is unusual and worth stating once: **there is no
 * polling.** A check is a request to the user's own infrastructure, and this app
 * has no business making those while it is closed. So checks run
 *
 *  - when the board is opened and the newest check is older than `STALE_AFTER_MS`,
 *    and
 *  - whenever the user asks (Check all / Check now).
 *
 * Every row therefore carries the time it was measured, and the UI always shows
 * it. "Uptime" here is over *the checks that were taken*, never wall-clock time —
 * a figure that would be a lie on a board that only runs when you look at it.
 *
 * Reads go through `useLiveQuery` (so returning to the board silently refreshes
 * and the four screen states come for free); writes go through `./run.ts` and end
 * in the same `refresh`, so a screen never shows a number it made up.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLiveQuery } from '@/lib/db/hooks';
import {
  getWatchSite,
  latestWatchChecks,
  listWatchChecks,
  listWatchChecksSince,
  listWatchSites,
  CHECKS_KEPT,
  type WatchCheckRow,
  type WatchSiteRow,
} from '@/lib/db/repo';

import { checkSite, checkSites } from './run';
import {
  incidentsIn,
  isStale,
  standingOf,
  uptimeIn,
  worstFirst,
  type CheckLike,
  type Incident,
  type UptimeWindow,
  type Verdict,
  type WatchStanding,
} from './status';

/** How much history the board summarises per target. */
const BOARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Points in a card's sparkline — enough to see a shape, few enough to be calm. */
const SPARK_POINTS = 30;

export type SiteBoardRow = {
  site: WatchSiteRow;
  latest: WatchCheckRow | null;
  /** null when the target has never been checked. */
  verdict: Verdict | null;
  /** Reliability over the last 24 hours *of checks taken*. */
  day: UptimeWindow;
  /** The newest checks, oldest first — what the sparkline draws. */
  spark: CheckLike[];
  /** The most recent incident inside the board window, if any. */
  lastIncident: Incident | null;
};

export type SentinelBoard = {
  status: 'loading' | 'error' | 'ready';
  error: string | null;
  refresh: () => void;
  /** Worst first — the board's only ordering rule. */
  rows: SiteBoardRow[];
  /** True while this device is making requests. */
  running: boolean;
  progress: { done: number; total: number } | null;
  /** Newest check across every target, for "checked 4m ago". */
  lastCheckedAt: string | null;
  runAll: () => Promise<void>;
};

type Runner = {
  running: boolean;
  progress: { done: number; total: number } | null;
  runAll: (sites: WatchSiteRow[]) => Promise<void>;
  runOne: (site: WatchSiteRow) => Promise<void>;
};

/** The writing half of the hook, shared by the board and a target's screen. */
function useRunner(refresh: () => void): Runner {
  const db = useSQLiteContext();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // A ref, not the state, so two taps in the same tick cannot start two runs.
  const busy = useRef(false);

  const finish = useCallback(() => {
    busy.current = false;
    setRunning(false);
    setProgress(null);
    refresh();
  }, [refresh]);

  const runAll = useCallback(
    async (sites: WatchSiteRow[]) => {
      if (busy.current) return;
      busy.current = true;
      setRunning(true);
      try {
        await checkSites(db, sites, (done, total) => setProgress({ done, total }));
      } finally {
        finish();
      }
    },
    [db, finish],
  );

  const runOne = useCallback(
    async (site: WatchSiteRow) => {
      if (busy.current) return;
      busy.current = true;
      setRunning(true);
      try {
        await checkSite(db, site);
      } finally {
        finish();
      }
    },
    [db, finish],
  );

  return { running, progress, runAll, runOne };
}

type BoardData = { sites: WatchSiteRow[]; rows: SiteBoardRow[]; lastCheckedAt: string | null };

async function loadBoard(db: Parameters<typeof listWatchSites>[0]): Promise<BoardData> {
  const since = new Date(Date.now() - BOARD_WINDOW_MS).toISOString();
  const [sites, latest, recent] = await Promise.all([
    listWatchSites(db),
    latestWatchChecks(db),
    listWatchChecksSince(db, since),
  ]);

  const latestBySite = new Map(latest.map((check) => [check.site_id, check]));
  const recentBySite = new Map<string, WatchCheckRow[]>();
  for (const check of recent) {
    const list = recentBySite.get(check.site_id);
    if (list) list.push(check);
    else recentBySite.set(check.site_id, [check]);
  }

  const dayAgo = new Date(Date.now() - DAY_MS).toISOString();
  const rows = sites.map<SiteBoardRow>((site) => {
    const checks = recentBySite.get(site.id) ?? [];
    const incidents = incidentsIn(checks);
    const latestCheck = latestBySite.get(site.id) ?? null;
    return {
      site,
      latest: latestCheck,
      verdict: latestCheck ? latestCheck.verdict : null,
      day: uptimeIn(checks, dayAgo),
      spark: checks.slice(-SPARK_POINTS),
      lastIncident: incidents.length > 0 ? incidents[incidents.length - 1] : null,
    };
  });

  return {
    sites,
    rows: worstFirst(rows),
    lastCheckedAt: latest.length > 0 ? latest[0].checked_at : null,
  };
}

export function useSentinelBoard(): SentinelBoard {
  const query = useLiveQuery<BoardData>((db) => loadBoard(db), { deps: [] });
  const data = query.data;
  const runner = useRunner(query.refresh);

  // The "on open" half of the policy: only when something is actually stale, and
  // only once per mounted board, so a failed run cannot become a loop.
  const autoRan = useRef(false);
  const runAll = runner.runAll;
  useEffect(() => {
    if (query.status !== 'ready' || autoRan.current || !data) return;
    if (data.sites.every((site) => site.enabled !== 1)) return;
    if (!isStale(data.lastCheckedAt)) return;
    autoRan.current = true;
    void runAll(data.sites);
  }, [query.status, data, runAll]);

  return {
    status: query.status,
    error: query.error,
    refresh: query.refresh,
    rows: data?.rows ?? [],
    running: runner.running,
    progress: runner.progress,
    lastCheckedAt: data?.lastCheckedAt ?? null,
    runAll: () => runner.runAll(data?.sites ?? []),
  };
}

export type SentinelStandingView = {
  status: 'loading' | 'error' | 'ready';
  error: string | null;
  refresh: () => void;
  /** Null until the first read lands. */
  standing: WatchStanding | null;
};

/**
 * The board's answer, without the board.
 *
 * Today and More both need one thing from Sentinel — "is anything of mine down
 * right now?" — and neither should pay for it. `useSentinelBoard()` reads a week
 * of checks per target to draw sparklines; this reads two cheap rows per target
 * and folds them with the same pure `standingOf()` the self-checks cover, so the
 * summary on Today cannot drift from the board it summarises.
 *
 * It never runs a check. Opening Today must not fire requests at the user's
 * servers (that policy lives in the board), so a stale answer here is possible
 * and that is exactly why the strip states the time it was measured.
 */
export function useSentinelStanding(): SentinelStandingView {
  const query = useLiveQuery<WatchStanding>(
    async (db) => {
      const [sites, latest] = await Promise.all([listWatchSites(db), latestWatchChecks(db)]);
      return standingOf(sites, latest);
    },
    { deps: [] },
  );

  return {
    status: query.status,
    error: query.error,
    refresh: query.refresh,
    standing: query.data ?? null,
  };
}

export type WatchSiteView = {
  status: 'loading' | 'error' | 'missing' | 'ready';
  error: string | null;
  refresh: () => void;
  site: WatchSiteRow | null;
  /** The whole retained log for this target, newest first. */
  checks: WatchCheckRow[];
  running: boolean;
  checkNow: () => Promise<void>;
};

type SiteData = { site: WatchSiteRow | null; checks: WatchCheckRow[] };

export function useWatchSite(id: string | undefined): WatchSiteView {
  const query = useLiveQuery<SiteData | null>(
    async (db) => {
      if (!id) return null;
      const site = await getWatchSite(db, id);
      if (!site) return { site: null, checks: [] };
      const checks = await listWatchChecks(db, id, CHECKS_KEPT);
      return { site, checks };
    },
    { deps: [id] },
  );

  const data = query.data;
  const runner = useRunner(query.refresh);
  const runOne = runner.runOne;

  return {
    // A *successful* read that came back empty is "missing"; a failed read is an
    // error the screen renders as one ([[04-design-language]] §States).
    status: query.status === 'ready' && data?.site ? 'ready' : query.status === 'ready' ? 'missing' : query.status,
    error: query.error,
    refresh: query.refresh,
    site: data?.site ?? null,
    checks: data?.checks ?? [],
    running: runner.running,
    checkNow: async () => {
      if (data?.site) await runOne(data.site);
    },
  };
}
