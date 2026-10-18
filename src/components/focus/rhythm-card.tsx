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

export function RhythmCard({ rhythm, insights }: { rhythm: Rhythm; insights: string[] }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...rhythm.byHour);

  return (
    <Panel style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xxs }}>
        <Eyebrow>Rhythm</Eyebrow>
        <AppText variant="headline">
          {rhythm.peak && rhythm.calibrated ? 'When you actually work' : 'Learning your hours'}
        </AppText>
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
                style={{
                  flex: 1,
                  height,
                  borderRadius: 2,
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
                <AppText variant="caption" tone="tertiary" style={{ fontSize: 10 }}>
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
                  width: 3,
                  borderRadius: radius.full,
                  backgroundColor: colors.accentBorder,
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
