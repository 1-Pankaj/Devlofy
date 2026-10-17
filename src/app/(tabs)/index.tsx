/**
 * Today — the plan, the timer, the streak. The screen the app opens to.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ArrowRight, Check, Play, Stop } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { GardenScene } from '@/components/garden/garden-scene';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { FadeUp } from '@/components/ui/stagger';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  countDoneToday,
  endFocusSession,
  getActiveSession,
  getFocusStreakDays,
  listTodayTasks,
  setTaskDone,
  startFocusSession,
  todayFocusMinutes,
  type TaskRow,
} from '@/lib/db/repo';
import { dateEyebrow, formatMinutes, greeting } from '@/lib/format';
import { useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

const FOCUS_GOAL_MINUTES = 120;

const TIPS = [
  'Give your best 90 minutes to the deep task before opening a single browser tab.',
  'A task you keep skipping is usually two tasks. Split it and the resistance drops.',
  'Log the tiny sessions too — 15 honest minutes a day beats one heroic Sunday.',
  'Ship the ugly version to the client, then polish. Feedback is the scarce resource.',
  'When stuck for 20 minutes on a bug, write down what you know. The gap shows up.',
];

/** Picked once per launch — rotating tips are a nice-to-have, not a render concern. */
const DAILY_TIP = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function StatColumn({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="numberLg">{value}</AppText>
      <Eyebrow>{label}</Eyebrow>
    </View>
  );
}

function TaskRowItem({ task, onDone }: { task: TaskRow; onDone: () => void }) {
  const { colors } = useTheme();
  const meta = [
    task.project_name ?? 'Inbox',
    task.est_minutes ? `${task.est_minutes}m` : null,
    task.energy === 'deep' ? 'deep' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale haptic="none" onPress={onDone} accessibilityLabel={`Complete ${task.title}`}>
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
            width: 26,
            height: 26,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: colors.hairlineStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Check size={13} color={colors.accent} weight="bold" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subheadMedium">{task.title}</AppText>
          <AppText variant="caption" tone="secondary">
            {meta}
          </AppText>
        </View>
        {task.priority === 2 ? <StatusPill label="P1" tone="ember" /> : null}
      </View>
    </PressableScale>
  );
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const router = useRouter();
  const userName = useSettings((s) => s.userName);

  const tasks = useLiveQuery((d) => listTodayTasks(d));
  const session = useLiveQuery((d) => getActiveSession(d));
  const stats = useLiveQuery(async (d) => ({
    today: await todayFocusMinutes(d),
    streak: await getFocusStreakDays(d),
    done: await countDoneToday(d),
  }));

  const [now, setNow] = useState(() => Date.now());
  const activeSession = session.data;
  useEffect(() => {
    if (!activeSession) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const elapsedSeconds = activeSession
    ? Math.max(0, Math.floor((now - new Date(activeSession.started_at).getTime()) / 1000))
    : 0;

  const todayMinutes = stats.data?.today ?? 0;
  const growth = Math.min(1, todayMinutes / FOCUS_GOAL_MINUTES);

  const refreshAll = () => {
    session.refresh();
    stats.refresh();
  };

  const handleStart = async () => {
    await startFocusSession(db);
    refreshAll();
  };

  const handleEnd = async () => {
    if (!activeSession) return;
    await endFocusSession(db, activeSession.id);
    if (process.env.EXPO_OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    refreshAll();
  };

  const handleDone = async (task: TaskRow) => {
    await setTaskDone(db, task.id, true);
    if (process.env.EXPO_OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    tasks.refresh();
    stats.refresh();
  };

  const subtitle =
    tasks.data && stats.data
      ? `${tasks.data.length} tasks queued · ${formatMinutes(stats.data.today)} focused today`
      : 'Loading your day…';

  return (
    <Screen header={{ eyebrow: dateEyebrow(), title: `${greeting()}, ${userName}`, subtitle }}>
      {/* Focus hero */}
      <FadeUp index={0}>
        <Panel glow coreStyle={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <ProgressRing
              progress={growth}
              size={104}
              stroke={8}
              color={activeSession ? colors.ember : colors.accent}>
              <View style={{ alignItems: 'center' }}>
                <AppText variant="numberLg">{formatMinutes(todayMinutes)}</AppText>
                <Eyebrow>today</Eyebrow>
              </View>
            </ProgressRing>
            <View style={{ flex: 1, gap: spacing.sm }}>
              {activeSession ? (
                <>
                  <Eyebrow tone="ember">focus active</Eyebrow>
                  <AppText variant="display">{formatElapsed(elapsedSeconds)}</AppText>
                  <AppButton label="End session" icon={Stop} variant="soft" onPress={handleEnd} />
                </>
              ) : (
                <>
                  <Eyebrow>focus</Eyebrow>
                  <AppText variant="title">Ready when you are.</AppText>
                  <AppButton label="Start focus" icon={Play} onPress={handleStart} />
                </>
              )}
            </View>
          </View>
        </Panel>
      </FadeUp>

      {/* Streak strip */}
      <FadeUp index={1}>
        <Panel pad="lg">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <StatColumn value={formatMinutes(todayMinutes)} label="focus today" />
            <View style={{ width: 1, height: 36, backgroundColor: colors.hairline }} />
            <StatColumn value={`${stats.data?.streak ?? 0}d`} label="streak" />
            <View style={{ width: 1, height: 36, backgroundColor: colors.hairline }} />
            <StatColumn value={String(stats.data?.done ?? 0)} label="done today" />
          </View>
        </Panel>
      </FadeUp>

      {/* Plan */}
      <FadeUp index={2}>
        <View>
          <SectionHeader eyebrow="plan" title="Today" />
          <Panel pad="xxs" coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {tasks.status === 'loading' && !tasks.data ? (
              <View style={{ padding: spacing.xxl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : tasks.data && tasks.data.length > 0 ? (
              tasks.data.map((task, index) => (
                <View key={task.id}>
                  <TaskRowItem task={task} onDone={() => handleDone(task)} />
                  {index < tasks.data!.length - 1 ? (
                    <View
                      style={{ height: 1, marginLeft: 60, backgroundColor: colors.hairline }}
                    />
                  ) : null}
                </View>
              ))
            ) : (
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
                <AppText variant="subheadMedium">Queue is clear.</AppText>
                <AppText variant="caption" tone="secondary">
                  Everything planned for today is done.
                </AppText>
              </View>
            )}
          </Panel>
        </View>
      </FadeUp>

      {/* Garden teaser */}
      <FadeUp index={3}>
        <View>
          <SectionHeader
            eyebrow="garden"
            title="Growing quietly"
            actionLabel="Open garden"
            onAction={() => router.navigate('/garden')}
          />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <GardenScene seed={11} growth={Math.max(0.08, Math.min(1, todayMinutes / FOCUS_GOAL_MINUTES))} style={{ height: 180 }} />
          </Panel>
        </View>
      </FadeUp>

      {/* Tip */}
      <FadeUp index={4}>
        <Panel coreStyle={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Eyebrow tone="ember">craft tip</Eyebrow>
            <ArrowRight size={12} color={colors.ember} weight="bold" />
          </View>
          <AppText variant="subhead" tone="secondary">
            {DAILY_TIP}
          </AppText>
        </Panel>
      </FadeUp>
    </Screen>
  );
}
