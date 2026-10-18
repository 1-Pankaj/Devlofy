/**
 * Next up — the Engine's ranking.
 *
 * The rule this file exists to enforce: **the app should be able to say what to
 * do next and why**, using only what the user already recorded. Every weight
 * below is a documented judgement call, not a learned parameter, and every one
 * produces a reason the UI can show. If a card ever tells the user to do
 * something without saying why, that is a bug in this file.
 */
import type { TaskRow } from '@/lib/db/repo';
import { inPeakBand, type Rhythm } from './rhythm';

export type EngineContext = {
  now: Date;
  rhythm: Rhythm;
  /** Minutes already focused today, keyed by project id. */
  projectMinutesToday: Record<string, number>;
};

export type RankedTask = {
  task: TaskRow;
  score: number;
  /** Short, human, ordered by how much it moved the score. */
  reasons: string[];
};

const DAY_MS = 86_400_000;

/** Judgement calls, kept in one place so they can be argued with. */
const WEIGHT = {
  /** Priority column is 0–2. */
  priority: [0, 10, 22],
  overdue: 42,
  overdueDecayPerDay: 3,
  dueToday: 32,
  dueTomorrow: 20,
  dueThisWeek: 12,
  dueLater: 4,
  /** Estimate fits inside the user's own typical block. */
  fitsOneBlock: 12,
  /** Estimate needs two or more of them — honest, but not urgent. */
  longJob: -6,
  /** Deep work during the hours the user actually does deep work. */
  deepInPeak: 14,
  /** Shallow work during those same hours is a poor use of them. */
  shallowInPeak: -8,
  deepOutOfPeak: -3,
  /** Sitting in the list for a fortnight is its own pressure. */
  waiting: 8,
  quickWin: 6,
  /** Something already touched today — finishing beats starting. */
  momentum: 6,
} as const;

const MAX_REASONS = 3;

function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

function formatDays(days: number): string {
  if (days >= 14) return `${Math.round(days / 7)}w`;
  return `${days}d`;
}

type Signal = { score: number; reason: string | null };

function dueSignal(task: TaskRow, now: Date): Signal {
  if (!task.due_at) return { score: 0, reason: null };
  const days = calendarDaysBetween(now, new Date(task.due_at));

  if (days < 0) {
    return {
      score: WEIGHT.overdue - Math.min(7, -days) * WEIGHT.overdueDecayPerDay,
      reason: `${-days}d overdue`,
    };
  }
  if (days === 0) return { score: WEIGHT.dueToday, reason: 'due today' };
  if (days === 1) return { score: WEIGHT.dueTomorrow, reason: 'due tomorrow' };
  if (days <= 7) return { score: WEIGHT.dueThisWeek, reason: `due in ${days}d` };
  return { score: WEIGHT.dueLater, reason: null };
}

function estimateSignal(task: TaskRow, rhythm: Rhythm): Signal {
  const estimate = task.est_minutes;
  if (!estimate || !rhythm.medianBlockMinutes) return { score: 0, reason: null };
  if (estimate <= rhythm.medianBlockMinutes) {
    return { score: WEIGHT.fitsOneBlock, reason: `fits one ${rhythm.medianBlockMinutes}m block` };
  }
  if (estimate >= rhythm.medianBlockMinutes * 2) {
    return { score: WEIGHT.longJob, reason: `${estimate}m — a long haul` };
  }
  return { score: 0, reason: null };
}

function energySignal(task: TaskRow, ctx: EngineContext): Signal {
  if (!ctx.rhythm.peak) return { score: 0, reason: null };
  const inPeak = inPeakBand(ctx.rhythm, ctx.now);
  if (task.energy === 'deep' && inPeak) {
    return { score: WEIGHT.deepInPeak, reason: 'your best hours are now' };
  }
  if (task.energy === 'shallow' && inPeak) {
    return { score: WEIGHT.shallowInPeak, reason: null };
  }
  if (task.energy === 'deep' && !inPeak) {
    return { score: WEIGHT.deepOutOfPeak, reason: null };
  }
  return { score: 0, reason: null };
}

function ageSignal(task: TaskRow, now: Date): Signal {
  const created = new Date(task.created_at);
  if (Number.isNaN(created.getTime())) return { score: 0, reason: null };
  const days = Math.floor((now.getTime() - created.getTime()) / DAY_MS);
  if (days < 14) return { score: 0, reason: null };
  return { score: WEIGHT.waiting, reason: `waiting ${formatDays(days)}` };
}

function quickWinSignal(task: TaskRow): Signal {
  if (!task.est_minutes || task.est_minutes > 15) return { score: 0, reason: null };
  return { score: WEIGHT.quickWin, reason: 'quick win' };
}

function momentumSignal(task: TaskRow, ctx: EngineContext): Signal {
  if (!task.project_id) return { score: 0, reason: null };
  const minutes = ctx.projectMinutesToday[task.project_id] ?? 0;
  if (minutes <= 0) return { score: 0, reason: null };
  return { score: WEIGHT.momentum, reason: 'already moving today' };
}

/** Score one task in isolation — the unit the weight table is argued about at. */
export function scoreTask(task: TaskRow, ctx: EngineContext): RankedTask {
  const signals: Signal[] = [
    {
      score: WEIGHT.priority[Math.min(2, Math.max(0, task.priority))] ?? 0,
      reason: task.priority >= 2 ? 'high priority' : null,
    },
    dueSignal(task, ctx.now),
    energySignal(task, ctx),
    estimateSignal(task, ctx.rhythm),
    ageSignal(task, ctx.now),
    momentumSignal(task, ctx),
    quickWinSignal(task),
  ];

  const score = signals.reduce((sum, signal) => sum + signal.score, 0);
  const reasons = signals
    .filter((signal): signal is { score: number; reason: string } => signal.reason !== null)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, MAX_REASONS)
    .map((signal) => signal.reason);

  return { task, score, reasons };
}

/** The whole open backlog, best first. */
export function rankTasks(tasks: TaskRow[], ctx: EngineContext, limit?: number): RankedTask[] {
  const ranked = tasks.map((task) => scoreTask(task, ctx)).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.task.priority !== a.task.priority) return b.task.priority - a.task.priority;
    const aDue = a.task.due_at ?? '9999';
    const bDue = b.task.due_at ?? '9999';
    if (aDue !== bDue) return aDue < bDue ? -1 : 1;
    return a.task.created_at < b.task.created_at ? -1 : 1;
  });
  return limit === undefined ? ranked : ranked.slice(0, limit);
}

/** Minutes already focused today, grouped by project — momentum input. */
export function projectMinutesToday(
  sessions: { project_id: string | null; minutes: number | null; started_at: string }[],
  now: Date,
): Record<string, number> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const totals: Record<string, number> = {};
  for (const session of sessions) {
    if (!session.project_id) continue;
    const started = new Date(session.started_at).getTime();
    if (Number.isNaN(started) || started < startOfToday) continue;
    totals[session.project_id] = (totals[session.project_id] ?? 0) + (session.minutes ?? 0);
  }
  return totals;
}
