/**
 * Sentinel — the verdicts, and the arithmetic behind them.
 *
 * Everything in this file is **pure**: facts in, judgement out. No fetch, no
 * database, no clock of its own (callers pass `now`), so every rule here can be
 * checked against a known answer (`./self-check.ts`) instead of being trusted.
 *
 * The one idea worth reading before the code: **a check reports facts, a verdict
 * is a judgement made from them, and the judgement is stored.** Changing a
 * target's expected status tomorrow must not rewrite what yesterday's checks
 * meant — the same reason an invoice is a view over sessions but a *check* is a
 * record. Incidents then go the other way: they are *derived* from verdicts, so
 * the rule for what counts as an incident can be improved without a migration.
 */
// Dependency-free on purpose: no `@/lib/db` import, so this module — and its
// self-check — compiles and runs under plain Node.

// ───────────────────────────── the vocabulary ─────────────────────────────

/** What a single check concluded. `slow` is up but over its time budget. */
export type Verdict = 'up' | 'slow' | 'down';

/** Which runtime took the measurement. A web check cannot see a status code. */
export type CheckSource = 'native' | 'web';

/** The facts a probe brings back, before any judgement. */
export type CheckFacts = {
  /** Did the request resolve at all? False means the transport failed. */
  reached: boolean;
  /** HTTP status, or null when the runtime could not read one. */
  status: number | null;
  /** How long `fetch` took to resolve. */
  ms: number;
  /** A sentence for the log when something went wrong or was hidden. */
  detail: string | null;
  source: CheckSource;
};

/** What the user said "up" means for this target. */
export type Expectations = {
  /** The only acceptable status. `null` accepts any status below 500. */
  expectStatus: number | null;
  /** Above this many milliseconds a response is slow but still up. */
  expectMs: number | null;
};

/** The shape this module needs from a stored check — satisfied by `WatchCheckRow`. */
export type CheckLike = {
  checked_at: string;
  verdict: Verdict;
  ms: number;
  status: number | null;
};

/** Three failures in a row is an incident — the rule the board promises. */
export const INCIDENT_THRESHOLD = 3;

/** A check is worth re-taking after this long, and the board says so. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

/** How long a check is allowed to take before it is called unreachable. */
export const PROBE_TIMEOUT_MS = 10_000;

// ───────────────────────────── one verdict ─────────────────────────────

/**
 * The whole product in one function: given what the probe saw and what the user
 * expects, is this target up, slow, or down?
 *
 * Deliberately conservative: when the runtime could not read a status (any web
 * check — the browser hides cross-origin responses), a response that *arrived*
 * is only ever "up" or "slow". We refuse to call it down on evidence we do not
 * have, and the UI says "reachable" rather than "up" so the claim matches the
 * proof.
 */
export function verdictFor(facts: CheckFacts, expectations: Expectations): Verdict {
  if (!facts.reached) return 'down';

  if (facts.status !== null) {
    if (expectations.expectStatus !== null) {
      if (facts.status !== expectations.expectStatus) return 'down';
    } else if (facts.status >= 500) {
      // No expectation set: a server error is still an error.
      return 'down';
    }
  }

  if (expectations.expectMs !== null && facts.ms > expectations.expectMs) return 'slow';
  return 'up';
}

/**
 * The word the UI shows. Web checks can only prove that *something* answered —
 * no status code, no body — so they are labelled as what they are.
 */
export function verdictLabel(verdict: Verdict, source: CheckSource): string {
  if (source === 'web') {
    if (verdict === 'down') return 'unreachable';
    if (verdict === 'slow') return 'reachable · slow';
    return 'reachable';
  }
  return verdict;
}

/** One line explaining what this verdict is allowed to claim. */
export function verdictNote(source: CheckSource): string {
  return source === 'web'
    ? 'Web can only prove that something answered — the browser hides cross-origin status codes and bodies. Run checks on the tablet for real statuses.'
    : 'A check records the status, the time it took, and the verdict the expectation produced.';
}

// ───────────────────────────── windows and runs ─────────────────────────────

export type UptimeWindow = {
  total: number;
  up: number;
  slow: number;
  down: number;
  /** (up + slow) / total — null when nothing was checked in the window. */
  ratio: number | null;
  /** The worst verdict seen, for a one-word summary. */
  worst: Verdict | null;
};

const VERDICT_RANK: Record<Verdict, number> = { up: 0, slow: 1, down: 2 };

/** Board order: worst first, and a target that was never checked sinks below one that is fine. */
function boardRank(verdict: Verdict | null | undefined): number {
  if (verdict === 'down') return 0;
  if (verdict === 'slow') return 1;
  if (verdict === 'up') return 2;
  return 3;
}

/** Worst first: down, then slow, then up, then never-checked. */
export function worstFirst<T extends { verdict: Verdict | null | undefined }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => boardRank(a.verdict) - boardRank(b.verdict));
}

const ms = (value: string | number | Date) =>
  value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);

