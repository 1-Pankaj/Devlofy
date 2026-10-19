/**
 * Sentinel's known-answer checks.
 *
 * Same habit as Bench's file next door, deliberately a second file: each folder's
 * checks stay runnable on their own, and the runner (see [[03-architecture]])
 * formats either one the same way because the result shape is identical.
 *
 * What is checked here is everything a screenshot cannot confirm: the verdict a
 * set of facts produces, the arithmetic behind an uptime percentage, where an
 * incident starts and ends, and how a typed URL is read. The network itself is
 * never touched — `verdictFor` is handed the facts a probe *would* return.
 *
 * Nothing imports this module, so it never reaches a bundle.
 */
import {
  formatAgo,
  formatMs,
  formatPercent,
  formatSpan,
  hostOf,
  incidentsIn,
  isStale,
  labelFromUrl,
  latencyStats,
  minutesSince,
  normalizeUrl,
  standingLine,
  standingOf,
  uptimeIn,
  verdictFor,
  verdictLabel,
  worstFirst,
  type CheckFacts,
  type CheckLike,
  type Verdict,
} from './status';

export type CheckResult = { name: string; pass: boolean; detail: string };

function check(name: string, actual: unknown, expected: unknown): CheckResult {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return { name, pass: a === e, detail: a === e ? a : `got ${a}, wanted ${e}` };
}

function contains(name: string, haystack: string, needle: string): CheckResult {
  return {
    name,
    pass: haystack.includes(needle),
    detail: haystack.includes(needle)
      ? 'contains'
      : `missing ${JSON.stringify(needle)} in ${haystack}`,
  };
}

const facts = (over: Partial<CheckFacts> = {}): CheckFacts => ({
  reached: true,
  status: 200,
  ms: 120,
  detail: null,
  source: 'native',
  ...over,
});

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 12, minute, 0)).toISOString();

const checkRow = (minute: number, verdict: Verdict, ms = 100): CheckLike => ({
  checked_at: at(minute),
  verdict,
  ms,
  status: verdict === 'down' ? null : 200,
});

