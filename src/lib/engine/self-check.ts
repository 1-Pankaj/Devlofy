/**
 * The Engine's known-answer checks.
 *
 * The third file of its kind (see [[03-architecture]]), and the one the backlog
 * asked for by name: the ranking is the app's only "opinion" — a weight table
 * nobody can see — so every weight, every reason string and every tie-break it
 * can produce is pinned here. If a card ever tells the user to do something
 * without saying why, one of these fails.
 *
 * What is checked:
 *  - `rhythm.ts` — the hourly and weekday totals, the median block, the peak
 *    band (including a band that wraps past midnight) and the sentences the UI
 *    is allowed to say, including the ones it must *not* say when the sample is
 *    too small.
 *  - `next-up.ts` — the weight table in full, the decay on an overdue task, the
 *    clamp on the priority column, that every positive signal produces a reason,
 *    that reasons are ordered by how much they moved the score and capped at
 *    three, and every tie-break in `rankTasks`.
 *  - `estimate.ts` — drift as a ratio rather than a verdict, the median that
 *    resists one runaway task, the sample floor below which the UI says nothing,
 *    and both boundaries of the +15%/-15% sentence.
 *
 * Nothing imports this module, so it never reaches a bundle. Run it with
 * `npm run check`, or the recipe in [[03-architecture]].
 */
import {
  buildRhythm,
  formatHour,
  inPeakBand,
  rhythmInsights,
  type Rhythm,
} from './rhythm';
import { projectMinutesToday, rankTasks, scoreTask, type EngineContext } from './next-up';
import { driftInsight, estimateDrift } from './estimate';
import type { EstimateSample, TaskRow } from '@/lib/db/repo';

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

function lacks(name: string, haystack: string, needle: string): CheckResult {
  return {
    name,
    pass: !haystack.includes(needle),
    detail: !haystack.includes(needle)
      ? 'absent'
      : `unexpected ${JSON.stringify(needle)} in ${haystack}`,
  };
}

// ── fixtures ─────────────────────────────────────────────────────────────────
// Every date is built in local time, because the Engine measures calendar days
// and local hours — the same rule the app runs under.

const NOW = new Date(2026, 9, 20, 10, 0, 0); // Tue 20 Oct 2026, 10:00 local
const DAY = 86_400_000;

const hours = (over: Record<number, number> = {}): number[] =>
  Array.from({ length: 24 }, (_, hour) => over[hour] ?? 0);

const rhythm = (over: Partial<Rhythm> = {}): Rhythm => ({
  sessions: 0,
  totalMinutes: 0,
  byHour: hours(),
  byWeekday: [0, 0, 0, 0, 0, 0, 0],
  peak: null,
  medianBlockMinutes: null,
  calibrated: false,
  ...over,
});

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  now: NOW,
  rhythm: rhythm(),
  projectMinutesToday: {},
  ...over,
});

const task = (over: Partial<TaskRow> = {}): TaskRow => ({
  id: 't',
  project_id: null,
  title: 'a task',
  status: 'open',
  priority: 0,
  energy: 'shallow',
  est_minutes: null,
  due_at: null,
  created_at: NOW.toISOString(),
  ...over,
});

/** A session at a local hour today, so weekday/hour bucketing is unambiguous. */
const session = (hour: number, minutes: number | null, dayOffset = 0) => ({
  started_at: new Date(2026, 9, 20 + dayOffset, hour, 0, 0).toISOString(),
  minutes,
});

const sample = (est: number, actual: number, id = 't'): EstimateSample => ({
  task_id: id,
  title: 'a task',
  est_minutes: est,
  actual_minutes: actual,
  sessions: 1,
});

const peak = (startHour: number, minutes: number, share: number) => ({
  startHour,
  endHour: (startHour + 3) % 24,
  minutes,
  share,
});