/** Coverage and reliability over a window, from the checks that fall inside it. */
export function uptimeIn(
  checks: CheckLike[],
  since: string | number | Date,
  until: string | number | Date = Date.now(),
): UptimeWindow {
  const from = ms(since);
  const to = ms(until);
  const inside = checks.filter((check) => {
    const at = ms(check.checked_at);
    return at >= from && at <= to;
  });

  const window: UptimeWindow = { total: 0, up: 0, slow: 0, down: 0, ratio: null, worst: null };
  for (const check of inside) {
    window.total += 1;
    window[check.verdict] += 1;
    if (!window.worst || VERDICT_RANK[check.verdict] > VERDICT_RANK[window.worst]) {
      window.worst = check.verdict;
    }
  }
  if (window.total > 0) window.ratio = (window.up + window.slow) / window.total;
  return window;
}

export type LatencyStats = {
  count: number;
  min: number;
  median: number;
  p95: number;
  max: number;
};

/**
 * Response-time spread over the checks that actually got an answer. Failures are
 * excluded on purpose: an unreachable target's "latency" is the timeout, and
 * letting that into the median would describe the timeout, not the server.
 */
export function latencyStats(checks: CheckLike[]): LatencyStats | null {
  const values = checks
    .filter((check) => check.verdict !== 'down' && check.ms >= 0)
    .map((check) => check.ms)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;

  const at = (fraction: number) => values[Math.min(values.length - 1, Math.floor(fraction * values.length))];
  return {
    count: values.length,
    min: values[0],
    median: at(0.5),
    p95: at(0.95),
    max: values[values.length - 1],
  };
}

export type Incident = {
  /** The first failing check of the run. */
  startedAt: string;
  /** The first check that succeeded after it, or null while it is still going. */
  endedAt: string | null;
  /** Failures in this run. */
  failures: number;
  /** Only when it ended: how long the target was down. */
  minutes: number | null;
  /** The newest check in the log is still a failure. */
  ongoing: boolean;
};

/**
 * Runs of consecutive failures, newest last in the result. Derived, not stored:
 * the threshold is a rule, and rules should be improvable without a migration.
 */
export function incidentsIn(checks: CheckLike[], threshold = INCIDENT_THRESHOLD): Incident[] {
  const ordered = [...checks].sort((a, b) => ms(a.checked_at) - ms(b.checked_at));
  const incidents: Incident[] = [];
  let run: CheckLike[] = [];

  const close = (endedAt: string | null, ongoing: boolean) => {
    if (run.length < threshold) return;
    const startedAt = run[0].checked_at;
    incidents.push({
      startedAt,
      endedAt,
      failures: run.length,
      minutes: endedAt ? Math.round((ms(endedAt) - ms(startedAt)) / 60000) : null,
      ongoing: ongoing || endedAt === null,
    });
  };

  for (const check of ordered) {
    if (check.verdict === 'down') {
      run.push(check);
      continue;
    }
    if (run.length > 0) {
      close(check.checked_at, false);
      run = [];
    }
  }
  if (run.length > 0) close(null, true);

  return incidents;
}

/** Is the newest check old enough that the board should say so? */
export function isStale(checkedAt: string | null, now: number = Date.now(), staleAfter = STALE_AFTER_MS) {
  if (!checkedAt) return true;
  return now - ms(checkedAt) >= staleAfter;
}

/** Minutes since a check, for "checked 4m ago" — null when there is no check. */
export function minutesSince(checkedAt: string | null, now: number = Date.now()): number | null {
  if (!checkedAt) return null;
  return Math.max(0, Math.round((now - ms(checkedAt)) / 60000));
}

// ───────────────────────────── targets ─────────────────────────────

export type UrlCheck = { ok: true; url: string } | { ok: false; message: string };

/**
 * A target is a URL you own, so the only help worth giving is the one everybody
 * forgets: a scheme. `example.com` becomes `https://example.com/`; anything that
 * is not http(s) is refused rather than attempted (a `javascript:` or `file:`
 * target is not a website, and a checker should never be a way to make the app
 * fetch one).
 *
 * Two details worth knowing: a bare host is assumed **https** (type `http://`
 * for a dev server), and only a real `scheme://` counts as a scheme — otherwise
 * `localhost:8081` would read as the scheme `localhost:`.
 */
export function normalizeUrl(input: string): UrlCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: 'Enter a URL.' };

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, message: 'That does not look like a URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'Only http and https targets can be watched.' };
  }
  // A domain, a bracketed IPv6 literal, or `localhost` — nothing else is a host
  // a browser could reach anyway, and refusing here beats a confusing failure.
  const host = parsed.hostname;
  if (!host.includes('.') && !host.includes(':') && host !== 'localhost') {
    return { ok: false, message: 'That host has no domain — check for a typo.' };
  }

  return { ok: true, url: parsed.toString() };
}

/** `https://api.northwind.io/health` → `api.northwind.io`, for compact labels. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A name the user did not have to type: the host, minus the noise. */
export function labelFromUrl(url: string): string {
  const host = hostOf(url);
  return host.length > 0 ? host : 'New target';
}

// ───────────────────────────── formatting ─────────────────────────────

