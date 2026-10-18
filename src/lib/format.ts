import { differenceInCalendarDays, format, isToday, isTomorrow, isYesterday } from 'date-fns';

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Eyebrow label for the Today header, e.g. "SAT · OCT 17". */
export function dateEyebrow(date = new Date()): string {
  return format(date, 'EEE · MMM d').toUpperCase();
}

/** "42m", "1h 24m", "3h". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export function formatClock(startedAtIso: string): string {
  return format(new Date(startedAtIso), 'HH:mm');
}

/** "Today · 09:41", "Yesterday · 14:02", "Mon · 08:15" — session rows. */
export function formatSessionWhen(startedAtIso: string): string {
  const date = new Date(startedAtIso);
  const time = format(date, 'HH:mm');
  if (isToday(date)) return `Today · ${time}`;
  if (isYesterday(date)) return `Yesterday · ${time}`;
  return `${format(date, 'EEE')} · ${time}`;
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return 'No date';
  return format(new Date(iso), 'MMM d');
}

/**
 * Due-date label for a task row — relative while it still means something,
 * absolute once it doesn't: "2d overdue" / "today" / "tomorrow" / "in 4d" / "Oct 24".
 */
export function formatDueLabel(iso: string): { label: string; overdue: boolean } {
  const date = new Date(iso);
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return { label: `${-days}d overdue`, overdue: true };
  if (days === 0) return { label: 'today', overdue: false };
  if (days === 1) return { label: 'tomorrow', overdue: false };
  if (days < 7) return { label: `in ${days}d`, overdue: false };
  return { label: format(date, 'MMM d'), overdue: false };
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** "07:42" or "1:03:11" — running timers. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
