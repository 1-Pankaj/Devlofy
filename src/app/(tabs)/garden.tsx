/**
 * Focus Garden — the 3D home of focused time.
 *
 * The tree's stage reads total focus, streak and today's minutes. Sessions
 * run here: pick a block length, start it, and the block closes itself out
 * when the timer reaches zero.
 */
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { Play, Stop, Timer } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { GardenScene } from '@/components/garden/garden-scene';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { LiveDot } from '@/components/ui/live-dot';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  endFocusSession,
  getActiveSession,
  getFocusStreakDays,
  listRecentSessions,
  startFocusSession,
  todayFocusMinutes,
  totalFocusMinutes,
} from '@/lib/db/repo';
import { hashString } from '@/lib/garden/model';
import { stageFromStats } from '@/lib/garden/models';
import { formatClock, formatDayLabel, formatMinutes, formatTimer } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

const BLOCKS = [25, 50, 90] as const;
type Block = (typeof BLOCKS)[number];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: spacing.xxs }}>
      <AppText variant="numberLg">{value}</AppText>
      <AppText variant="eyebrow" tone="tertiary">
        {label}
      </AppText>
    </View>
  );
}

export default function GardenScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();

  const session = useLiveQuery(getActiveSession);
  const totals = useLiveQuery(async (d) => ({
    total: await totalFocusMinutes(d),
    today: await todayFocusMinutes(d),
    streak: await getFocusStreakDays(d),
  }));
  const history = useLiveQuery((d) => listRecentSessions(d, 6));

  const [block, setBlock] = useState<Block>(25);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const autoEndingRef = useRef(false);

  const active = session.data ?? null;
  const startedAt = active?.started_at ?? null;

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(startedAt).getTime()) / 1000))
    : 0;
  const remainingSeconds = Math.max(0, block * 60 - elapsedSeconds);
  const progress = Math.min(1, elapsedSeconds / (block * 60));

  const seed = useMemo(() => hashString('devlofy-garden'), []);
  const stage = useMemo(
    () =>
      stageFromStats({
        totalMinutes: totals.data?.total ?? 0,
        streakDays: totals.data?.streak ?? 0,
        todayMinutes: totals.data?.today ?? 0,
      }),
    [totals.data],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([session.refresh(), totals.refresh(), history.refresh()]);
  }, [history, session, totals]);

  const handleStart = useCallback(async () => {
    if (starting || active) return;
    setStarting(true);
    try {
      await startFocusSession(db);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await refreshAll();
    } finally {
      setStarting(false);
    }
  }, [active, db, refreshAll, starting]);

  const handleEnd = useCallback(async () => {
    if (!active || ending) return;
    setEnding(true);
    try {
      await endFocusSession(db, active.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await refreshAll();
    } finally {
      setEnding(false);
    }
  }, [active, db, ending, refreshAll]);

  // The block closes itself out — end at zero, exactly once.
  useEffect(() => {
    if (!active || remainingSeconds > 0 || autoEndingRef.current) return;
    autoEndingRef.current = true;
    (async () => {
      try {
        await endFocusSession(db, active.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await refreshAll();
      } finally {
        autoEndingRef.current = false;
      }
    })();
  }, [active, db, refreshAll, remainingSeconds]);

  return (
    <Screen
      header={{
        eyebrow: 'focus',
        title: 'Garden',
        subtitle:
          totals.status === 'ready'
            ? `${stage.label} · ${formatMinutes(totals.data?.total ?? 0)} grown in total`
            : undefined,
      }}>
      {/* The tree and the session controls */}
      <FadeUp index={0}>
        <Panel glow coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ height: 320 }}>
            <GardenScene
              seed={seed}
              growth={stage.growth}
              stats={{
                totalMinutes: totals.data?.total ?? 0,
                streakDays: totals.data?.streak ?? 0,
                todayMinutes: totals.data?.today ?? 0,
              }}
              focusing={!!active}
              animated
            />
            <View
              style={{
                position: 'absolute',
                top: spacing.lg,
                left: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: colors.scrim,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}>
              <LiveDot color={active ? colors.ember : colors.accent} />
              <AppText variant="mono" tone={active ? 'ember' : 'secondary'}>
                {active ? formatTimer(elapsedSeconds) : stage.label}
              </AppText>
            </View>
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              padding: spacing.lg,
              gap: spacing.lg,
            }}>
            {active ? (
              <>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: spacing.md,
                  }}>
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <Eyebrow tone="ember">focus block · {block}m</Eyebrow>
                    <AppText variant="numberXl">{formatTimer(remainingSeconds)}</AppText>
                  </View>
                  <AppButton
                    label="End"
                    icon={Stop}
                    variant="soft"
                    onPress={handleEnd}
                    disabled={ending}
                  />
                </View>
                <View
                  style={{
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: colors.surfaceSunken,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
                <AppText variant="caption" tone="tertiary">
                  {Math.round(progress * 100)}% of {block}m · started{' '}
                  {formatClock(active.started_at)}
                </AppText>
              </>
            ) : (
              <>
                <View style={{ gap: spacing.xxs }}>
                  <Eyebrow>session length</Eyebrow>
                  <AppText variant="subhead" tone="secondary">
                    Pick a block, then go quiet. It ends itself.
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {BLOCKS.map((minutes) => {
                    const selected = minutes === block;
                    return (
                      <PressableScale
                        key={minutes}
                        haptic="selection"
                        accessibilityLabel={`${minutes} minute block`}
                        onPress={() => setBlock(minutes)}>
                        <View
                          style={{
                            paddingHorizontal: spacing.xl,
                            height: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: radius.full,
                            backgroundColor: selected ? colors.accentSoft : colors.surfaceElevated,
                            borderWidth: 1,
                            borderColor: selected ? colors.accentBorder : colors.hairline,
                          }}>
                          <AppText variant="mono" tone={selected ? 'accent' : 'secondary'}>
                            {minutes}m
                          </AppText>
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
                <AppButton
                  label={`Focus for ${block} minutes`}
                  icon={Play}
                  onPress={handleStart}
                  disabled={starting}
                />
              </>
            )}
          </View>
        </Panel>
      </FadeUp>

      {/* Momentum numbers */}
      <FadeUp index={1}>
        <Panel>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <Stat label="total focus" value={formatMinutes(totals.data?.total ?? 0)} />
            <Stat label="today" value={formatMinutes(totals.data?.today ?? 0)} />
            <Stat label="streak" value={`${totals.data?.streak ?? 0}d`} />
          </View>
        </Panel>
      </FadeUp>

      {/* Session log */}
      <FadeUp index={2}>
        <View>
          <SectionHeader eyebrow="records" title="Recent sessions" />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {history.status === 'loading' && !history.data ? (
              <Loading label="reading sessions…" />
            ) : (history.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Timer}
                image={emptyArt.focus}
                title="No sessions yet"
                message="Start a focus block above — the tree and the log grow together."
              />
            ) : (
              history.data!.map((entry, index) => (
                <ListRow
                  key={entry.id}
                  icon={<Timer size={17} color={colors.textTertiary} weight="light" />}
                  title={formatDayLabel(entry.started_at)}
                  subtitle={`started ${formatClock(entry.started_at)}`}
                  showSeparator={index < history.data!.length - 1}
                  trailing={
                    <AppText variant="mono" tone="secondary">
                      {entry.minutes ?? 0}m
                    </AppText>
                  }
                />
              ))
            )}
          </Panel>
        </View>
      </FadeUp>
    </Screen>
  );
}