/** "412 ms" · "1.24 s" — one decision, so every screen says it the same way. */
export function formatMs(value: number | null): string {
  if (value === null) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
}

/** "99.4%" · "—" — one decimal under 100, and never a fake 100.0. */
export function formatPercent(ratio: number | null): string {
  if (ratio === null) return '—';
  const percent = ratio * 100;
  if (percent >= 99.95 && percent < 100) return '99.9%';
  if (percent >= 100) return '100%';
  return `${percent.toFixed(1)}%`;
}

/** "just now" · "4m ago" · "3h ago" · "2d ago" · "never". */
export function formatAgo(minutes: number | null): string {
  if (minutes === null) return 'never';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** "1h 12m" · "8m" · "under a minute" — for an incident's length. */
export function formatSpan(minutes: number | null): string {
  if (minutes === null) return 'still failing';
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// ───────────────────── the standing: one sentence about everything ─────────────────────

/**
 * What the board says when it is *not* on screen.
 *
 * Sentinel's answer to "is anything of mine down?" is worth more than a screen
 * you remember to open, so it is summarised wherever the user already is (Today)
 * and on the shelf that leads to it (More). Both must say the same thing, so the
 * sentence is built here once — from the stored verdicts, never from a counter.
 *
 * The wording obeys the runtime rule: on a browser the verdict `down` means
 * "did not answer", and calling that "down" would claim more than a browser can
 * know, so a web-only standing says **unreachable**.
 */
export type StandingSite = { id: string; enabled: number };

export type StandingCheck = {
  site_id: string;
  verdict: Verdict;
  checked_at: string;
  source: CheckSource;
};

export type WatchStanding = {
  /** Every target on the board, including paused ones. */
  sites: number;
  /** Targets that are actually checked. */
  watched: number;
  paused: number;
  up: number;
  slow: number;
  down: number;
  /** Watched targets with no check at all yet. */
  never: number;
  /** The worst verdict among watched targets — null when nothing has been judged. */
  worst: Verdict | null;
  /** Newest check across watched targets, for "checked 4m ago". */
  lastCheckedAt: string | null;
  /** True when every judgement came from a browser, so "up" would be an overclaim. */
  reachedOnly: boolean;
};

export type StandingTone = 'accent' | 'ember' | 'danger' | 'neutral';

export function standingOf(sites: StandingSite[], latest: StandingCheck[]): WatchStanding {
  const latestBySite = new Map(latest.map((check) => [check.site_id, check]));
  const standing: WatchStanding = {
    sites: sites.length,
    watched: 0,
    paused: 0,
    up: 0,
    slow: 0,
    down: 0,
    never: 0,
    worst: null,
    lastCheckedAt: null,
    reachedOnly: false,
  };

  let judged = 0;
  let fromNative = false;
  for (const site of sites) {
    // A paused target is not part of the answer to "is anything down?" — its last
    // verdict is history, and raising an alarm from it would be a lie about now.
    if (site.enabled !== 1) {
      standing.paused += 1;
      continue;
    }
    standing.watched += 1;
    const check = latestBySite.get(site.id);
    if (!check) {
      standing.never += 1;
      continue;
    }
    judged += 1;
    if (check.source === 'native') fromNative = true;
    if (check.verdict === 'down') standing.down += 1;
    else if (check.verdict === 'slow') standing.slow += 1;
    else standing.up += 1;
    if (!standing.worst || VERDICT_RANK[check.verdict] > VERDICT_RANK[standing.worst]) {
      standing.worst = check.verdict;
    }
    if (!standing.lastCheckedAt || check.checked_at > standing.lastCheckedAt) {
      standing.lastCheckedAt = check.checked_at;
    }
  }

  standing.reachedOnly = judged > 0 && !fromNative;
  return standing;
}

/**
 * The sentence — counts only, worst first, with the honest verb for the runtime.
 * `null` when there is nothing worth saying: no targets, or nothing read yet.
 */
export function standingLine(
  standing: WatchStanding | null,
): { text: string; tone: StandingTone } | null {
  if (!standing || standing.sites === 0) return null;
  if (standing.watched === 0) {
    return { text: `${standing.paused} paused`, tone: 'neutral' };
  }

  const bad = standing.reachedOnly ? 'unreachable' : 'down';
  const good = standing.reachedOnly ? 'reachable' : 'up';
  const parts: string[] = [];
  if (standing.down > 0) parts.push(`${standing.down} ${bad}`);
  if (standing.slow > 0) parts.push(`${standing.slow} slow`);
  if (standing.up > 0) parts.push(`${standing.up} ${good}`);
  if (standing.never > 0) parts.push(`${standing.never} not checked`);

  // Nothing judged is not the same as nothing wrong: only healthy checks earn
  // the accent, so "2 not checked" never looks like a pass.
  const tone: StandingTone =
    standing.down > 0
      ? 'danger'
      : standing.slow > 0
        ? 'ember'
        : standing.up > 0
          ? 'accent'
          : 'neutral';
  return { text: parts.join(' · '), tone };
}
