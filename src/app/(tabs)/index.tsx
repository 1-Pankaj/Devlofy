/**
 * Today — the morning read.
 *
 * The order is the day: one instrument for focus, the Engine's recommendation,
 * the queue, then the record of what already happened. The page is drawn, not
 * inflated — white panels on a neutral canvas, a hairline between every pair of
 * ideas, and exactly one filled control (the action button).
 *
 * Motion here is measurement, not decoration: the figures count, the week's bars
 * grow, the goal meter fills, and the live block keeps a slow amber breath.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ArrowUp,
  CaretRight,
  CheckCircle,
  MagnifyingGlass,
  Play,
  Plus,
  Stop,
  Timer,
} from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
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
import { SentinelStrip } from '@/components/sentinel/standing-strip';
import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Fab } from '@/components/ui/fab';
import { LiveDot } from '@/components/ui/live-dot';
import { Loading } from '@/components/ui/loading';
import { Meter } from '@/components/ui/meter';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { StatRow } from '@/components/ui/stat';
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
import { messageOf } from '@/lib/use-async-data';
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
function FocusBar({ height, kind, delay }: { height: number; kind: 'today' | 'past' | 'empty'; delay: number }) {
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
        { width: '100%', borderRadius: radius.xs, backgroundColor: fill },
        growStyle,
      ]}
    />
  );
}

/** The instrument at the top of the page: today's focus, and what it is doing. */
function FocusPanel({
  active,
  elapsedSeconds,
  focusMinutes,
  goalProgress,
  remainingMinutes,
  goalReached,
  dailyGoalMinutes,
  projectName,
  startedAt,
}: {
  active: boolean;
  elapsedSeconds: number;
  focusMinutes: number;
  goalProgress: number;
  remainingMinutes: number;
  goalReached: boolean;
  dailyGoalMinutes: number;
  projectName?: string | null;
  startedAt?: string | null;
}) {
  const { colors } = useTheme();

  return (
    <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}>
          <View style={{ gap: spacing.xxs }}>
            <Eyebrow>{active ? 'Focus — running' : 'Focus — today'}</Eyebrow>
            <AppText variant="timer">
              {active ? formatTimer(elapsedSeconds) : formatMinutes(focusMinutes)}
            </AppText>
          </View>
          <StatusPill
            label={active ? 'running' : goalReached ? 'goal met' : 'idle'}
            tone={active ? 'ember' : goalReached ? 'accent' : 'neutral'}
            dot={active}
            style={{ marginTop: 2 }}
          />
        </View>

        <Meter
          value={goalProgress}
          tone={active ? 'ember' : 'accent'}
          height={6}
          trackColor={colors.surfaceSunken}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <AppText variant="code" tone="tertiary">
            goal {formatMinutes(dailyGoalMinutes)}
          </AppText>
          <AppText variant="code" tone={active ? 'ember' : 'tertiary'}>
            {active
              ? `started ${formatClock(startedAt ?? '')}${projectName ? ` · ${projectName}` : ''}`
              : goalReached
                ? `${formatMinutes(focusMinutes)} banked`
                : `${formatMinutes(remainingMinutes)} to go`}
          </AppText>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          backgroundColor: colors.surfaceElevated,
        }}>
        {active ? (
          <>
            <LiveDot color={colors.ember} size={7} />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              A block is open. End it with the amber button — the minutes are already counted.
            </AppText>
          </>
        ) : (
          <>
            <View
              style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent }}
            />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              {focusMinutes > 0
                ? `${formatMinutes(focusMinutes)} banked today. Every minute waters the garden.`
                : 'Nothing banked yet. Start from the queue, or pick a project below.'}
            </AppText>
          </>
        )}
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
  // One line for every write on this screen. A tap that failed used to look
  // exactly like a tap that worked.
  const [writeProblem, setWriteProblem] = useState<string | null>(null);
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
    setWriteProblem(null);
    try {
      await startFocusSession(db, focusProjectId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await session.refresh();
    } catch (error) {
      setWriteProblem(messageOf(error));
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
      setWriteProblem(null);
      try {
        await startFocusSession(db, ranked.task.project_id ?? focusProjectId, ranked.task.id);
        if (ranked.task.project_id && ranked.task.project_id !== focusProjectId) {
          setFocusProjectId(ranked.task.project_id);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        await session.refresh();
      } catch (error) {
        setWriteProblem(messageOf(error));
      } finally {
        setStarting(false);
      }
    },
    [active, db, focusProjectId, session, setFocusProjectId, starting],
  );

  const handleEnd = useCallback(async () => {
    if (!active || ending) return;
    setEnding(true);
    setWriteProblem(null);
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
    } catch (error) {
      setWriteProblem(messageOf(error));
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
    setWriteProblem(null);
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
    } catch (error) {
      // Keep what was typed: the title stays in the field so the add can be retried.
      setWriteProblem(messageOf(error));
    } finally {
      setAdding(false);
    }
  }, [adding, db, parsed, refreshEngine, tasks]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      setWriteProblem(null);
      try {
        await setTaskDone(db, taskId, true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        await Promise.all([tasks.refresh(), doneToday.refresh()]);
        refreshEngine();
      } catch (error) {
        setWriteProblem(messageOf(error));
      }
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
                width: 34,
                height: 34,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: colors.hairline,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}>
              <MagnifyingGlass size={15} color={colors.textSecondary} weight="bold" />
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
      {writeProblem ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
          }}>
          <AppText variant="caption" tone="danger" style={{ flex: 1 }}>
            {writeProblem}
          </AppText>
        </View>
      ) : null}

      <FadeUp index={0}>
        <FocusPanel
          active={!!active}
          elapsedSeconds={elapsedSeconds}
          focusMinutes={focusMinutes}
          goalProgress={goalProgress}
          remainingMinutes={remainingMinutes}
          goalReached={goalReached}
          dailyGoalMinutes={dailyGoalMinutes}
          projectName={active?.project_name}
          startedAt={active?.started_at}
        />
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
          <NextUp ranked={engine.ranked} starting={starting} onStart={handleStartFromTask} />
        </FadeUp>
      ) : null}

      {/* Plan: quick-add + queue */}
      <FadeUp index={2}>
        <View>
          <SectionHeader
            eyebrow="plan"
            title="Today"
            trailing={
              tasks.data && tasks.data.length > 0 ? (
                <AppText variant="code" tone="tertiary">
                  {tasks.data.length} open
                </AppText>
              ) : undefined
            }
          />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <View
              style={{
                borderBottomWidth: 1,
                borderBottomColor: taskFocused ? colors.accent : colors.hairline,
                backgroundColor: taskFocused ? colors.surface : colors.surfaceElevated,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingLeft: spacing.md,
                  paddingRight: spacing.sm,
                }}>
                <Plus size={15} color={colors.textTertiary} weight="bold" />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => setTaskFocused(true)}
                  onBlur={() => setTaskFocused(false)}
                  placeholder="Add a task — “Ship the invoice !3 45m #Northwind”"
                  placeholderTextColor={colors.textTertiary}
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  returnKeyType="done"
                  submitBehavior="submit"
                  onSubmitEditing={handleAddTask}
                  accessibilityLabel="New task title"
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    color: colors.text,
                    fontFamily: fonts.bodyRegular,
                    fontSize: 15,
                  }}
                />
                {parsed.title.length > 0 ? (
                  <PressableScale
                    haptic="selection"
                    accessibilityLabel={`Add task ${parsed.title}`}
                    onPress={handleAddTask}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: radius.md,
                        backgroundColor: colors.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <ArrowUp size={14} color={colors.accentContrast} weight="bold" />
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
                    paddingHorizontal: spacing.md,
                    paddingBottom: spacing.sm,
                  }}>
                  <AppText variant="code" tone="tertiary" style={{ fontSize: 11 }}>
                    files as
                  </AppText>
                  {parsed.tokens.map((token, index) => (
                    <StatusPill key={`${token.kind}-${index}`} label={token.label} tone={token.tone} />
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
                    layout={LinearTransition.duration(duration.base).reduceMotion(ReduceMotion.System)}
                    exiting={FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.System)}>
                    <Pressable
                      onPress={() => handleComplete(task.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Complete ${task.title}`}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                      })}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.md,
                          paddingHorizontal: spacing.md,
                          paddingVertical: 11,
                        }}>
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: radius.xs,
                            borderWidth: 1.2,
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
                          <StatusPill label={due.label} tone={due.overdue ? 'danger' : 'neutral'} />
                        ) : null}
                        {task.priority >= 2 ? <StatusPill label="P1" tone="ember" /> : null}
                      </View>
                    </Pressable>
                    {index < tasks.data!.length - 1 ? (
                      <View
                        style={{
                          height: 1,
                          marginLeft: spacing.md + 18 + spacing.md,
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

      {/* Momentum: the week, then the two figures that explain it */}
      <FadeUp index={3}>
        <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ gap: spacing.xxs }}>
                <Eyebrow>momentum</Eyebrow>
                <AppText variant="headline">Last seven days</AppText>
              </View>
              <AppText variant="code" tone="secondary">
                {formatMinutes(weekTotal)} focused
              </AppText>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: spacing.xs,
                height: 80,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairline,
                paddingBottom: spacing.sm,
              }}>
              {weekDays.map((day, index) => {
                const height =
                  day.minutes === 0 ? 4 : Math.max(10, Math.round((day.minutes / weekMax) * 62));
                return (
                  <View key={day.day} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
                    <FocusBar
                      height={height}
                      kind={day.minutes === 0 ? 'empty' : day.isToday ? 'today' : 'past'}
                      delay={index * 45}
                    />
                    <AppText
                      variant="monoLabel"
                      tone={day.isToday ? 'accent' : 'tertiary'}
                      style={{ fontSize: 9.5 }}>
                      {dayInitial(day.day)}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
              backgroundColor: colors.surfaceElevated,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}>
            <StatRow style={{ flex: 1 }}>
              <View style={{ gap: 1 }}>
                <AppText variant="title">{streak.data ?? 0}</AppText>
                <AppText variant="monoLabel" tone="tertiary">
                  day streak
                </AppText>
              </View>
              <View style={{ gap: 1 }}>
                <AppText variant="title">{doneToday.data ?? 0}</AppText>
                <AppText variant="monoLabel" tone="tertiary">
                  done today
                </AppText>
              </View>
            </StatRow>
          </View>
        </Panel>
      </FadeUp>

      {/* Sentinel — the one thing here that can be true without being opened.
          Absent entirely until a URL is watched; a red pill when one is down. */}
      <FadeUp index={4}>
        <SentinelStrip onPress={() => router.push('/sentinel')} />
      </FadeUp>

      {/* Recent sessions: a shelf, not a list */}
      {(recent.data?.length ?? 0) > 0 ? (
        <FadeUp index={5}>
          <View>
            <SectionHeader eyebrow="history" title="Recent sessions" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.sm }}>
              {recent.data!.map((entry) => (
                <Panel key={entry.id} pad="md" rounding="md" style={{ width: 148 }}>
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Timer size={13} color={colors.ember} weight="fill" />
                      <AppText variant="monoLabel" tone="tertiary" style={{ fontSize: 9.5 }}>
                        session
                      </AppText>
                    </View>
                    <View style={{ gap: 2 }}>
                      <AppText variant="title">{formatMinutes(entry.minutes ?? 0)}</AppText>
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

      {/* Garden teaser */}
      <FadeUp index={6}>
        <Panel rounding="lg" coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <PressableScale
            haptic="selection"
            accessibilityLabel="Open the focus garden"
            onPress={() => router.push('/garden')}>
            <View style={{ height: 176 }}>
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
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
              }}>
              <View style={{ gap: 2 }}>
                <Eyebrow>focus garden</Eyebrow>
                <AppText variant="subheadMedium">{stage.label}</AppText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText variant="code" tone="tertiary">
                  {formatMinutes(totalFocus.data ?? 0)} logged
                </AppText>
                <CaretRight size={13} color={colors.textTertiary} weight="bold" />
              </View>
            </View>
          </PressableScale>
        </Panel>
      </FadeUp>

      {/* Craft tip — deliberately not a card */}
      <FadeUp index={7}>
        <View
          style={{
            gap: spacing.xs,
            paddingLeft: spacing.md,
            borderLeftWidth: 2,
            borderLeftColor: colors.ember,
          }}>
          <Eyebrow tone="ember">craft tip</Eyebrow>
          <AppText variant="subhead" tone="secondary">
            {tip}
          </AppText>
        </View>
      </FadeUp>
    </Screen>
  );
}
