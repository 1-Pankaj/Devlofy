/**
 * FocusHeatmap — the last twelve weeks as a grid of days.
 *
 * The seven-day chart answers "this week". This answers "am I actually
 * consistent?", which is the question a streak can't: it shows the gaps as
 * clearly as the runs. Tone carries the intensity — four steps, no legend
 * guessing.
 */
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import type { DayFocus } from '@/lib/db/repo';
import { formatMinutes } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Minutes per day → one of four tones. */
function level(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 75) return 2;
  return 3;
}

function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function monthOf(day: string): number {
  return Number(day.split('-')[1]) - 1;
}

export function FocusHeatmap({ data }: { data: DayFocus[] }) {
  const { colors } = useTheme();

  const scale = [colors.surfaceElevated, colors.accentSoft, colors.accentBorder, colors.accent];

  const { columns, total, activeDays, best } = useMemo(() => {
    const empty = { columns: [] as (DayFocus | null)[][], total: 0, activeDays: 0, best: null };
    if (data.length === 0) return empty;

    // Columns are real weeks (Sunday → Saturday): pad both ends so the weekday a
    // cell sits on is the same in every column, which is what makes the grid
    // readable as a rhythm rather than a list.
    const leading = weekdayOf(data[0].day);
    const trailing = 6 - weekdayOf(data[data.length - 1].day);

    const cells: (DayFocus | null)[] = [
      ...Array.from({ length: leading }, () => null),
      ...data,
      ...Array.from({ length: trailing }, () => null),
    ];

    const grouped: (DayFocus | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) grouped.push(cells.slice(i, i + 7));

    const real = data.filter((day) => day.minutes > 0);
    return {
      columns: grouped,
      total: data.reduce((sum, day) => sum + day.minutes, 0),
      activeDays: real.length,
      best: real.reduce<DayFocus | null>(
        (top, day) => (top === null || day.minutes > top.minutes ? day : top),
        null,
      ),
    };
  }, [data]);

  if (columns.length === 0) return null;

  const firstOf = (column: (DayFocus | null)[]) =>
    column.find((cell): cell is DayFocus => cell !== null);

  return (
    <Panel>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
        <View style={{ gap: spacing.xxs }}>
          <Eyebrow>Rhythm</Eyebrow>
          <AppText variant="headline">Last 12 weeks</AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.xxs }}>
          <AppText variant="subheadMedium">{formatMinutes(total)}</AppText>
          <AppText variant="caption" tone="tertiary">
            {activeDays} {activeDays === 1 ? 'day' : 'days'} focused
          </AppText>
        </View>
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
        {/* Month rail — a label wherever the column's month changes. */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {columns.map((column, index) => {
            const current = firstOf(column);
            const previous = index > 0 ? firstOf(columns[index - 1]) : undefined;
            const label =
              current && (!previous || monthOf(previous.day) !== monthOf(current.day))
                ? SHORT_MONTH[monthOf(current.day)]
                : null;
            return (
              <View key={index} style={{ flex: 1 }}>
                {label ? (
                  <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                    {label}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={{ flex: 1, gap: spacing.xs }}>
              {column.map((cell, rowIndex) => (
                <View
                  key={rowIndex}
                  accessibilityLabel={
                    cell
                      ? `${cell.day}: ${cell.minutes > 0 ? formatMinutes(cell.minutes) : 'no focus'}`
                      : 'no day'
                  }
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: radius.xs,
                    backgroundColor: cell ? scale[level(cell.minutes)] : 'transparent',
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.lg,
          paddingTop: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="caption" tone="tertiary">
            less
          </AppText>
          {scale.map((color, index) => (
            <View
              key={index}
              style={{
                width: 11,
                height: 11,
                borderRadius: radius.xs,
                backgroundColor: color,
              }}
            />
          ))}
          <AppText variant="caption" tone="tertiary">
            more
          </AppText>
        </View>
        {best ? (
          <AppText variant="caption" tone="tertiary">
            best {formatMinutes(best.minutes)}
          </AppText>
        ) : null}
      </View>
    </Panel>
  );
}
