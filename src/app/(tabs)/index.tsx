/**
 * Today — the morning read.
 *
 * Hero panel: today's focus ring with the live session timer. Momentum panel:
 * the trailing seven days, streak and tasks done. Plan panel: quick-add plus
 * the open queue. Garden teaser closes the loop into the 3D home.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ArrowUp, CaretRight, CheckCircle, Play, Plus, Stop } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { GardenScene } from '@/components/garden/garden-scene';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
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
  listTodayTasks,
  setTaskDone,
  startFocusSession,
  todayFocusMinutes,
  totalFocusMinutes,
} from '@/lib/db/repo';
import { hashString } from '@/lib/garden/model';
import { stageFromStats } from '@/lib/garden/models';
import { dateEyebrow, formatClock, formatMinutes, formatTimer, greeting } from '@/lib/format';
import { duration, fonts, radius, spacing, useTheme } from '@/theme';

const DAILY_GOAL_MINUTES = 120;
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

  const active = session.data ?? null;
  const startedAt = active?.started_at ?? null;

  const [nowTick, setNowTick] = useState(() => Date.now());
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(startedAt).getTime()) / 1000))
    : 0;

  const focusMinutes = todayFocus.data ?? 0;
  const goalProgress = Math.min(1, focusMinutes / DAILY_GOAL_MINUTES);

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
      await startFocusSession(db);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await session.refresh();
    } finally {
      setStarting(false);
    }
  }, [active, db, session, starting]);

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
      ]);
    } finally {
      setEnding(false);
    }
  }, [active, db, ending, session, streak, todayFocus, totalFocus, week]);

  const handleAddTask = useCallback(async () => {
    const taskTitle = title.trim();
    if (!taskTitle || adding) return;
    setAdding(true);
    try {
      await createTask(db, { title: taskTitle, priority: 2 });
      setTitle('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await tasks.refresh();
    } finally {
      setAdding(false);
    }
  }, [adding, db, tasks, title]);

  const handleComplete = useCallback(
    async (taskId: string) => {
      await setTaskDone(db, taskId, true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await Promise.all([tasks.refresh(), doneToday.refresh()]);
    },
    [db, doneToday, tasks],
  );

  const tip = TIPS[new Date().getDate() % TIPS.length];

  return (
    <Screen
      header={{
        eyebrow: dateEyebrow(),
        title: greeting(),
        subtitle:
          week.status === 'ready' ? `${formatMinutes(weekTotal)} focused this week` : undefined,
      }}>
      {/* Hero: the timer */}
      <FadeUp index={0}>
        <Panel glow={active != null}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
            <ProgressRing
              progress={goalProgress}
              size={116}
              stroke={9}
              color={active ? colors.ember : colors.accent}>
              <View style={{ alignItems: 'center' }}>
                <AppText variant="numberLg">{focusMinutes}</AppText>
                <AppText variant="eyebrow" tone="tertiary">
                  min today
                </AppText>
              </View>
            </ProgressRing>
            <View style={{ flex: 1, gap: spacing.sm }}>
              {active ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <LiveDot color={colors.ember} />
                    <Eyebrow tone="ember">focus running</Eyebrow>
                  </View>
                  <AppText variant="numberXl">{formatTimer(elapsedSeconds)}</AppText>
                  <AppText variant="caption" tone="tertiary">
                    started {formatClock(active.started_at)} · {DAILY_GOAL_MINUTES / 60}h goal
                  </AppText>
                  <AppButton
                    label="End session"
                    icon={Stop}
                    variant="soft"
                    onPress={handleEnd}
                    disabled={ending}
                  />
                </>
              ) : (
                <>
                  <Eyebrow>focus</Eyebrow>
                  <AppText variant="title">Ready when you are.</AppText>
                  <AppText variant="subhead" tone="secondary">
                    {focusMinutes > 0
                      ? `${formatMinutes(focusMinutes)} banked today. Keep the tree warm.`
                      : 'Every focused minute grows the tree in the garden.'}
                  </AppText>
                  <AppButton
                    label="Start focus"
                    icon={Play}
                    onPress={handleStart}
                    disabled={starting}
                  />
                </>
              )}
            </View>
          </View>
        </Panel>
      </FadeUp>

      {/* Momentum: the week */}
      <FadeUp index={1}>
        <Panel>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}>
            <View style={{ gap: spacing.xxs }}>
              <Eyebrow>momentum</Eyebrow>
              <AppText variant="headline">Last seven days</AppText>
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.xxs }}>
              <AppText variant="mono" tone="secondary">
                {formatMinutes(weekTotal)}
              </AppText>
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
            {weekDays.map((day) => {
              const height =
                day.minutes === 0 ? 5 : Math.max(12, Math.round((day.minutes / weekMax) * 72));
              return (
                <View key={day.day} style={{ flex: 1, alignItems: 'center', gap: spacing.sm }}>
                  <View
                    style={{
                      width: '100%',
                      height,
                      borderRadius: 6,
                      backgroundColor: day.isToday
                        ? colors.accent
                        : day.minutes > 0
                          ? colors.accentSoft
                          : colors.surfaceElevated,
                    }}
                  />
                  <AppText variant="caption" tone={day.isToday ? 'accent' : 'tertiary'}>
                    {dayInitial(day.day)}
                  </AppText>
                </View>
              );
            })}
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
            <AppText variant="mono" tone="tertiary">
              {doneToday.data ?? 0} tasks done today
            </AppText>
            <AppText variant="mono" tone="tertiary">
              {streak.data ?? 0}-day streak
            </AppText>
          </View>
        </Panel>
      </FadeUp>

      {/* Plan: quick-add + queue */}
      <FadeUp index={2}>
        <View>
          <SectionHeader
            eyebrow="plan"
            title="Today"
            trailing={
              tasks.data && tasks.data.length > 0 ? (
                <AppText variant="mono" tone="tertiary">
                  {tasks.data.length} open
                </AppText>
              ) : undefined
            }
          />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingLeft: spacing.lg,
                paddingRight: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.hairline,
              }}>
              <Plus size={16} color={colors.textTertiary} weight="bold" />
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Add a task for today…"
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.accent}
                cursorColor={colors.accent}
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={handleAddTask}
                accessibilityLabel="New task title"
                style={{
                  flex: 1,
                  paddingVertical: 15,
                  color: colors.text,
                  fontFamily: fonts.bodyRegular,
                  fontSize: 16,
                }}
              />
              {title.trim().length > 0 ? (
                <PressableScale haptic="selection" accessibilityLabel="Add task" onPress={handleAddTask}>
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

            {tasks.status === 'loading' && !tasks.data ? (
              <Loading label="reading today's queue…" />
            ) : tasks.status === 'error' && !tasks.data ? (
              <View style={{ padding: spacing.xl, gap: spacing.sm }}>
                <AppText variant="subheadMedium" tone="danger">
                  Could not read the task queue.
                </AppText>
                <PressableScale haptic="selection" onPress={() => tasks.refresh()}>
                  <AppText variant="captionMedium" tone="accent">
                    Retry
                  </AppText>
                </PressableScale>
              </View>
            ) : (tasks.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="Clear runway"
                message="Nothing queued. Add a task above and go deep."
              />
            ) : (
              tasks.data!.map((task, index) => {
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
                            width: 24,
                            height: 24,
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
                        {task.priority >= 3 ? <StatusPill label="high" tone="ember" /> : null}
                      </View>
                    </Pressable>
                    {index < tasks.data!.length - 1 ? (
                      <View
                        style={{
                          height: 1,
                          marginLeft: 52,
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
      <FadeUp index={3}>
        <Panel glow coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <PressableScale
            haptic="selection"
            accessibilityLabel="Open the focus garden"
            onPress={() => router.push('/garden')}>
            <View style={{ height: 190 }}>
              <GardenScene seed={seed} growth={stage.growth} animated={false} />
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
                <Eyebrow>focus garden</Eyebrow>
                <AppText variant="subheadMedium">{stage.label}</AppText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <AppText variant="mono" tone="tertiary">
                  {formatMinutes(totalFocus.data ?? 0)} logged
                </AppText>
                <CaretRight size={14} color={colors.textTertiary} weight="bold" />
              </View>
            </View>
          </PressableScale>
        </Panel>
      </FadeUp>

      {/* Craft tip */}
      <FadeUp index={4}>
        <Panel>
          <View style={{ gap: spacing.sm }}>
            <Eyebrow tone="ember">craft tip</Eyebrow>
            <AppText variant="subhead" tone="secondary">
              {tip}
            </AppText>
          </View>
        </Panel>
      </FadeUp>
    </Screen>
  );
}
