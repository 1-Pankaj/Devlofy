import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

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
