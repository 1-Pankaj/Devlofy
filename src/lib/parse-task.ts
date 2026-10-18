/**
 * Quick-add grammar for the task box.
 *
 *   "Ship the invoice fix !3 45m tomorrow #Northwind"
 *        └ title        │  │   │        └ project (matched by name)
 *                       │  │   └ due date (today / tomorrow / fri / +3d)
 *                       │  └ estimate (45m / 1.5h)
 *                       └ priority (! = high, !1..!3)
 *
 * Pure: no database, no state. The screen shows the parse before committing it,
 * so the shorthand is discoverable instead of a hidden trick.
 */
export type ParsedTaskInput = {
  /** The title with every recognised token removed. */
  title: string;
  priority: number;
  estMinutes: number | null;
  projectId: string | null;
  /** ISO datetime for `tasks.due_at`, at 09:00 local on the due day. */
  dueAt: string | null;
  /** Recognised tokens, in the order they appeared — drives the preview chips. */
  tokens: {
    kind: 'priority' | 'estimate' | 'project' | 'due';
    label: string;
    tone: 'ember' | 'neutral' | 'accent';
  }[];
  /** Bare `#word` that matched nothing. */
  unknownProject: string | null;
};

export type ProjectOption = { id: string; name: string };

const DEFAULT_PRIORITY = 1;

const PRIORITY_LABEL: Record<number, string> = { 2: 'high', 1: 'normal', 0: 'someday' };

/**
 * The user types `!1` (someday) … `!3` (high); the column stores `0–2` with
 * `2` = high (see `docs/06-data-model.md`). Typing `!` alone means high.
 */
const PRIORITY_FROM_TYPED: Record<number, number> = { 1: 0, 2: 1, 3: 2 };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseEstimate(raw: string): number | null {
  const hours = /^(\d+(?:\.\d+)?)h$/i.exec(raw);
  if (hours) return Math.max(5, Math.round(Number(hours[1]) * 60));
  const minutes = /^(\d+)m$/i.exec(raw);
  if (minutes) return Math.max(5, Number(minutes[1]));
  return null;
}

/** 09:00 local on the given calendar day — tasks are day-scoped, not time-scoped. */
function dueOn(now: Date, addDays: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, 9, 0, 0, 0);
}

const RELATIVE_LABEL = (days: number) =>
  days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`;

function parseDue(raw: string, now: Date): { date: Date; label: string } | null {
  const lower = raw.toLowerCase();
  if (lower === 'today' || lower === 'tod') {
    return { date: dueOn(now, 0), label: 'today' };
  }
  if (lower === 'tomorrow' || lower === 'tmr') {
    return { date: dueOn(now, 1), label: 'tomorrow' };
  }
  const relative = /^\+(\d{1,2})d?$/.exec(lower);
  if (relative) {
    const days = Number(relative[1]);
    return { date: dueOn(now, days), label: RELATIVE_LABEL(days) };
  }
  if (lower.length >= 3) {
    const index = WEEKDAYS.findIndex((day) => day.toLowerCase() === lower.slice(0, 3));
    if (index !== -1) {
      const days = (index - now.getDay() + 7) % 7;
      return { date: dueOn(now, days), label: WEEKDAYS[index] };
    }
  }
  return null;
}

export function parseTaskInput(
  input: string,
  projects: ProjectOption[],
  now: Date = new Date(),
): ParsedTaskInput {
  let priority = DEFAULT_PRIORITY;
  let estMinutes: number | null = null;
  let projectId: string | null = null;
  let dueAt: string | null = null;
  let unknownProject: string | null = null;
  const tokens: ParsedTaskInput['tokens'] = [];

  const kept: string[] = [];

  for (const word of input.split(/\s+/)) {
    if (!word) continue;
    const lower = word.toLowerCase();

    // !3 / !2 / !1 / !
    if (/^!\d?$/.test(word)) {
      const typed = word.length === 1 ? 3 : Number(word.slice(1));
      priority = PRIORITY_FROM_TYPED[Math.min(3, Math.max(1, typed))];
      tokens.push({ kind: 'priority', label: PRIORITY_LABEL[priority], tone: 'ember' });
      continue;
    }

    // #project
    if (lower.startsWith('#') && word.length > 1) {
      const needle = lower.slice(1);
      const match =
        projects.find((p) => p.name.toLowerCase() === needle) ??
        projects.find((p) => p.name.toLowerCase().startsWith(needle)) ??
        projects.find((p) => p.name.toLowerCase().includes(needle));
      if (match) {
        projectId = match.id;
        tokens.push({ kind: 'project', label: match.name, tone: 'accent' });
      } else {
        // No match — keep the word so nothing the user typed is silently lost.
        unknownProject = word.slice(1);
        kept.push(word);
      }
      continue;
    }

    // today / tomorrow / fri / +3d
    const due = parseDue(word, now);
    if (due) {
      dueAt = due.date.toISOString();
      tokens.push({ kind: 'due', label: due.label, tone: 'neutral' });
      continue;
    }

    // 45m / 1.5h
    const estimate = parseEstimate(word);
    if (estimate !== null) {
      estMinutes = estimate;
      tokens.push({
        kind: 'estimate',
        label: estimate >= 60 ? `${Math.round((estimate / 60) * 10) / 10}h` : `${estimate}m`,
        tone: 'neutral',
      });
      continue;
    }

    kept.push(word);
  }

  return {
    title: kept.join(' ').trim(),
    priority,
    estMinutes,
    projectId,
    dueAt,
    tokens,
    unknownProject,
  };
}
