/**
 * Time: epoch ↔ everything, and cron in plain words.
 *
 * A timestamp tool is only useful if it is unambiguous, so `describeMoment`
 * returns *all* the readings at once — seconds, milliseconds, ISO, UTC, local,
 * and how far away it is — and never guesses one silently. The unit for a bare
 * number is inferred by magnitude (below 10¹¹ it is seconds, because 10¹¹
 * seconds is the year 5138 and 10¹¹ milliseconds is 1973), and the reading says
 * which one it used so a wrong guess is visible rather than mysterious.
 *
 * Cron is a real parser: ranges, steps, lists, month and day names, `7` for
 * Sunday, and the five `@macros`, with Vixie's day-of-month/day-of-week rule
 * (when both are restricted, a day matching *either* runs). The next-run list is
 * computed by walking days and then the allowed hours and minutes within them,
 * which is bounded work rather than a per-minute scan.
 */

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type MomentSource = 'seconds' | 'milliseconds' | 'date string';

export type Moment = {
  ms: number;
  source: MomentSource;
};

export function parseMoment(input: string): Moment | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return null;
    // A negative epoch is a date before 1970 and a perfectly good timestamp.
    const magnitude = Math.abs(value);
    if (magnitude >= 1e11) return { ms: value, source: 'milliseconds' };
    return { ms: Math.round(value * 1000), source: 'seconds' };
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return { ms: parsed, source: 'date string' };
}

export type MomentReading = {
  seconds: number;
  milliseconds: number;
  iso: string;
  utc: string;
  local: string;
  weekday: string;
  relative: string;
};

export function describeMoment(ms: number, now = Date.now()): MomentReading {
  const date = new Date(ms);
  return {
    seconds: Math.floor(ms / 1000),
    milliseconds: ms,
    iso: date.toISOString(),
    // `toUTCString` is stable across runtimes; the ISO string above is the
    // machine-truth one and this is the human one.
    utc: date.toUTCString(),
    local: date.toLocaleString(),
    weekday: FULL_DAYS[date.getDay()],
    relative: relativeTime(ms, now),
  };
}

export function relativeTime(ms: number, now = Date.now()): string {
  const delta = ms - now;
  const future = delta > 0;
  const seconds = Math.abs(delta) / 1000;

  const units: [number, string][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [86400 * 30, 'day'],
    [86400 * 365, 'month'],
    [Infinity, 'year'],
  ];

  let previous = 1;
  for (const [limit, name] of units) {
    if (seconds < limit) {
      const value = Math.max(1, Math.round(seconds / previous));
      const plural = value === 1 ? '' : 's';
      return future ? `in ${value} ${name}${plural}` : `${value} ${name}${plural} ago`;
    }
    previous = limit;
  }
  return 'now';
}

// ─────────────────────────────── Cron ───────────────────────────────

type FieldSpec = { min: number; max: number; names?: string[]; label: string };

const CRON_FIELDS: FieldSpec[] = [
  { min: 0, max: 59, label: 'minute' },
  { min: 0, max: 23, label: 'hour' },
  { min: 1, max: 31, label: 'day of month' },
  { min: 1, max: 12, names: MONTH_NAMES, label: 'month' },
  { min: 0, max: 7, names: DAY_NAMES, label: 'day of week' },
];

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export type CronSchedule = {
  expression: string;
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
  description: string[];
  next: Date[];
};

export type CronResult = { ok: true; value: CronSchedule } | { ok: false; message: string };

function errorMessage(raw: string, spec: FieldSpec): string {
  return `"${raw}" is not a valid ${spec.label} (expected ${spec.min}–${spec.max}${
    spec.names ? `, or ${spec.names[0]}–${spec.names[spec.names.length - 1]}` : ''
  }, with * , - and / allowed).`;
}

function resolveName(raw: string, spec: FieldSpec): number | null {
  if (!spec.names) return null;
  const index = spec.names.indexOf(raw.toLowerCase());
  return index === -1 ? null : index + (spec.min === 1 ? 1 : 0);
}

