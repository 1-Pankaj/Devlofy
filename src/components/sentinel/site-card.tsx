/**
 * SiteCard — one target on the board.
 *
 * The card answers four questions in reading order, and nothing else: *is it up*
 * (the pill), *how fast* (the figure), *what is it* (the name and host), *how has
 * it been* (the bars and the 24-hour line).
 *
 * Two honesty rules are built into the markup:
 *
 *  - The measured time is always shown next to the verdict. A board that only
 *    checks when you open it must never let a number look live — so there is no
 *    pulsing dot here either, because nothing is pulsing.
 *  - Uptime says how many checks it is over ("12 checks"). "99.4%" on its own
 *    would read like wall-clock coverage, which this app does not have.
 */
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { StatusPill, type StatusTone } from '@/components/ui/pill';
import { LatencyChart } from '@/components/sentinel/latency-chart';
import { formatAgo, formatMs, formatPercent, minutesSince, verdictLabel } from '@/lib/sentinel/status';
import type { SiteBoardRow } from '@/lib/sentinel/use-sentinel';
import { radius, spacing, useTheme } from '@/theme';

const VERDICT_TONE: Record<string, StatusTone> = {
  up: 'accent',
  slow: 'ember',
  down: 'danger',
};

export type SiteCardProps = {
  row: SiteBoardRow;
  /** The caller's clock, passed in so this component stays a function of its props. */
  now: number;
  onPress: () => void;
};

export function SiteCard({ row, now, onPress }: SiteCardProps) {
  const { colors } = useTheme();
  const { site, latest, verdict, day, spark, lastIncident } = row;
  const paused = site.enabled !== 1;

  const label = paused
    ? 'paused'
    : verdict
      ? verdictLabel(verdict, latest?.source ?? 'native')
      : 'never checked';
  const tone: StatusTone = paused || !verdict ? 'neutral' : VERDICT_TONE[verdict];

  // The left slot is always the reliability summary and the right slot is always
  // the timestamp, so the two never say the same thing twice.
  const summary = !latest
    ? 'Not checked yet'
    : paused
      ? 'Paused · skipped by Check all'
      : day.total === 0
        ? 'No checks in 24h'
        : `24h · ${formatPercent(day.ratio)} up · ${day.total} ${day.total === 1 ? 'check' : 'checks'}`;

  return (
    <PressableScale onPress={onPress} haptic="selection">
      <Panel pad="lg" style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <StatusPill label={label} tone={tone} />
          <AppText variant="mono" tone={verdict === 'slow' ? 'ember' : 'secondary'}>
            {formatMs(latest?.ms ?? null)}
          </AppText>
        </View>

        <View style={{ gap: 2 }}>
          <AppText variant="headline" numberOfLines={1}>
            {site.name}
          </AppText>
          <AppText variant="caption" tone="tertiary" numberOfLines={1}>
            {site.url}
          </AppText>
        </View>

        <LatencyChart checks={spark} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <AppText variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {summary}
          </AppText>
          {lastIncident?.ongoing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{ width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.danger }} />
              <AppText variant="captionMedium" tone="danger">
                {lastIncident.failures} in a row
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" tone="tertiary">
              {formatAgo(minutesSince(latest?.checked_at ?? null, now))}
            </AppText>
          )}
        </View>
      </Panel>
    </PressableScale>
  );
}
