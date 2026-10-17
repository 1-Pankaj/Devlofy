/**
 * Focus Garden — the 3D home of focused time. The tree grows with real data;
 * sessions feed it, and the streak keeps it green.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Play, Stop, Timer } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { GardenScene } from '@/components/garden/garden-scene';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { ListRow } from '@/components/ui/list-row';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  endFocusSession,
  getActiveSession,
  getDataStats,
  getFocusStreakDays,
  listRecentSessions,
  startFocusSession,
  todayFocusMinutes,
  totalFocusMinutes,
} from '@/lib/db/repo';
import { bucketGrowth, growthFromStats } from '@/lib/garden/model';
import { formatClock, formatDayLabel, formatMinutes } from '@/lib/format';
import { spacing, useTheme } from '@/theme';

function stageName(growth: number): string {
  if (growth < 0.15) return 'Seedling';
  if (growth < 0.35) return 'Sprout';
  if (growth < 0.6) return 'Sapling';
  if (growth < 0.85) return 'Young tree';
  return 'Canopy';
}

export default function GardenScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [sceneMounted, setSceneMounted] = useState(true);

  // Free the GL context when the tab is not visible.
  useFocusEffect(
    useCallback(() => {
      setSceneMounted(true);
      return () => setSceneMounted(false);
    }, []),
  );

  const stats = useLiveQuery(async (d) => {
    const [total, streak, dataStats, todayMinutes] = await Promise.all([
      totalFocusMinutes(d),
      getFocusStreakDays(d),
      getDataStats(d),
      todayFocusMinutes(d),
    ]);
    const growth = growthFromStats({
      totalMinutes: total,
      streakDays: streak,
      todayMinutes,
    });
    return { total, streak, sessions: dataStats.sessions, growth };
  });

  const session = useLiveQuery((d) => getActiveSession(d));
  const recent = useLiveQuery((d) => listRecentSessions(d, 6));

  const growth = stats.data?.growth ?? 0;
  const bucketed = bucketGrowth(growth);

  const refreshAll = () => {
    stats.refresh();
    session.refresh();
    recent.refresh();
  };

  const handleStart = async () => {
    await startFocusSession(db);
    refreshAll();
  };

  const handleEnd = async () => {
    if (!session.data) return;
    await endFocusSession(db, session.data.id);
    if (process.env.EXPO_OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    refreshAll();
  };

  return (
    <Screen
      header={{
        eyebrow: 'focus garden',
        title: stageName(growth),
        subtitle: `${formatMinutes(stats.data?.total ?? 0)} of focused growth · ${stats.data?.streak ?? 0} day streak`,
      }}>
      <FadeUp index={0}>
        <Panel glow coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ height: 380 }}>
            {sceneMounted ? (
              <GardenScene seed={101} growth={Math.max(0.06, bucketed)} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Eyebrow>garden resting</Eyebrow>
              </View>
            )}
          </View>
        </Panel>
      </FadeUp>

      <FadeUp index={1}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <AppButton
            label={session.data ? 'End session' : 'Focus 25m'}
            icon={session.data ? Stop : Play}
            variant={session.data ? 'soft' : 'primary'}
            onPress={session.data ? handleEnd : handleStart}
          />
          <Panel pad="sm" rounding="lg" style={{ justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm }}>
              <AppText variant="mono" tone="accent">
                {Math.round(growth * 100)}%
              </AppText>
              <AppText variant="caption" tone="secondary">
                grown
              </AppText>
            </View>
          </Panel>
        </View>
      </FadeUp>

      <FadeUp index={2}>
        <Panel pad="lg">
          <View style={{ flexDirection: 'row' }}>
            {[
              { value: formatMinutes(stats.data?.total ?? 0), label: 'all time' },
              { value: `${stats.data?.streak ?? 0}d`, label: 'streak' },
              { value: String(stats.data?.sessions ?? 0), label: 'sessions' },
            ].map((stat, index) => (
              <View key={stat.label} style={{ flex: 1, flexDirection: 'row' }}>
                {index > 0 ? (
                  <View style={{ width: 1, backgroundColor: colors.hairline, marginVertical: 4 }} />
                ) : null}
                <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <AppText variant="numberLg">{stat.value}</AppText>
                  <Eyebrow>{stat.label}</Eyebrow>
                </View>
              </View>
            ))}
          </View>
        </Panel>
      </FadeUp>

      <FadeUp index={3}>
        <View>
          <SectionHeader eyebrow="history" title="Recent sessions" />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {recent.data && recent.data.length > 0 ? (
              recent.data.map((row, index) => (
                <ListRow
                  key={row.id}
                  icon={<Timer size={17} color={colors.accent} weight="light" />}
                  title={`${formatMinutes(row.minutes ?? 0)} of focus`}
                  subtitle={`${formatDayLabel(row.started_at)} · ${formatClock(row.started_at)}`}
                  showSeparator={index < recent.data!.length - 1}
                />
              ))
            ) : (
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
                <AppText variant="subheadMedium">No sessions yet.</AppText>
                <AppText variant="caption" tone="secondary">
                  Your first focused block plants the tree.
                </AppText>
              </View>
            )}
          </Panel>
        </View>
      </FadeUp>
    </Screen>
  );
}