function expandField(raw: string, spec: FieldSpec): number[] | string {
  const values = new Set<number>();

  for (const part of raw.split(',')) {
    const piece = part.trim();
    if (!piece) return errorMessage(raw, spec);

    const [rangePart, stepPart] = piece.split('/');
    if (piece.split('/').length > 2) return errorMessage(raw, spec);

    let step = 1;
    if (stepPart !== undefined) {
      step = Number(stepPart);
      if (!Number.isInteger(step) || step < 1) return errorMessage(raw, spec);
    }

    let from: number;
    let to: number;

    if (rangePart === '*') {
      from = spec.min;
      to = spec.max;
    } else {
      const [startRaw, endRaw, ...rest] = rangePart.split('-');
      if (rest.length > 0) return errorMessage(raw, spec);

      const start = /^\d+$/.test(startRaw) ? Number(startRaw) : resolveName(startRaw, spec);
      if (start === null || start < spec.min || start > spec.max) return errorMessage(raw, spec);
      from = start;

      if (endRaw === undefined) {
        to = stepPart === undefined ? start : spec.max;
      } else {
        const end = /^\d+$/.test(endRaw) ? Number(endRaw) : resolveName(endRaw, spec);
        if (end === null || end < spec.min || end > spec.max) return errorMessage(raw, spec);
        to = end;
      }
      if (to < from) return errorMessage(raw, spec);
    }

    for (let value = from; value <= to; value += step) values.add(value);
  }

  // 7 and 0 are both Sunday.
  if (spec.label === 'day of week') {
    if (values.has(7)) {
      values.delete(7);
      values.add(0);
    }
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : errorMessage(raw, spec);
}

function isRestricted(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed !== '*' && !trimmed.startsWith('*');
}

function describeField(raw: string, spec: FieldSpec, values: number[]): string | null {
  const named = (value: number) => {
    if (spec.label === 'month') return FULL_MONTHS[value - 1];
    if (spec.label === 'day of week') return FULL_DAYS[value];
    return String(value);
  };

  if (raw.trim() === '*') return null;

  if (values.length === 1) {
    if (spec.label === 'day of month') return `on day ${values[0]} of the month`;
    if (spec.label === 'month') return `in ${named(values[0])}`;
    if (spec.label === 'day of week') return `on ${named(values[0])}`;
    return null; // minute and hour are described as a clock time
  }

  const list = values.map(named);
  const joined =
    list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;

  if (spec.label === 'day of month') return `on days ${joined} of the month`;
  if (spec.label === 'month') return `in ${joined}`;
  if (spec.label === 'day of week') return `on ${joined}`;
  return null;
}

function describeClock(minuteRaw: string, hourRaw: string, minutes: number[], hours: number[]): string {
  if (minuteRaw.trim() === '*' && hourRaw.trim() === '*') return 'Every minute';
  if (minuteRaw.trim() === '*' && hours.length === 1) {
    return `Every minute of hour ${String(hours[0]).padStart(2, '0')}`;
  }
  if (hours.length === 1 && minutes.length === 1) {
    return `At ${String(hours[0]).padStart(2, '0')}:${String(minutes[0]).padStart(2, '0')}`;
  }
  if (minuteRaw.trim() === '*' || hours.length > 1) {
    const minutePart =
      minutes.length === 1
        ? `at minute ${minutes[0]}`
        : minuteRaw.includes('/')
          ? `every ${minuteRaw.split('/')[1]} minutes`
          : `at minutes ${minutes.join(', ')}`;
    const hourPart =
      hourRaw.trim() === '*'
        ? 'of every hour'
        : `during ${hours.length === 1 ? `hour ${hours[0]}` : `hours ${hours.join(', ')}`}`;
    return `${minutePart} ${hourPart}`.replace(/^at/, 'At').replace(/^every/, 'Every');
  }
  return `At minutes ${minutes.join(', ')} and hours ${hours.join(', ')}`;
}

export function nextRuns(schedule: Omit<CronSchedule, 'next' | 'description' | 'expression'>, from: Date, count: number): Date[] {
  const runs: Date[] = [];
  const anyDayOfMonth = schedule.dayOfMonth.length === 31 && schedule.dayOfMonth[0] === 1;
  const anyDayOfWeek = schedule.dayOfWeek.length === 7;
  const domRestricted = !anyDayOfMonth;
  const dowRestricted = !anyDayOfWeek;

  const start = new Date(from.getTime());
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const MAX_DAYS = 366 * 5;

  for (let dayOffset = 0; dayOffset <= MAX_DAYS && runs.length < count; dayOffset += 1) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayOffset);
    if (!schedule.month.includes(day.getMonth() + 1)) continue;

    const domMatch = schedule.dayOfMonth.includes(day.getDate());
    const dowMatch = schedule.dayOfWeek.includes(day.getDay());
    const dayMatch =
      domRestricted && dowRestricted ? domMatch || dowMatch : domRestricted ? domMatch : dowRestricted ? dowMatch : true;
    if (!dayMatch) continue;

    for (const hour of schedule.hour) {
      for (const minute of schedule.minute) {
        const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
        if (candidate.getTime() < start.getTime()) continue;
        runs.push(candidate);
        if (runs.length >= count) break;
      }
      if (runs.length >= count) break;
    }
  }

  return runs;
}

export function parseCron(input: string, from = new Date(), count = 5): CronResult {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, message: 'Nothing to read yet.' };

  let expression = trimmed;
  const macro = MACROS[trimmed.toLowerCase()];
  if (macro) expression = macro;

  const parts = expression.split(' ');
  if (parts.length !== 5) {
    return {
      ok: false,
      message: `Cron has five fields — minute, hour, day of month, month, day of week. This one has ${parts.length}.`,
    };
  }

  const parsed: number[][] = [];
  for (let index = 0; index < 5; index += 1) {
    const field = expandField(parts[index], CRON_FIELDS[index]);
    if (typeof field === 'string') return { ok: false, message: field };
    parsed.push(field);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed;
  const x = isRestricted(parts[2]);
  const y = isRestricted(parts[4]);

  const description = [describeClock(parts[0], parts[1], minute, hour)];

  const domPhrase = describeField(parts[2], CRON_FIELDS[2], dayOfMonth);
  const dowPhrase = describeField(parts[4], CRON_FIELDS[4], dayOfWeek);
  const monthPhrase = describeField(parts[3], CRON_FIELDS[3], month);

  if (domPhrase && dowPhrase) {
    description.push(`${domPhrase}, or ${dowPhrase.replace(/^on /, 'on ')}`);
  } else if (domPhrase || dowPhrase) {
    description.push(domPhrase ?? dowPhrase ?? '');
  }

  if (monthPhrase) description.push(monthPhrase);
  if (x && y) description.push('(when both are set, a day matching either one runs — cron\'s own rule.)');

  const base = { minute, hour, dayOfMonth, month, dayOfWeek };
  return {
    ok: true,
    value: {
      expression,
      ...base,
      description: description.filter(Boolean),
      next: nextRuns(base, from, count),
    },
  };
}
