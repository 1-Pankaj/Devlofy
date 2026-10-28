/**
 * RhythmCard — what the session log says about *when* you work.
 *
 * Twenty-four columns, one per hour of the day, drawn from finished blocks only.
 * The learned peak band is tinted, so the chart answers the question it raises.
 * The insights underneath are the Engine's sentences, and they stay quiet until
 * there is enough history to be worth reading — an app that invents a pattern
 * from two blocks is worse than one that says nothing.
 */
import { View } from 'react-native';

import type { Rhythm } from '@/lib/engine';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { radius, spacing, useTheme } from '@/theme';

const LABELLED_HOURS = [0, 6, 12, 18];
/** Every bar keeps a visible stub, so empty hours still read as "nothing yet". */
const MIN_BAR_HEIGHT = 3;
const MAX_BAR_HEIGHT = 56;

function isInBand(rhythm: Rhythm, hour: number): boolean {
  if (!rhythm.peak) return false;
  const { startHour, endHour } = rhythm.peak;
  return startHour + 3 <= 24 ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function RhythmCard({ rhythm, insights }: { rhythm: Rhythm; insights: string[] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rhythm.byHour);
  const calibrated = rhythm.peak && rhythm.calibrated;

  return (
    <Panel style={{ gap: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}>
        <View style={{ gap: spacing.xxs, flex: 1 }}>
          <Eyebrow>rhythm</Eyebrow>
          <AppText variant="headline">{calibrated ? 'When you actually work' : 'Learning your hours'}</AppText>
        </View>
        {calibrated && rhythm.peak ? (
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <AppText variant="code" tone="accent">
              {hourLabel(rhythm.peak.startHour)}–{hourLabel(rhythm.peak.endHour)}
            </AppText>
            <AppText variant="monoLabel" tone="tertiary" style={{ fontSize: 9 }}>
              peak band
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: MAX_BAR_HEIGHT }}>
          {rhythm.byHour.map((minutes, hour) => {
            const height =
              minutes === 0
                ? MIN_BAR_HEIGHT
                : Math.max(MIN_BAR_HEIGHT + 4, Math.round((minutes / max) * MAX_BAR_HEIGHT));
            const peak = isInBand(rhythm, hour);
            return (
              <View
                key={hour}
                accessibilityLabel={`${hourLabel(hour)}: ${minutes} minutes`}
                style={{
                  flex: 1,
                  height,
                  borderRadius: radius.xs,
                  backgroundColor:
                    minutes === 0
                      ? colors.surfaceSunken
                      : peak
                        ? colors.accent
                        : colors.accentBorder,
                }}
              />
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {rhythm.byHour.map((_, hour) => (
            <View key={hour} style={{ flex: 1, alignItems: 'center' }}>
              {LABELLED_HOURS.includes(hour) ? (
                <AppText variant="code" tone="tertiary" style={{ fontSize: 9 }}>
                  {String(hour).padStart(2, '0')}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {insights.length > 0 ? (
        <View
          style={{
            gap: spacing.sm,
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
          }}>
          {insights.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View
                style={{
                  width: 2,
                  borderRadius: 1,
                  backgroundColor: colors.accent,
                }}
              />
              <AppText variant="subhead" tone="secondary" style={{ flex: 1 }}>
                {line}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}
