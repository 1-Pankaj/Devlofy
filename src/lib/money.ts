/**
 * Money — the arithmetic between tracked time and a bill.
 *
 * Devlofy never invents a rate and never rounds in its own favour: a block is
 * priced only when the project (or its client) has a rate the user typed, and the
 * invoice draft is a *view* over the session log rather than a stored document,
 * so it can never disagree with the time it describes.
 *
 * Everything here is pure so it can be reasoned about (and tested) without a
 * database or a screen.
 */
import type { BillableSession } from '@/lib/db/repo';

export type Period = 'month' | 'last30' | 'week' | 'all';

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'last30', label: '30 days' },
  { value: 'week', label: 'This week' },
  { value: 'all', label: 'All time' },
];

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local-time window for a period. `to` is exclusive and never in the past. */
export function periodRange(period: Period, now: Date = new Date()): { from: Date; to: Date } {
  const to = new Date(startOfDay(now).getTime() + DAY_MS);
  if (period === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
  }
  if (period === 'last30') {
    return { from: new Date(startOfDay(now).getTime() - 29 * DAY_MS), to };
  }
  if (period === 'week') {
    // Sunday-first, matching the heatmap's weeks.
    const from = new Date(startOfDay(now).getTime() - now.getDay() * DAY_MS);
    return { from, to };
  }
  return { from: new Date(0), to };
}

/**
 * Parse a typed rate. Returns null for anything that is not a positive number,
 * so an empty field clears the rate instead of silently becoming zero.
 *
 * Both conventions are accepted, because a typed `1,500` means fifteen hundred
 * and a typed `1.500,25` means fifteen hundred and a quarter. The rule is the
 * last separator wins as the decimal point; a single separator followed by
 * exactly three digits is grouping, except after a leading zero.
 */
export function parseRate(text: string): number | null {
  const raw = text.replace(/[^\d.,]/g, '');
  if (!raw) return null;

  const lastDot = raw.lastIndexOf('.');
  const lastComma = raw.lastIndexOf(',');
  let normalised: string;

  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const grouping = decimal === '.' ? ',' : '.';
    normalised = raw.split(grouping).join('');
    if (decimal === ',') normalised = normalised.replace(',', '.');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const separator = lastDot !== -1 ? '.' : ',';
    const parts = raw.split(separator);
    const isGrouping =
      parts.length > 2 ||
      (parts.length === 2 && parts[1].length === 3 && parts[0].length > 0 && parts[0] !== '0');
    normalised = parts.join(isGrouping ? '' : '.');
  } else {
    normalised = raw;
  }

  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/** Money is shown to the cent; the symbol is the user's, not ours. */
export function formatMoney(amount: number, symbol: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const [whole, cents] = rounded.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${grouped}.${cents}`;
}

/** Billable time reads in decimal hours — that is what an invoice needs. */
export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(2)}h`;
}

export function sessionAmount(session: BillableSession): number {
  if (session.rate === null) return 0;
  return (session.minutes / 60) * session.rate;
}

export type InvoiceLine = {
  /** Project id, or `unassigned` for blocks with no project. */
  key: string;
  project: string;
  client: string | null;
  rate: number | null;
  minutes: number;
  amount: number;
  sessions: number;
};

/**
 * Only included blocks are billed: attributed to a rated project *and* flagged
 * billable. Grouping by project is what a client actually asks for.
 */
export function invoiceLines(sessions: BillableSession[]): InvoiceLine[] {
  const lines = new Map<string, InvoiceLine>();

  for (const session of sessions) {
    if (session.rate === null || session.billable !== 1) continue;
    const key = session.project_id ?? 'unassigned';
    const line = lines.get(key) ?? {
      key,
      project: session.project_name ?? 'Unassigned',
      client: session.client_name,
      rate: session.rate,
      minutes: 0,
      amount: 0,
      sessions: 0,
    };
    line.minutes += session.minutes;
    line.amount += sessionAmount(session);
    line.sessions += 1;
    lines.set(key, line);
  }

  return [...lines.values()].sort((a, b) => b.amount - a.amount);
}

export type InvoiceTotals = {
  minutes: number;
  amount: number;
  sessions: number;
  /** Rated blocks the user has taken off the bill. */
  excludedMinutes: number;
  /** Blocks with no rate at all — the app cannot price these. */
  unratedMinutes: number;
};

export function invoiceTotals(sessions: BillableSession[]): InvoiceTotals {
  const totals: InvoiceTotals = {
    minutes: 0,
    amount: 0,
    sessions: 0,
    excludedMinutes: 0,
    unratedMinutes: 0,
  };
  for (const session of sessions) {
    if (session.rate === null) {
      totals.unratedMinutes += session.minutes;
    } else if (session.billable === 1) {
      totals.minutes += session.minutes;
      totals.amount += sessionAmount(session);
      totals.sessions += 1;
    } else {
      totals.excludedMinutes += session.minutes;
    }
  }
  return totals;
}

/** The draft as plain text — what actually gets pasted into an email. */
export function invoiceText(
  lines: InvoiceLine[],
  totals: InvoiceTotals,
  options: { symbol: string; periodLabel: string; client?: string | null },
): string {
  const heading = options.client ? `Invoice draft — ${options.client}` : 'Invoice draft';
  const body = lines.map(
    (line) =>
      `${line.project}${line.client && !options.client ? ` (${line.client})` : ''} — ${formatHours(
        line.minutes,
      )} @ ${formatMoney(line.rate ?? 0, options.symbol)}/h = ${formatMoney(line.amount, options.symbol)}`,
  );
  return [
    heading,
    options.periodLabel,
    '',
    ...body,
    '',
    `Total: ${formatHours(totals.minutes)} · ${formatMoney(totals.amount, options.symbol)}`,
  ].join('\n');
}