export function runSelfCheck(): CheckResult[] {
  const results: CheckResult[] = [];

  // ── rhythm: the measured report ────────────────────────────────────────────
  const empty = buildRhythm([]);
  results.push(
    check('an empty log reports nothing', [empty.sessions, empty.totalMinutes, empty.peak, empty.medianBlockMinutes], [0, 0, null, null]),
    check('an empty log is not calibrated', empty.calibrated, false),
    check('the hourly histogram always has 24 buckets', empty.byHour.length, 24),
    check('the weekday histogram always has 7 buckets', empty.byWeekday.length, 7),
  );

  const oneHour = buildRhythm([session(9, 50)]);
  results.push(
    check('minutes land in their local hour', oneHour.byHour[9], 50),
    // 20 Oct 2026 is a Tuesday, so index 2 — the histogram is local-time keyed.
    check('minutes land in their local weekday', oneHour.byWeekday[2], 50),
    check('no other weekday is credited', oneHour.byWeekday.filter((m) => m > 0).length, 1),
    check('only the used hour is non-zero', oneHour.byHour.filter((m) => m > 0).length, 1),
    check('the total is the sum of the blocks', oneHour.totalMinutes, 50),
    check('one block is one session', oneHour.sessions, 1),
    check('the median of one block is that block', oneHour.medianBlockMinutes, 50),
  );

  const dirty = buildRhythm([
    session(9, 30),
    session(10, null),
    session(11, 0),
    session(12, -20),
    { started_at: 'not a date', minutes: 45 },
  ]);
  results.push(
    check('a null duration is not a block', [dirty.sessions, dirty.totalMinutes], [1, 30]),
    check('a zero or negative duration is not a block', dirty.byHour[11], 0),
    check('an unparseable start is skipped', dirty.byHour[12], 0),
  );

  const medianOdd = buildRhythm([session(9, 30), session(10, 45), session(11, 60)]);
  const medianEven = buildRhythm([session(9, 20), session(10, 31)]);
  results.push(
    check('the median block of three is the middle one', medianOdd.medianBlockMinutes, 45),
    check('the median block of two rounds the pair', medianEven.medianBlockMinutes, 26),
  );

  const five = buildRhythm([30, 30, 30, 30, 30].map((m, i) => session(9 + i, m)));
  const six = buildRhythm([30, 30, 30, 30, 30, 30].map((m, i) => session(9 + i, m)));
  results.push(
    check('five blocks are not yet a pattern', five.calibrated, false),
    check('six blocks are', six.calibrated, true),
  );

  // The band is three consecutive hours, so three solid hours should win outright.
  const banded = buildRhythm([session(9, 60), session(10, 60), session(11, 60), session(15, 10)]);
  results.push(
    check('the peak band is the three hours that hold the most focus', banded.peak, peak(9, 180, 180 / 190)),
    check('the peak band ends three hours later', banded.peak?.endHour, 12),
    check('the band share is its minutes over the total', Math.round((banded.peak?.share ?? 0) * 100), 95),
  );

  // Ties are real: one 09:00 block is contained by bands starting at 07, 08 and 09.
  const tied = buildRhythm([session(9, 60)]);
  results.push(
    check('a tie between bands resolves to the earliest start, deterministically', tied.peak?.startHour, 7),
  );

  const wrapping = buildRhythm([session(23, 30), { started_at: new Date(2026, 9, 21, 0, 30).toISOString(), minutes: 30 }]);
  results.push(
    check('a band can wrap past midnight', wrapping.peak, peak(22, 60, 1)),
    check('a wrapped band ends after midnight', wrapping.peak?.endHour, 1),
  );

  const inBand = rhythm({ peak: peak(9, 180, 0.6) });
  const wrappedBand = rhythm({ peak: peak(22, 180, 0.6) });
  results.push(
    check('inside the band is in the peak', inPeakBand(inBand, new Date(2026, 9, 20, 9, 30)), true),
    check('the last hour of the band is in the peak', inPeakBand(inBand, new Date(2026, 9, 20, 11, 59)), true),
    check('the hour the band ends is out', inPeakBand(inBand, new Date(2026, 9, 20, 12, 0)), false),
    check('the hour before the band starts is out', inPeakBand(inBand, new Date(2026, 9, 20, 8, 59)), false),
    check('a wrapped band includes late evening', inPeakBand(wrappedBand, new Date(2026, 9, 20, 23, 0)), true),
    check('a wrapped band includes after midnight', inPeakBand(wrappedBand, new Date(2026, 9, 20, 0, 30)), true),
    check('a wrapped band excludes the hour it ends', inPeakBand(wrappedBand, new Date(2026, 9, 20, 1, 0)), false),
    check('no learned peak means never in the peak', inPeakBand(rhythm(), new Date(2026, 9, 20, 10, 0)), false),
    check('hours are formatted with a leading zero', formatHour(9), '09:00'),
    check('midnight formats as 00:00', formatHour(0), '00:00'),
  );

  const noBlocks = rhythmInsights(rhythm());
  const twoBlocks = rhythmInsights(buildRhythm([session(9, 30), session(10, 30)]));
  const oneBlock = rhythmInsights(buildRhythm([session(9, 30)]));
  results.push(
    check('no blocks produces exactly one sentence', noBlocks.length, 1),
    contains('the first-run sentence says there is no data', noBlocks[0] ?? '', 'No finished blocks'),
    contains('a small sample says the pattern is not there yet', twoBlocks[0] ?? '', 'firms up after about six'),
    contains('one block is phrased in the singular', oneBlock[0] ?? '', '1 block logged'),
  );

  const strongRhythm = buildRhythm(
    [9, 9, 10, 10, 10, 11].map((hour, i) => ({ started_at: new Date(2026, 9, 20, hour, i).toISOString(), minutes: 40 })),
  );
  const strongInsights = rhythmInsights(strongRhythm);
  results.push(
    check('six blocks are enough for insights', strongInsights.length > 0, true),
    contains('the strongest stretch is named with its hours', strongInsights.join(' '), '09:00–12:00'),
    contains('a typical block is named', strongInsights.join(' '), 'runs 40m'),
    check('insights never exceed three sentences', strongInsights.length <= 3, true),
  );

  // Six blocks, four hours apart: calibrated, but no three-hour band holds 30%,
  // so the strongest-stretch sentence must stay unsaid.
  const spread = buildRhythm(
    [0, 4, 8, 12, 16, 20].map((hour) => ({
      started_at: new Date(2026, 9, 20, hour, 0).toISOString(),
      minutes: 20,
    })),
  );
  results.push(
    lacks('a spread-out log makes no strongest-stretch claim', rhythmInsights(spread).join(' '), 'strongest stretch'),
  );

  // ── next-up: the weight table, one judgement per check ─────────────────────
  const score = (over: Partial<TaskRow> = {}, context: EngineContext = ctx()) =>
    scoreTask(task(over), context).score;
  const reasons = (over: Partial<TaskRow> = {}, context: EngineContext = ctx()) =>
    scoreTask(task(over), context).reasons;

  results.push(
    check('an unremarkable task scores zero', score(), 0),
    check('priority 1 is worth ten', score({ priority: 1 }), 10),
    check('priority 2 is worth twenty-two', score({ priority: 2 }), 22),
    check('priority above the column clamps to the top weight', score({ priority: 9 }), 22),
    check('a negative priority clamps to zero', score({ priority: -4 }), 0),
    check('high priority is a stated reason', reasons({ priority: 2 }), ['high priority']),
    check('priority 1 is not worth a reason', reasons({ priority: 1 }), []),
  );

  const overdueOne = new Date(2026, 9, 19, 9, 0).toISOString();
  const overdueTen = new Date(2026, 9, 10, 9, 0).toISOString();
  results.push(
    check('one day overdue is worth thirty-nine', score({ due_at: overdueOne }), 39),
    check('an overdue task says how late it is', reasons({ due_at: overdueOne }), ['1d overdue']),
    check('the overdue weight decays three points a day, floored at seven days', score({ due_at: overdueTen }), 21),
    check('the overdue reason keeps the real day count past the floor', reasons({ due_at: overdueTen }), ['10d overdue']),
    check('due today is worth thirty-two', score({ due_at: new Date(2026, 9, 20, 23, 0).toISOString() }), 32),
    check('due today is stated', reasons({ due_at: new Date(2026, 9, 20, 23, 0).toISOString() }), ['due today']),
    check('due tomorrow is worth twenty', score({ due_at: new Date(2026, 9, 21, 8, 0).toISOString() }), 20),
    check('due tomorrow is stated', reasons({ due_at: new Date(2026, 9, 21, 8, 0).toISOString() }), ['due tomorrow']),
    check('due inside the week is worth twelve', score({ due_at: new Date(2026, 9, 23, 8, 0).toISOString() }), 12),
    check('due inside the week states the distance', reasons({ due_at: new Date(2026, 9, 23, 8, 0).toISOString() }), ['due in 3d']),
    check('due later is a small nudge', score({ due_at: new Date(2026, 10, 20, 8, 0).toISOString() }), 4),
    check('due later is too far away to state', reasons({ due_at: new Date(2026, 10, 20, 8, 0).toISOString() }), []),
  );

  const shortBlocks = ctx({ rhythm: rhythm({ medianBlockMinutes: 30, peak: null }) });
  const longBlocks = ctx({ rhythm: rhythm({ medianBlockMinutes: 60, peak: null }) });
  results.push(
    check('an estimate that fits one block is worth twelve', score({ est_minutes: 30 }, shortBlocks), 12),
    check('it says which block it fits', reasons({ est_minutes: 30 }, shortBlocks), ['fits one 30m block']),
    check('an estimate at twice the block is a long haul', score({ est_minutes: 60 }, shortBlocks), -6),
    check('the long haul names the estimate', reasons({ est_minutes: 60 }, shortBlocks), ['60m — a long haul']),
    check('an estimate between the two is left alone', score({ est_minutes: 45 }, shortBlocks), 0),
    check('an estimate between the two says nothing', reasons({ est_minutes: 45 }, shortBlocks), []),
    check('an estimate longer than half a block still fits', score({ est_minutes: 30 }, longBlocks), 12),
    check('no learned block means no estimate signal', score({ est_minutes: 30 }, ctx()), 0),
  );

  const deepPeak = ctx({ rhythm: rhythm({ peak: peak(9, 180, 0.5), medianBlockMinutes: 30 }) });
  const offPeak = ctx({
    now: new Date(2026, 9, 20, 20, 0, 0),
    rhythm: rhythm({ peak: peak(9, 180, 0.5), medianBlockMinutes: 30 }),
  });
  results.push(
    check('deep work in the peak is worth fourteen', score({ energy: 'deep' }, deepPeak), 14),
    check('deep work in the peak says why', reasons({ energy: 'deep' }, deepPeak), ['your best hours are now']),
    check('shallow work in the peak is penalised', score({ energy: 'shallow' }, deepPeak), -8),
    check('a penalty is not a reason to show', reasons({ energy: 'shallow' }, deepPeak), []),
    check('deep work out of the peak is mildly penalised', score({ energy: 'deep' }, offPeak), -3),
    check('no learned peak means no energy signal', score({ energy: 'deep' }, ctx()), 0),
  );

  const old = (days: number): string => new Date(NOW.getTime() - days * DAY).toISOString();
  results.push(
    check('a task waiting thirteen days is not yet pressure', score({ created_at: old(13) }), 0),
    check('a task waiting fourteen days is worth eight', score({ created_at: old(14) }), 8),
    check('the wait switches to weeks at fourteen days', reasons({ created_at: old(14) }), ['waiting 2w']),
    check('the wait is stated in weeks from then on', reasons({ created_at: old(20) }), ['waiting 3w']),
    check('an unparseable creation date is ignored', score({ created_at: 'nonsense' }), 0),
  );

  results.push(
    check('ten minutes is a quick win', score({ est_minutes: 10 }), 6),
    check('fifteen minutes is still a quick win', score({ est_minutes: 15 }), 6),
    check('sixteen minutes is not', score({ est_minutes: 16 }), 0),
    check('a quick win says so', reasons({ est_minutes: 10 }), ['quick win']),
    check('quick win and fits-one-block both apply to a short estimate', score({ est_minutes: 10 }, shortBlocks), 18),
  );

  const moving = ctx({ projectMinutesToday: { p1: 20 } });
  results.push(
    check('a project already worked today is momentum', score({ project_id: 'p1' }, moving), 6),
    check('momentum is stated', reasons({ project_id: 'p1' }, moving), ['already moving today']),
    check('a project with no minutes today is not momentum', score({ project_id: 'p2' }, moving), 0),
    check('momentum needs a project', score({ project_id: null }, moving), 0),
    check('zero minutes today is not momentum', score({ project_id: 'p1' }, ctx({ projectMinutesToday: { p1: 0 } })), 0),
  );

  const everything = task({
    priority: 2,
    due_at: new Date(2026, 9, 20, 23, 0).toISOString(),
    energy: 'deep',
    est_minutes: 10,
    created_at: old(20),
    project_id: 'p1',
  });
  const everythingCtx = ctx({
    now: NOW,
    rhythm: rhythm({ peak: peak(9, 180, 0.5), medianBlockMinutes: 30 }),
    projectMinutesToday: { p1: 30 },
  });
  const everythingRanked = scoreTask(everything, everythingCtx);
  results.push(
    check(
      'every signal adds up to the score',
      everythingRanked.score,
      22 + 32 + 14 + 12 + 8 + 6 + 6,
    ),
    check('reasons are capped at three', everythingRanked.reasons.length, 3),
    check(
      'reasons are ordered by how much they moved the score',
      everythingRanked.reasons,
      ['due today', 'high priority', 'your best hours are now'],
    ),
    check('a task with nothing to say says nothing', scoreTask(task(), ctx()).reasons, []),
  );

  // ── next-up: ranking and its tie-breaks ────────────────────────────────────
  const ranked = rankTasks(
    [
      task({ id: 'low', priority: 0 }),
      task({ id: 'high', priority: 2 }),
      task({ id: 'mid', priority: 1 }),
    ],
    ctx(),
  );
  results.push(
    check('the backlog is ordered by score', ranked.map((r) => r.task.id), ['high', 'mid', 'low']),
    check('ranking returns one entry per task', ranked.length, 3),
  );

  const tiedPriority = rankTasks(
    [task({ id: 'a', priority: 0 }), task({ id: 'b', priority: 2 })],
    ctx(),
  );
  results.push(
    check('equal scores break on priority', tiedPriority.map((r) => r.task.id), ['b', 'a']),
  );

  // Same priority, same score: the due date decides, undated last.
  const tiedDue = rankTasks(
    [
      task({ id: 'none', due_at: null, priority: 1 }),
      task({ id: 'later', due_at: new Date(2026, 10, 1).toISOString(), priority: 1 }),
      task({ id: 'sooner', due_at: new Date(2026, 9, 25).toISOString(), priority: 1 }),
    ],
    ctx({ rhythm: rhythm({ medianBlockMinutes: null }) }),
  );
  results.push(
    check('equal scores break on the sooner due date', tiedDue.map((r) => r.task.id), ['sooner', 'later', 'none']),
  );

  const tiedCreated = rankTasks(
    [
      task({ id: 'newer', priority: 1, created_at: new Date(2026, 9, 19).toISOString() }),
      task({ id: 'older', priority: 1, created_at: new Date(2026, 9, 1).toISOString() }),
    ],
    ctx(),
  );
  results.push(
    check('equal scores and dates break on the older task', tiedCreated.map((r) => r.task.id), ['older', 'newer']),
  );

  const limited = rankTasks([task({ id: 'a', priority: 2 }), task({ id: 'b', priority: 1 })], ctx(), 1);
  results.push(
    check('a limit slices the ranked list', limited.map((r) => r.task.id), ['a']),
    check('an empty backlog ranks to nothing', rankTasks([], ctx()).length, 0),
  );

  const original = [task({ id: 'b', priority: 0 }), task({ id: 'a', priority: 2 })];
  rankTasks(original, ctx());
  results.push(
    check('ranking does not reorder the caller’s array', original.map((t) => t.id), ['b', 'a']),
  );

  // ── next-up: today's minutes, the momentum input ───────────────────────────
  results.push(
    check(
      'today’s minutes are summed per project',
      projectMinutesToday(
        [
          { project_id: 'p1', minutes: 25, started_at: new Date(2026, 9, 20, 9, 0).toISOString() },
          { project_id: 'p1', minutes: 15, started_at: new Date(2026, 9, 20, 11, 0).toISOString() },
          { project_id: 'p2', minutes: 30, started_at: new Date(2026, 9, 20, 12, 0).toISOString() },
        ],
        NOW,
      ),
      { p1: 40, p2: 30 },
    ),
    check(
      'yesterday’s work is not today’s momentum',
      projectMinutesToday(
        [{ project_id: 'p1', minutes: 60, started_at: new Date(2026, 9, 19, 9, 0).toISOString() }],
        NOW,
      ),
      {},
    ),
    check(
      'a session with no project contributes nothing',
      projectMinutesToday(
        [{ project_id: null, minutes: 60, started_at: new Date(2026, 9, 20, 9, 0).toISOString() }],
        NOW,
      ),
      {},
    ),
    check(
      'an unparseable start is skipped',
      projectMinutesToday([{ project_id: 'p1', minutes: 60, started_at: 'nope' }], NOW),
      {},
    ),
    check(
      'a null duration counts as zero',
      projectMinutesToday(
        [{ project_id: 'p1', minutes: null, started_at: new Date(2026, 9, 20, 9, 0).toISOString() }],
        NOW,
      ),
      { p1: 0 },
    ),
  );

  // ── estimate drift: a ratio, never a verdict ───────────────────────────────
  results.push(
    check('no samples means no drift', estimateDrift([]), null),
    check('samples without both numbers are dropped', estimateDrift([sample(0, 30), sample(30, 0)]), null),
    check(
      'drift is actual over estimated',
      estimateDrift([sample(10, 15), sample(30, 45)])?.ratio,
      1.5,
    ),
    check(
      'the typical minutes are rounded per task',
      estimateDrift([sample(10, 10), sample(15, 15)])?.typicalEstimateMinutes,
      13,
    ),
    check(
      'the median ratio resists one runaway task',
      estimateDrift([sample(10, 10), sample(10, 10), sample(10, 50)])?.medianRatio,
      1,
    ),
    check('the sample count is the usable one', estimateDrift([sample(10, 10), sample(0, 5)])?.samples, 1),
    check('three samples are not calibrated', estimateDrift([sample(10, 10), sample(10, 10), sample(10, 10)])?.calibrated, false),
    check(
      'four samples are',
      estimateDrift([sample(10, 10), sample(10, 10), sample(10, 10), sample(10, 10)])?.calibrated,
      true,
    ),
  );

  const four = (est: number, actual: number) => [sample(est, actual, '1'), sample(est, actual, '2'), sample(est, actual, '3'), sample(est, actual, '4')];

  results.push(
    check('no drift, no sentence', driftInsight(null), null),
    check(
      'an uncalibrated drift keeps quiet',
      driftInsight(estimateDrift([sample(100, 200)])),
      null,
    ),
    check(
      'fifteen percent over is enough to say so',
      driftInsight(estimateDrift(four(100, 115))),
      'Your 100m estimates actually take about 115m — plan 15% more.',
    ),
    check(
      'fourteen percent over is called honest',
      driftInsight(estimateDrift(four(100, 114))),
      'Your estimates are honest — 100m predicted, 114m actual.',
    ),
    check(
      'fifteen percent under is called padding',
      driftInsight(estimateDrift(four(100, 85))),
      'You pad well: 100m estimates land in about 85m.',
    ),
    check(
      'fourteen percent under is still honest',
      driftInsight(estimateDrift(four(100, 86))),
      'Your estimates are honest — 100m predicted, 86m actual.',
    ),
  );

  return results;
}
