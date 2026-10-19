/**
 * SentinelStrip — the board's answer, on the screen you actually open first.
 *
 * Sentinel is the only feature here whose *point* is to tell you something you
 * did not ask for, so burying it behind More means it can only ever warn people
 * who already went looking. The strip puts the standing where the day starts.
 *
 * Three rules it follows, all inherited:
 *
 *  - It says nothing when there is nothing to say: no targets, no strip. An
 *    empty monitor does not get to occupy the home screen.
 *  - It never overclaims. The sentence comes from `standingLine()`, so a
 *    browser-only board says **unreachable**, not "down" ([[07-decisions]] ADR-023).
 *  - It states when the answer was measured — "checked 4m ago" — because this
 *    hook deliberately does not run checks (see `useSentinelStanding`).
 *
 * The clock lives here: the label ages on a 30s tick rather than calling
 * `Date.now()` during render, and the tick dies with the screen.
 */
import { Pulse } from 'phosphor-react-native';
import { useEffect, useState } from 'react';

import { FeatureCard } from '@/components/ui/feature-card';
import {
  formatAgo,
  minutesSince,
  standingLine,
} from '@/lib/sentinel/status';
import { useSentinelStanding } from '@/lib/sentinel/use-sentinel';

/** Slow enough to be invisible, fast enough that "4m ago" is never a lie. */
const TICK_MS = 30_000;

export function SentinelStrip({ onPress }: { onPress: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const { status, standing } = useSentinelStanding();
  // A load or a failed read hides the strip rather than inventing a state: Today
  // is a dashboard of independent cards, and this one is a summary of a feature
  // the user can open — not a screen whose empty state has to be honest alone.
  if (status !== 'ready' || !standing || standing.sites === 0) return null;

  const line = standingLine(standing);
  if (!line) return null;

  const promise =
    standing.lastCheckedAt === null
      ? 'Never checked — open the board to check now'
      : `Checked ${formatAgo(minutesSince(standing.lastCheckedAt, now))}`;

  return (
    <FeatureCard
      icon={Pulse}
      title="Sentinel"
      promise={promise}
      stat={line.text}
      tone={line.tone}
      onPress={onPress}
      accessibilityLabel={`Sentinel, ${line.text}, ${promise}`}
    />
  );
}
