/**
 * Today — the morning read.
 *
 * Material 3 arrangement: one tonal hero block carrying the focus ring and the
 * live timer, a two-up tally row, the week's bars, then a horizontal shelf of
 * recent sessions and the day's queue. The single primary action is the FAB —
 * nothing else on this screen is filled.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ArrowUp,
  CaretRight,
  CheckCircle,
  Flame,
  MagnifyingGlass,
  Play,
  Plus,
  Stop,
  Timer,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import type { IconProps } from 'phosphor-react-native';
import Animated, {
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { GardenScene } from '@/components/garden/garden-scene';
import { NextUp } from '@/components/focus/next-up';
import { ProjectChips } from '@/components/focus/project-chips';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Fab } from '@/components/ui/fab';
import { LiveDot } from '@/components/ui/live-dot';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  countDoneToday,
  createTask,
  endFocusSession,
  focusMinutesByDay,
  getActiveSession,
  getFocusStreakDays,
  listProjects,
  listRecentSessions,
  listTodayTasks,
  setTaskDone,
  startFocusSession,
  todayFocusMinutes,
  totalFocusMinutes,
} from '@/lib/db/repo';
import { hashString } from '@/lib/garden/model';
import { stageFromStats } from '@/lib/garden/models';
import { useEngine, type RankedTask } from '@/lib/engine';
import { parseTaskInput } from '@/lib/parse-task';
import { useSettings } from '@/state/settings';
import {
  dateEyebrow,
  formatClock,
  formatDueLabel,
  formatMinutes,
  formatSessionWhen,
  formatTimer,
  greeting,
} from '@/lib/format';
import { duration, easing, fonts, radius, spacing, useTheme } from '@/theme';

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TIPS = [
  'Two protected 50-minute blocks beat five interrupted 20s.',
  'Ship the ugly version first — polish lives on top of working.',
  'When stuck, write the smallest failing test, then fix it.',
  'Batch shallow work after lunch; guard the morning for the deep thing.',
  'If it takes under two minutes, do it now — the list stays honest.',
  'End the day mid-sentence. Tomorrow starts with momentum.',
  'A session you stop on purpose still counts. A session you never start does not.',
];

function dayInitial(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return WEEKDAY_INITIAL[new Date(y, m - 1, d).getDay()];
}

/**
 * One bar of the trailing week. It grows from nothing on mount so the week
 * reads as activity arriving rather than a static chart.
 */
function FocusBar({
  height,
  kind,
  delay,
}: {
  height: number;
  kind: 'today' | 'past' | 'empty';
  delay: number;
}) {
  const { colors } = useTheme();
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.set(
      withDelay(
        delay,
        withTiming(height, {
          duration: duration.slow,
          easing: easing.out,
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );
  }, [delay, grow, height]);

  const growStyle = useAnimatedStyle(() => ({ height: grow.get() }));
  const fill =
    kind === 'today' ? colors.accent : kind === 'past' ? colors.accentBorder : colors.surfaceSunken;

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          borderRadius: radius.sm,
          backgroundColor: fill,
        },
        growStyle,
      ]}
    />
  );
}