export function runSelfCheck(): CheckResult[] {
  const results: CheckResult[] = [];

  // ── the verdict: every branch of the one function the feature rests on
  results.push(
    check('unreached is down', verdictFor(facts({ reached: false, status: null }), {
      expectStatus: null,
      expectMs: null,
    }), 'down'),
    check('200 with no expectation is up', verdictFor(facts(), {
      expectStatus: null,
      expectMs: null,
    }), 'up'),
    check('the expected status is up', verdictFor(facts({ status: 204 }), {
      expectStatus: 204,
      expectMs: null,
    }), 'up'),
    check('a status other than the expected one is down', verdictFor(facts({ status: 404 }), {
      expectStatus: 200,
      expectMs: null,
    }), 'down'),
    check('500 with no expectation is still down', verdictFor(facts({ status: 500 }), {
      expectStatus: null,
      expectMs: null,
    }), 'down'),
    check('a redirect with no expectation is up', verdictFor(facts({ status: 301 }), {
      expectStatus: null,
      expectMs: null,
    }), 'up'),
    check('over the time budget is slow, not down', verdictFor(facts({ ms: 900 }), {
      expectStatus: null,
      expectMs: 500,
    }), 'slow'),
    check('at the budget exactly is up', verdictFor(facts({ ms: 500 }), {
      expectStatus: null,
      expectMs: 500,
    }), 'up'),
    // Web: no status was readable, so only arrival is claimed — never "down".
    check('an opaque web answer with no budget is up', verdictFor(
      facts({ status: null, source: 'web' }),
      { expectStatus: 200, expectMs: null },
    ), 'up'),
    check('an opaque web answer over budget is slow', verdictFor(
      facts({ status: null, ms: 400, source: 'web' }),
      { expectStatus: null, expectMs: 100 },
    ), 'slow'),
    check('a web request that failed is down', verdictFor(
      facts({ reached: false, status: null, source: 'web' }),
      { expectStatus: null, expectMs: null },
    ), 'down'),
  );

  // ── the word: a web result never claims more than it proved
  results.push(
    check('native up reads "up"', verdictLabel('up', 'native'), 'up'),
    check('native slow reads "slow"', verdictLabel('slow', 'native'), 'slow'),
    check('native down reads "down"', verdictLabel('down', 'native'), 'down'),
    check('web up reads "reachable"', verdictLabel('up', 'web'), 'reachable'),
    check('web slow reads "reachable · slow"', verdictLabel('slow', 'web'), 'reachable · slow'),
    check('web down reads "unreachable"', verdictLabel('down', 'web'), 'unreachable'),
  );

  // ── uptime: coverage and reliability over a window
  const window: CheckLike[] = [
    checkRow(-10, 'down'), // outside the window
    checkRow(1, 'up'),
    checkRow(2, 'up'),
    checkRow(3, 'slow'),
    checkRow(4, 'up'),
    checkRow(5, 'down'),
    checkRow(6, 'down'),
    checkRow(7, 'up'),
  ];
  results.push(
    check('a window counts only what is inside it', uptimeIn(window, at(0), at(30)), {
      total: 7,
      up: 4,
      slow: 1,
      down: 2,
      ratio: 5 / 7,
      worst: 'down',
    }),
    check('an empty window has no ratio', uptimeIn(window, at(200)), {
      total: 0,
      up: 0,
      slow: 0,
      down: 0,
      ratio: null,
      worst: null,
    }),
    check('a window with only slow checks still counts as up', uptimeIn([checkRow(1, 'slow')], at(0)).ratio, 1),
    check('a boundary check belongs to the window', uptimeIn(window, at(1), at(1)).total, 1),
  );

  // ── latency: failures are excluded, because a timeout is not a response time
  results.push(
    check(
      'the spread of five answers',
      latencyStats([100, 200, 300, 400, 500].map((ms, index) => checkRow(index, 'up', ms))),
      { count: 5, min: 100, median: 300, p95: 500, max: 500 },
    ),
    check('a failure is not a latency', latencyStats([checkRow(1, 'down', 10_000)]), null),
    check(
      'no answers, no stats',
      latencyStats([checkRow(1, 'down', 10_000), checkRow(2, 'down', 10_000)]),
      null,
    ),
    check('a slow answer still counts', latencyStats([checkRow(1, 'slow', 800)])?.median, 800),
    check('one answer is its own median', latencyStats([checkRow(1, 'up', 42)])?.p95, 42),
  );

  // ── incidents: three in a row, derived from the verdicts, never stored
  results.push(
    check(
      'three consecutive failures are an incident',
      incidentsIn([checkRow(1, 'down'), checkRow(2, 'down'), checkRow(3, 'down'), checkRow(4, 'up')]),
      [{ startedAt: at(1), endedAt: at(4), failures: 3, minutes: 3, ongoing: false }],
    ),
    check(
      'two failures are not',
      incidentsIn([checkRow(1, 'down'), checkRow(2, 'down')]),
      [],
    ),
    check(
      'a run that never ended is ongoing',
      incidentsIn([checkRow(1, 'up'), checkRow(2, 'down'), checkRow(3, 'down'), checkRow(4, 'down')]),
      [{ startedAt: at(2), endedAt: null, failures: 3, minutes: null, ongoing: true }],
    ),
    check(
      'a slow check breaks a run',
      incidentsIn([
        checkRow(1, 'down'),
        checkRow(2, 'down'),
        checkRow(3, 'slow'),
        checkRow(4, 'down'),
        checkRow(5, 'down'),
      ]),
      [],
    ),
    check(
      'two separate runs stay two incidents',
      incidentsIn([
        checkRow(1, 'down'),
        checkRow(2, 'down'),
        checkRow(3, 'down'),
        checkRow(4, 'up'),
        checkRow(5, 'down'),
        checkRow(6, 'down'),
        checkRow(7, 'down'),
      ]),
      [
        { startedAt: at(1), endedAt: at(4), failures: 3, minutes: 3, ongoing: false },
        { startedAt: at(5), endedAt: null, failures: 3, minutes: null, ongoing: true },
      ],
    ),
    check(
      'a long run is one incident, with its length',
      incidentsIn(
        [1, 2, 3, 4, 5].map((minute) => checkRow(minute, 'down')),
      )[0].failures,
      5,
    ),
    check(
      'a higher threshold changes the rule, not the data',
      incidentsIn([checkRow(1, 'down'), checkRow(2, 'down'), checkRow(3, 'down')], 4),
      [],
    ),
    check('incidents are ordered oldest first', incidentsIn([
      checkRow(9, 'down'),
      checkRow(1, 'down'),
      checkRow(8, 'down'),
      checkRow(2, 'down'),
      checkRow(3, 'down'),
      checkRow(10, 'down'),
    ])[0].startedAt, at(1)),
  );

  // ── staleness and "how long ago"
  results.push(
    check('no check at all is stale', isStale(null, Date.parse(at(0))), true),
    check('a fresh check is not stale', isStale(at(0), Date.parse(at(5))), false),
    check('a check exactly at the threshold is stale', isStale(at(0), Date.parse(at(15))), true),
    check('minutes since a check', minutesSince(at(0), Date.parse(at(7))), 7),
    check('minutes since nothing', minutesSince(null), null),
  );

  // ── worst first: the board's whole ordering rule
  results.push(
    check(
      'down, then slow, then up, then never-checked',
      worstFirst([
        { name: 'never', verdict: null },
        { name: 'up', verdict: 'up' as Verdict },
        { name: 'down', verdict: 'down' as Verdict },
        { name: 'slow', verdict: 'slow' as Verdict },
      ]).map((row) => row.name),
      ['down', 'slow', 'up', 'never'],
    ),
    check('dates sort as their verdicts, not their clock', worstFirst([
      { id: 'a', verdict: 'down' as Verdict },
      { id: 'b', verdict: 'slow' as Verdict },
      { id: 'c', verdict: 'up' as Verdict },
    ])[0].id, 'a'),
  );

  // ── reading a typed URL
  const url = (input: string) => {
    const result = normalizeUrl(input);
    return result.ok ? result.url : `!${result.message}`;
  };
  results.push(
    check('a bare host gets https', url('example.com'), 'https://example.com/'),
    check('a typed scheme is kept', url('https://api.dev/health'), 'https://api.dev/health'),
    check('surrounding space is trimmed', url('  spaced.dev  '), 'https://spaced.dev/'),
    check('http is honoured (a dev server)', url('http://localhost:8081'), 'http://localhost:8081/'),
    check('a bare host:port is not read as a scheme', url('localhost:8081'), 'https://localhost:8081/'),
    check('an IP is a host', url('10.0.0.5:9000/health'), 'https://10.0.0.5:9000/health'),
    check('a path and query survive', url('example.com/a?b=1#c'), 'https://example.com/a?b=1#c'),
    check('uppercase hosts are lowered', url('EXAMPLE.com'), 'https://example.com/'),
    check('an empty target is refused', normalizeUrl('   ').ok, false),
    check('a non-http scheme is refused', normalizeUrl('ftp://files.dev').ok, false),
    check(
      'and says which schemes are allowed',
      normalizeUrl('ftp://files.dev').ok ? '' : (normalizeUrl('ftp://files.dev') as { message: string }).message,
      'Only http and https targets can be watched.',
    ),
    check('javascript: is not a target', normalizeUrl('javascript:alert(1)').ok, false),
    check('a hostless word is refused', normalizeUrl('not-a-host').ok, false),
    check('an empty target says what to do', normalizeUrl('').ok ? '' : (normalizeUrl('') as { message: string }).message, 'Enter a URL.'),
    check('a trailing scheme:// with no host is refused', normalizeUrl('https://').ok, false),
  );

  // ── labels and formatting: one decision, every screen
  results.push(
    check('the host of a target', hostOf('https://api.northwind.io/health'), 'api.northwind.io'),
    check('www is noise', hostOf('https://www.example.com/'), 'example.com'),
    check('a bad URL falls back to itself', hostOf('not a url'), 'not a url'),
    check('an unnamed target is its host', labelFromUrl('https://api.dev/'), 'api.dev'),
    check('milliseconds read as milliseconds', formatMs(412), '412 ms'),
    check('a second reads as a second', formatMs(1240), '1.24 s'),
    check('a long second keeps one decimal', formatMs(12_400), '12.4 s'),
    check('nothing reads as a dash', formatMs(null), '—'),
    check('a percentage keeps one decimal', formatPercent(0.994), '99.4%'),
    check('perfection is not rounded down to 99.9', formatPercent(1), '100%'),
    check('nothing reads as a dash here too', formatPercent(null), '—'),
    check('just now', formatAgo(0), 'just now'),
    check('minutes', formatAgo(4), '4m ago'),
    check('hours', formatAgo(180), '3h ago'),
    check('days', formatAgo(2880), '2d ago'),
    check('never', formatAgo(null), 'never'),
    check('a span under a minute', formatSpan(0), 'under a minute'),
    check('a span of minutes', formatSpan(8), '8m'),
    check('whole hours', formatSpan(120), '2h'),
    check('hours and minutes', formatSpan(72), '1h 12m'),
    check('an unfinished incident', formatSpan(null), 'still failing'),
    contains('the web note explains the limit', verdictLabel('up', 'web'), 'reachable'),
  );

  // ── the standing: the one sentence Today and More both show
  const standingSite = (id: string, enabled = 1) => ({ id, enabled });
  const standingCheck = (
    site_id: string,
    verdict: Verdict,
    source: 'native' | 'web' = 'native',
    minute = 0,
  ) => ({ site_id, verdict, checked_at: at(minute), source });

  results.push(
    check(
      'everything up reads as one line',
      standingLine(
        standingOf(
          [standingSite('a'), standingSite('b'), standingSite('c')],
          [standingCheck('a', 'up'), standingCheck('b', 'up'), standingCheck('c', 'up')],
        ),
      ),
      { text: '3 up', tone: 'accent' },
    ),
    check(
      'a down target leads the sentence',
      standingLine(
        standingOf(
          [standingSite('a'), standingSite('b'), standingSite('c'), standingSite('d')],
          [
            standingCheck('a', 'down'),
            standingCheck('b', 'up'),
            standingCheck('c', 'up'),
            standingCheck('d', 'up'),
          ],
        ),
      ),
      { text: '1 down · 3 up', tone: 'danger' },
    ),
    check(
      'slow is its own word, and ember',
      standingLine(
        standingOf(
          [standingSite('a'), standingSite('b'), standingSite('c')],
          [
            standingCheck('a', 'slow'),
            standingCheck('b', 'up'),
            standingCheck('c', 'up'),
          ],
        ),
      ),
      { text: '1 slow · 2 up', tone: 'ember' },
    ),
    check(
      'a browser-only board says unreachable, never down',
      standingLine(
        standingOf(
          [standingSite('a'), standingSite('b')],
          [standingCheck('a', 'down', 'web'), standingCheck('b', 'up', 'web')],
        ),
      ),
      { text: '1 unreachable · 1 reachable', tone: 'danger' },
    ),
    check(
      'one native check is enough to say down',
      standingLine(
        standingOf(
          [standingSite('a'), standingSite('b')],
          [standingCheck('a', 'down', 'web'), standingCheck('b', 'up', 'native')],
        ),
      ),
      { text: '1 down · 1 up', tone: 'danger' },
    ),
    // The important one: a paused target is history, not an alarm.
    check(
      'a paused target cannot raise the alarm',
      standingOf(
        [standingSite('a'), standingSite('b', 0)],
        [standingCheck('a', 'up'), standingCheck('b', 'down')],
      ),
      {
        sites: 2,
        watched: 1,
        paused: 1,
        up: 1,
        slow: 0,
        down: 0,
        never: 0,
        worst: 'up',
        lastCheckedAt: at(0),
        reachedOnly: false,
      },
    ),
    check(
      'nothing judged yet is neutral, not a pass',
      standingLine(standingOf([standingSite('a'), standingSite('b')], [])),
      { text: '2 not checked', tone: 'neutral' },
    ),
    check(
      'a mix says what is judged and what is not',
      standingLine(
        standingOf([standingSite('a'), standingSite('b')], [standingCheck('a', 'up')]),
      ),
      { text: '1 up · 1 not checked', tone: 'accent' },
    ),
    check(
      'all paused is its own sentence',
      standingLine(standingOf([standingSite('a', 0), standingSite('b', 0)], [])),
      { text: '2 paused', tone: 'neutral' },
    ),
    check('no targets, nothing to say', standingLine(standingOf([], [])), null),
    check(
      'the newest check wins the timestamp',
      standingOf(
        [standingSite('a'), standingSite('b')],
        [standingCheck('a', 'up', 'native', 3), standingCheck('b', 'up', 'native', 9)],
      ).lastCheckedAt,
      at(9),
    ),
    check(
      'the worst verdict wins, not the newest',
      standingOf(
        [standingSite('a'), standingSite('b')],
        [standingCheck('a', 'down', 'native', 1), standingCheck('b', 'up', 'native', 9)],
      ).worst,
      'down',
    ),
  );

  return results;
}
