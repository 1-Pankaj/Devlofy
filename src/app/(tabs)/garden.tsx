/**
 * Focus Garden — the 3D home of focused time.
 *
 * The tree's stage reads total focus, streak and today's minutes. Sessions run
 * here: pick a block from the chip row, then the FAB starts it and the block
 * closes itself out when the timer reaches zero.
 */
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { Play, Timer, Stop } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { GardenScene } from '@/components/garden/garden-scene';
import { FocusHeatmap } from '@/components/focus/focus-heatmap';
import { ProjectChips } from '@/components/focus/project-chips';
import { RhythmCard } from '@/components/focus/rhythm-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { FormChip } from '@/components/ui/form-chip';
import { ListRow } from '@/components/ui/list-row';
import { LiveDot } from '@/components/ui/live-dot';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  endFocusSession,
  focusMinutesByDay,
  getActiveSession,
  getFocusStreakDays,
  listRecentSessions,
  startFocusSession,
  todayFocusMinutes,
  totalFocusMinutes,
} from '@/lib/db/repo';
import { hashString } from '@/lib/garden/model';
import { stageFromStats } from '@/lib/garden/models';
import { useEngine } from '@/lib/engine';
import { formatClock, formatDayLabel, formatMinutes, formatTimer } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

const BLOCKS = [25, 50, 90] as const;
type Block = (typeof BLOCKS)[number];

const formatDays = (days: number) => `${days}d`;

/** A secondary figure inside the tonal momentum block. */
function SubStat({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, gap: spacing.xxs }}>
      <AnimatedNumber value={value} variant="headline" format={format} color={colors.accent} />
      <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
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
  const rhythm = useLiveQuery((d) => focusMinutesByDay(d, 84));
  const engine = useEngine();
  const { refresh: refreshEngine } = engine;
  const focusProjectId = useSettings((s) => s.focusProjectId);

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
    refreshEngine();
  }, [history, refreshEngine, session, totals]);

  const handleStart = useCallback(async () => {
    if (starting || active) return;
    setStarting(true);
    try {
      await startFocusSession(db, focusProjectId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await refreshAll();
    } finally {
      setStarting(false);
    }
  }, [active, db, focusProjectId, refreshAll, starting]);

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
      }}
      fab={
        <Fab
          label={active ? 'End block' : `Focus for ${block}m`}
          icon={active ? Stop : Play}
          tone={active ? 'ember' : 'brand'}
          onPress={active ? handleEnd : handleStart}
          disabled={active ? ending : starting}
        />
      }>
      {/* The tree and the session controls */}
      <FadeUp index={0}>
        <Panel rounding="xl" coreStyle={{ padding: 0, overflow: 'hidden' }}>
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
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <Eyebrow tone="ember">focus block · {block}m</Eyebrow>
                  <AppText variant="numberXl">{formatTimer(remainingSeconds)}</AppText>
                </View>
                <View
                  style={{
                    height: 6,
                    borderRadius: radius.full,
                    backgroundColor: colors.surfaceSunken,
                    overflow: 'hidden',
                  }}>
                  <View
                    style={{
                      width: `${Math.round(progress * 100)}%`,
                      height: '100%',
                      backgroundColor: colors.ember,
                    }}
                  />
                </View>
                <AppText variant="caption" tone="tertiary">
                  {Math.round(progress * 100)}% of {block}m · started{' '}
                  {formatClock(active.started_at)}
                  {active.project_name ? ` · ${active.project_name}` : ''}
                </AppText>
              </>
            ) : (
              <>
                <View style={{ gap: spacing.xxs }}>
                  <Eyebrow>Session length</Eyebrow>
                  <AppText variant="subhead" tone="secondary">
                    Pick a block, then go quiet. It ends itself.
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {BLOCKS.map((minutes) => (
                    <FormChip
                      key={minutes}
                      label={`${minutes}m`}
                      active={minutes === block}
                      onPress={() => setBlock(minutes)}
                    />
                  ))}
                </View>
                <ProjectChips />
              </>
            )}
          </View>
        </Panel>
      </FadeUp>

      {/* Momentum: one tonal block, one hero figure, two supporting figures */}
      <FadeUp index={1}>
        <View
          style={{
            backgroundColor: colors.accentSoft,
            borderRadius: radius.xl,
            borderCurve: 'continuous',
            padding: spacing.lg,
            gap: spacing.lg,
          }}>
          <View style={{ gap: spacing.xxs }}>
            <Eyebrow tone="accent">Total focus</Eyebrow>
            <AnimatedNumber
              value={totals.data?.total ?? 0}
              variant="numberXl"
              format={formatMinutes}
              color={colors.accent}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.lg,
              paddingTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.accentBorder,
            }}>
            <SubStat label="today" value={totals.data?.today ?? 0} format={formatMinutes} />
            <SubStat label="streak" value={totals.data?.streak ?? 0} format={formatDays} />
          </View>
        </View>
      </FadeUp>

      {/* Twelve weeks of rhythm */}
      <FadeUp index={2}>
        <FocusHeatmap data={rhythm.data ?? []} />
      </FadeUp>

      {/* When the work actually happens */}
      <FadeUp index={3}>
        <RhythmCard rhythm={engine.rhythm} insights={engine.insights} />
      </FadeUp>

      {/* Session log */}
      <FadeUp index={4}>
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