/** One of the two tally blocks — a tinted icon well over a big figure. */
function Tally({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ComponentType<IconProps>;
  tone: 'brand' | 'ember';
}) {
  const { colors } = useTheme();
  const well = tone === 'brand' ? colors.accentSoft : colors.emberSoft;
  const ink = tone === 'brand' ? colors.accent : colors.ember;

  return (
    <Panel style={{ flex: 1 }} pad="md">
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: well,
          }}>
          <Icon size={20} color={ink} weight="fill" />
        </View>
        <View style={{ gap: spacing.xxs }}>
          <AnimatedNumber value={value} variant="numberLg" color={colors.text} />
          <AppText variant="caption" tone="tertiary" numberOfLines={1}>
            {label}
          </AppText>
        </View>
      </View>
    </Panel>
  );
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const router = useRouter();

  const session = useLiveQuery(getActiveSession);
  const todayFocus = useLiveQuery(todayFocusMinutes);
  const totalFocus = useLiveQuery(totalFocusMinutes);
  const doneToday = useLiveQuery(countDoneToday);
  const streak = useLiveQuery(getFocusStreakDays);
  const week = useLiveQuery((d) => focusMinutesByDay(d, 7));
  const tasks = useLiveQuery((d) => listTodayTasks(d));
  const recent = useLiveQuery((d) => listRecentSessions(d, 5));
  const projects = useLiveQuery((d) => listProjects(d));

  const dailyGoalMinutes = useSettings((s) => s.dailyGoalMinutes);
  const focusProjectId = useSettings((s) => s.focusProjectId);
  const setFocusProjectId = useSettings((s) => s.setFocusProjectId);

  const engine = useEngine();
  const { refresh: refreshEngine } = engine;

  const active = session.data ?? null;
  const startedAt = active?.started_at ?? null;

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [taskFocused, setTaskFocused] = useState(false);

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(startedAt).getTime()) / 1000))
    : 0;

  const focusMinutes = todayFocus.data ?? 0;
  const goalProgress = Math.min(1, focusMinutes / dailyGoalMinutes);
  const remainingMinutes = Math.max(0, dailyGoalMinutes - focusMinutes);
  const goalReached = remainingMinutes === 0;

  const weekDays = useMemo(() => week.data ?? [], [week.data]);
  const weekTotal = useMemo(() => weekDays.reduce((sum, day) => sum + day.minutes, 0), [weekDays]);
  const weekMax = useMemo(() => Math.max(45, ...weekDays.map((day) => day.minutes)), [weekDays]);

  const seed = useMemo(() => hashString('devlofy-garden'), []);
  const stage = useMemo(
    () =>
      stageFromStats({
        totalMinutes: totalFocus.data ?? 0,
        streakDays: streak.data ?? 0,
        todayMinutes: focusMinutes,
      }),
    [totalFocus.data, streak.data, focusMinutes],
  );

  const handleStart = useCallback(async () => {
    if (starting || active) return;
    setStarting(true);
    try {
      await startFocusSession(db, focusProjectId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await session.refresh();
    } finally {
      setStarting(false);
    }
  }, [active, db, focusProjectId, session, starting]);

  /**
   * The Engine's loop, closed: start the block *from* the recommendation, and
   * attribute it to the task (not just the project) so the app can later compare
   * the estimate with what actually happened. The attribution setting follows
   * the task, so the rest of the screen stays consistent with the running block.
   */
  const handleStartFromTask = useCallback(
    async (ranked: RankedTask) => {
      if (starting || active) return;
      setStarting(true);
      try {
        await startFocusSession(db, ranked.task.project_id ?? focusProjectId, ranked.task.id);
        if (ranked.task.project_id && ranked.task.project_id !== focusProjectId) {
          setFocusProjectId(ranked.task.project_id);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await session.refresh();
      } finally {
        setStarting(false);
      }
    },
    [active, db, focusProjectId, session, setFocusProjectId, starting],
  );

  const handleEnd = useCallback(async () => {
    if (!active || ending) return;
    setEnding(true);
    try {
      await endFocusSession(db, active.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await Promise.all([
        session.refresh(),
        todayFocus.refresh(),
        streak.refresh(),
        week.refresh(),
        totalFocus.refresh(),
        recent.refresh(),
      ]);
      refreshEngine();
    } finally {
      setEnding(false);
    }
  }, [active, db, ending, recent, refreshEngine, session, streak, todayFocus, totalFocus, week]);

  const parsed = useMemo(
    () => parseTaskInput(title, (projects.data ?? []).map((p) => ({ id: p.id, name: p.name }))),
    [projects.data, title],
  );

  const handleAddTask = useCallback(async () => {
    if (!parsed.title || adding) return;
    setAdding(true);
    try {
      await createTask(db, {
        title: parsed.title,
        priority: parsed.priority,
        estMinutes: parsed.estMinutes,
        projectId: parsed.projectId,
        dueAt: parsed.dueAt,
      });
      setTitle('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await tasks.refresh();
      refreshEngine();
    } finally {
      setAdding(false);
    }
  }, [adding, db, parsed, refreshEngine, tasks]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      await setTaskDone(db, taskId, true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Promise.all([tasks.refresh(), doneToday.refresh()]);
      refreshEngine();
    },
    [db, doneToday, refreshEngine, tasks],
  );

  const tip = TIPS[new Date().getDate() % TIPS.length];

  return (
    <Screen
      header={{
        eyebrow: dateEyebrow(),
        title: greeting(),
        subtitle:
          week.status === 'ready'
            ? weekTotal > 0
              ? `${formatMinutes(weekTotal)} focused this week`
              : 'No focus logged this week yet'
            : undefined,
        trailing: (
          <PressableScale
            haptic="selection"
            accessibilityLabel="Search everything"
            onPress={() => router.push('/search')}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceElevated,
              }}>
              <MagnifyingGlass size={17} color={colors.textSecondary} weight="bold" />
            </View>
          </PressableScale>
        ),
      }}
      fab={
        <Fab
          label={active ? 'End session' : 'Start focus'}
          icon={active ? Stop : Play}
          tone={active ? 'ember' : 'brand'}
          onPress={active ? handleEnd : handleStart}
          disabled={active ? ending : starting}
        />
      }>
      {/* Hero: the timer on a tonal block */}
      <FadeUp index={0}>
        <View
          style={{
            backgroundColor: colors.accentSoft,
            borderRadius: radius.xl,
            borderCurve: 'continuous',
            padding: spacing.lg,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <ProgressRing
              progress={goalProgress}
              size={108}
              stroke={9}
              color={colors.ember}
              trackColor={colors.accentBorder}>
              <View style={{ alignItems: 'center' }}>
                <AnimatedNumber value={focusMinutes} variant="title" color={colors.accent} />
                <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
                  min
                </AppText>
              </View>
            </ProgressRing>
            <View style={{ flex: 1, gap: spacing.xs }}>
              {active ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <LiveDot color={colors.ember} />
                    <Eyebrow tone="accent">Focus running</Eyebrow>
                  </View>
                  <AppText variant="numberLg" tone="accent">
                    {formatTimer(elapsedSeconds)}
                  </AppText>
                  <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
                    started {formatClock(active.started_at)}
                    {active.project_name ? ` · ${active.project_name}` : ''}
                  </AppText>
                </>
              ) : (
                <>
                  <Eyebrow tone="accent">Today&apos;s focus</Eyebrow>
                  <AppText variant="title" tone="accent">
                    {goalReached ? 'Goal reached' : `${formatMinutes(remainingMinutes)} to go`}
                  </AppText>
                  <AppText variant="subhead" tone="accent" style={{ opacity: 0.78 }}>
                    {focusMinutes > 0
                      ? `${formatMinutes(focusMinutes)} banked today.`
                      : 'Every focused minute grows the tree in the garden.'}
                  </AppText>
                </>
              )}
            </View>
          </View>
        </View>
      </FadeUp>

      {/* Attribution for the next block — hidden while one is already running */}
      {!active ? (
        <FadeUp index={1}>
          <ProjectChips />
        </FadeUp>
      ) : null}

      {/* The Engine's answer. Hidden while a block runs: the hero owns the screen
          then, and a recommendation you cannot act on is just noise. */}
      {!active && engine.status === 'ready' ? (
        <FadeUp index={1}>
          <NextUp
            ranked={engine.ranked}
            starting={starting}
            onStart={handleStartFromTask}
          />
        </FadeUp>
      ) : null}

      {/* Two-up tally */}
      <FadeUp index={1}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Tally
            label="day streak"
            value={streak.data ?? 0}
            icon={Flame}
            tone="ember"
          />
          <Tally
            label="tasks done today"
            value={doneToday.data ?? 0}
            icon={CheckCircle}
            tone="brand"
          />
        </View>
      </FadeUp>

      {/* The week */}
      <FadeUp index={2}>
        <Panel>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}>
            <View style={{ gap: spacing.xxs }}>
              <Eyebrow>Momentum</Eyebrow>
              <AppText variant="headline">Last seven days</AppText>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.xxs }}>
              <AppText variant="subheadMedium">{formatMinutes(weekTotal)}</AppText>
              <AppText variant="caption" tone="tertiary">
                focused
              </AppText>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: spacing.sm,
              marginTop: spacing.xl,
            }}>
            {weekDays.map((day, index) => {
              const height =
                day.minutes === 0 ? 6 : Math.max(14, Math.round((day.minutes / weekMax) * 68));
              return (
                <View key={day.day} style={{ flex: 1, alignItems: 'center', gap: spacing.sm }}>
                  <FocusBar
                    height={height}
                    kind={day.minutes === 0 ? 'empty' : day.isToday ? 'today' : 'past'}
                    delay={index * 55}
                  />
                  <AppText variant="caption" tone={day.isToday ? 'accent' : 'tertiary'}>
                    {dayInitial(day.day)}
                  </AppText>
                </View>
              );
            })}
          </View>
        </Panel>
      </FadeUp>

      {/* Recent sessions: a shelf, not a list */}
      {(recent.data?.length ?? 0) > 0 ? (
        <FadeUp index={3}>
          <View>
            <SectionHeader eyebrow="History" title="Recent sessions" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md }}>
              {recent.data!.map((entry) => (
                <Panel key={entry.id} pad="md" style={{ width: 152 }}>
                  <View style={{ gap: spacing.md }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.emberSoft,
                      }}>
                      <Timer size={18} color={colors.ember} weight="fill" />
                    </View>
                    <View style={{ gap: spacing.xxs }}>
                      <AppText variant="headline">{formatMinutes(entry.minutes ?? 0)}</AppText>
                      <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                        {entry.project_name ? `${entry.project_name} · ` : ''}
                        {formatSessionWhen(entry.started_at)}
                      </AppText>
                    </View>
                  </View>
                </Panel>
              ))}
            </ScrollView>
          </View>
        </FadeUp>
      ) : null}

      {/* Plan: quick-add + queue */}
      <FadeUp index={4}>
        <View>
          <SectionHeader
            eyebrow="Plan"
            title="Today"
            trailing={
              tasks.data && tasks.data.length > 0 ? (
                <AppText variant="caption" tone="secondary">
                  {tasks.data.length} open
                </AppText>
              ) : undefined
            }
          />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <View
              style={{
                borderBottomWidth: taskFocused ? 2 : 1,
                borderBottomColor: taskFocused ? colors.accent : colors.hairline,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingLeft: spacing.lg,
                  paddingRight: spacing.md,
                }}>
                <Plus size={16} color={colors.textTertiary} weight="bold" />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => setTaskFocused(true)}
                  onBlur={() => setTaskFocused(false)}
                  placeholder="Add a task — try “Ship the invoice !3 45m #Northwind”"
                  placeholderTextColor={colors.textTertiary}
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  returnKeyType="done"
                  submitBehavior="submit"
                  onSubmitEditing={handleAddTask}
                  accessibilityLabel="New task title"
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    color: colors.text,
                    fontFamily: fonts.bodyRegular,
                    fontSize: 16,
                  }}
                />
                {parsed.title.length > 0 ? (
                  <PressableScale
                    haptic="selection"
                    accessibilityLabel={`Add task ${parsed.title}`}
                    onPress={handleAddTask}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radius.full,
                        backgroundColor: colors.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <ArrowUp size={15} color={colors.accentContrast} weight="bold" />
                    </View>
                  </PressableScale>
                ) : null}
              </View>

              {parsed.tokens.length > 0 || parsed.unknownProject ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: spacing.xs,
                    paddingHorizontal: spacing.lg,
                    paddingBottom: spacing.md,
                  }}>
                  <AppText variant="caption" tone="tertiary">
                    files as
                  </AppText>
                  {parsed.tokens.map((token, index) => (
                    <StatusPill
                      key={`${token.kind}-${index}`}
                      label={token.label}
                      tone={token.tone}
                    />
                  ))}
                  {parsed.unknownProject ? (
                    <StatusPill label={`no project “${parsed.unknownProject}”`} tone="danger" />
                  ) : null}
                </View>
              ) : null}
            </View>

            {tasks.status === 'loading' && !tasks.data ? (
              <Loading label="reading today's queue…" />
            ) : tasks.status === 'error' && !tasks.data ? (
              <ErrorState what="the task queue" onRetry={() => tasks.refresh()} compact />
            ) : (tasks.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={CheckCircle}
                image={emptyArt.tasks}
                title="Clear runway"
                message="Nothing queued. Add a task above and go deep."
              />
            ) : (
              tasks.data!.map((task, index) => {
                const due = task.due_at ? formatDueLabel(task.due_at) : null;
                const meta = [task.project_name, task.est_minutes ? `${task.est_minutes}m` : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <Animated.View
                    key={task.id}
                    layout={LinearTransition.duration(duration.base).reduceMotion(
                      ReduceMotion.System,
                    )}
                    exiting={FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.System)}>
                    <Pressable
                      onPress={() => handleComplete(task.id)}
                      accessibilityLabel={`Complete ${task.title}`}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                      })}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.md,
                          paddingHorizontal: spacing.lg,
                          paddingVertical: spacing.md,
                        }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: radius.full,
                            borderWidth: 1.5,
                            borderColor: colors.hairlineStrong,
                          }}
                        />
                        <View style={{ flex: 1, gap: 1 }}>
                          <AppText variant="subheadMedium" numberOfLines={1}>
                            {task.title}
                          </AppText>
                          {meta ? (
                            <AppText variant="caption" tone="tertiary" numberOfLines={1}>
                              {meta}
                            </AppText>
                          ) : null}
                        </View>
                        {due ? (
                          <StatusPill
                            label={due.label}
                            tone={due.overdue ? 'danger' : 'neutral'}
                          />
                        ) : null}
                        {task.priority >= 2 ? <StatusPill label="high" tone="ember" /> : null}
                      </View>
                    </Pressable>
                    {index < tasks.data!.length - 1 ? (
                      <View
                        style={{
                          height: 1,
                          marginLeft: 50,
                          backgroundColor: colors.hairline,
                        }}
                      />
                    ) : null}
                  </Animated.View>
                );
              })
            )}
          </Panel>
        </View>
      </FadeUp>

      {/* Garden teaser */}
      <FadeUp index={5}>
        <Panel rounding="xl" coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <PressableScale
            haptic="selection"
            accessibilityLabel="Open the focus garden"
            onPress={() => router.push('/garden')}>
            <View style={{ height: 200 }}>
              <GardenScene
                seed={seed}
                growth={stage.growth}
                stats={{
                  totalMinutes: totalFocus.data ?? 0,
                  streakDays: streak.data ?? 0,
                  todayMinutes: focusMinutes,
                }}
                focusing={!!active}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
              }}>
              <View style={{ gap: spacing.xxs }}>
                <Eyebrow>Focus garden</Eyebrow>
                <AppText variant="subheadMedium">{stage.label}</AppText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText variant="caption" tone="secondary">
                  {formatMinutes(totalFocus.data ?? 0)} logged
                </AppText>
                <CaretRight size={14} color={colors.textTertiary} weight="bold" />
              </View>
            </View>
          </PressableScale>
        </Panel>
      </FadeUp>

      {/* Craft tip — deliberately not a card */}
      <FadeUp index={6}>
        <View
          style={{
            gap: spacing.sm,
            paddingLeft: spacing.md,
            borderLeftWidth: 3,
            borderLeftColor: colors.emberSoft,
          }}>
          <Eyebrow tone="ember">Craft tip</Eyebrow>
          <AppText variant="subhead" tone="secondary">
            {tip}
          </AppText>
        </View>
      </FadeUp>
    </Screen>
  );
}
