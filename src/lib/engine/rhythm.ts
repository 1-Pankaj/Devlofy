/**
 * Rhythm — what the user's *own* session log says about when they work.
 *
 * Nothing here is a configured preference. Everything is measured from finished
 * blocks, which is the whole point: the app can be specific ("your best hours are
 * 09:00–12:00") without asking the user to fill in a profile, and without a
 * server. Pure: takes plain rows, returns plain numbers.
 */

export type SessionLike = {
  started_at: string;
  minutes: number | null;
};

export type Rhythm = {
  /** Finished blocks in the window. */
  sessions: number;
  totalMinutes: number;
  /** Focus minutes per local hour of day, index 0–23. */
  byHour: number[];
  /** Focus minutes per weekday, index 0 = Sunday. */
  byWeekday: number[];
  /**
   * The contiguous `PEAK_BAND_HOURS`-wide band of the day that holds the most
   * focus, with its share of all minutes. Null until there is enough history.
   */
  peak: { startHour: number; endHour: number; minutes: number; share: number } | null;
  /**
   * The user's typical block length (median). Used to judge whether an estimate
   * "fits one block" — again measured, not assumed.
   */
  medianBlockMinutes: number | null;
  /** True once there is enough data for the insights to mean anything. */
  calibrated: boolean;
};

const PEAK_BAND_HOURS = 3;
/** Below this, statistics are noise and the UI should say so. */
const MIN_SESSIONS_FOR_INSIGHTS = 6;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function buildRhythm(sessions: SessionLike[]): Rhythm {
  const byHour = Array.from({ length: 24 }, () => 0);
  const byWeekday = Array.from({ length: 7 }, () => 0);
  const durations: number[] = [];
  let totalMinutes = 0;

  for (const session of sessions) {
    const minutes = session.minutes ?? 0;
    if (minutes <= 0) continue;
    const started = new Date(session.started_at);
    if (Number.isNaN(started.getTime())) continue;

    byHour[started.getHours()] += minutes;
    byWeekday[started.getDay()] += minutes;
    durations.push(minutes);
    totalMinutes += minutes;
  }

  const counted = durations.length;
  const calibrated = counted >= MIN_SESSIONS_FOR_INSIGHTS;

  let peak: Rhythm['peak'] = null;
  if (totalMinutes > 0) {
    let bestStart = 0;
    let bestSum = -1;
    for (let start = 0; start < 24; start += 1) {
      let sum = 0;
      for (let offset = 0; offset < PEAK_BAND_HOURS; offset += 1) {
        sum += byHour[(start + offset) % 24];
      }
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = start;
      }
    }
    peak = {
      startHour: bestStart,
      endHour: (bestStart + PEAK_BAND_HOURS) % 24,
      minutes: bestSum,
      share: bestSum / totalMinutes,
    };
  }

  return {
    sessions: counted,
    totalMinutes,
    byHour,
    byWeekday,
    peak,
    medianBlockMinutes: median(durations),
    calibrated,
  };
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** True when `date` falls inside the learned peak band (handles wrap-around). */
export function inPeakBand(rhythm: Rhythm, date: Date): boolean {
  if (!rhythm.peak) return false;
  const { startHour, endHour } = rhythm.peak;
  const hour = date.getHours();
  return startHour + PEAK_BAND_HOURS <= 24
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * Sentences for the UI. Deliberately few and honest: when the sample is too
 * small it says so instead of inventing a pattern.
 */
export function rhythmInsights(rhythm: Rhythm): string[] {
  if (rhythm.sessions === 0) {
    return ['No finished blocks yet. Run a few and this becomes your own report.'];
  }
  if (!rhythm.calibrated) {
    return [
      `${rhythm.sessions} block${rhythm.sessions === 1 ? '' : 's'} logged so far — the pattern firms up after about six.`,
    ];
  }

  const insights: string[] = [];

  if (rhythm.peak && rhythm.peak.share >= 0.3) {
    insights.push(
      `Your strongest stretch is ${formatHour(rhythm.peak.startHour)}–${formatHour(rhythm.peak.endHour)} — ${Math.round(
        rhythm.peak.share * 100,
      )}% of all focus lands in it.`,
    );
  }

  const bestDay = rhythm.byWeekday.reduce(
    (top, minutes, index) => (minutes > top.minutes ? { minutes, index } : top),
    { minutes: 0, index: -1 },
  );
  const weekdayTotal = rhythm.byWeekday.reduce((sum, minutes) => sum + minutes, 0);
  if (bestDay.index >= 0 && weekdayTotal > 0 && bestDay.minutes / weekdayTotal >= 0.25) {
    insights.push(`${WEEKDAY_NAMES[bestDay.index]} carry the most focus of your week.`);
  }

  if (rhythm.medianBlockMinutes) {
    insights.push(`A typical block of yours runs ${rhythm.medianBlockMinutes}m.`);
  }

  return insights;
}
