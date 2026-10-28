/**
 * Project detail — progress, milestones, tasks.
 *
 * The page is a dossier: the title and its facts, one progress instrument, then
 * the two lists that explain it. Progress is stated twice on purpose — a figure
 * for reading and a meter for feeling — because "18 of 43" and a bar that is
 * less than half full answer different questions.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Check, PencilSimple } from 'phosphor-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { ErrorState } from '@/components/ui/error-state';
import { Meter } from '@/components/ui/meter';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill, type StatusTone } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { Stat, StatRow } from '@/components/ui/stat';
import { useLiveQuery } from '@/lib/db/hooks';
import { getProject, listMilestones, listProjectTasks, setTaskDone } from '@/lib/db/repo';
import { formatMinutes, formatShortDate } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const currency = useSettings((s) => s.currency);

  const project = useLiveQuery((d) => getProject(d, id), { deps: [id] });
  const milestones = useLiveQuery((d) => listMilestones(d, id), { deps: [id] });
  const tasks = useLiveQuery((d) => listProjectTasks(d, id), { deps: [id] });

  const data = project.data;
  const progress = data && data.task_count > 0 ? data.done_count / data.task_count : 0;
  const stackTags: string[] = (() => {
    if (!data?.stack_tags) return [];
    try {
      const value = JSON.parse(data.stack_tags) as unknown;
      return Array.isArray(value) ? value.map(String) : [];
    } catch {
      return data.stack_tags
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
  })();

  const toggleTask = async (taskId: string, done: boolean) => {
    await setTaskDone(db, taskId, !done);
    tasks.refresh();
    project.refresh();
  };

  // Project facts are content, not chrome: they live under the title so the
  // header's trailing slot stays an action slot.
  const facts: { label: string; tone: StatusTone }[] = [];
  if (data) {
    facts.push({
      label: data.status,
      tone: data.status === 'active' ? 'accent' : 'neutral',
    });
    if (data.due_date) {
      facts.push({ label: `due ${formatShortDate(data.due_date)}`, tone: 'ember' });
    }
    // The rate is a fact about the project, so it sits with the other facts.
    // A project rate wins; the client's is shown as the inherited case.
    if (data.hourly_rate != null) {
      facts.push({ label: `${formatMoney(data.hourly_rate, currency)}/h`, tone: 'accent' });
    } else if (data.client_rate != null) {
      facts.push({
        label: `${formatMoney(data.client_rate, currency)}/h from client`,
        tone: 'neutral',
      });
    }
    stackTags.forEach((tag) => facts.push({ label: tag, tone: 'info' }));
  }

  const milestonesHit = (milestones.data ?? []).filter((m) => m.status === 'hit').length;

  return (
    <Screen
      header={{
        eyebrow: data?.client_name ?? 'Personal project',
        title: data?.name ?? 'Project',
        subtitle: data?.description ?? undefined,
        trailing: data ? (
          <PressableScale
            haptic="light"
            accessibilityLabel="Edit project"
            onPress={() => router.push({ pathname: '/project-form', params: { id } })}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: colors.hairline,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}>
              <PencilSimple size={15} color={colors.textSecondary} weight="regular" />
            </View>
          </PressableScale>
        ) : null,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow />
        </View>
      </FadeUp>

      {facts.length > 0 ? (
        <FadeUp index={0}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {facts.map((fact) => (
              <StatusPill key={fact.label} label={fact.label} tone={fact.tone} />
            ))}
          </View>
        </FadeUp>
      ) : null}

      <FadeUp index={1}>
        {project.status === 'error' && !data ? (
          <Panel>
            <ErrorState what="this project" onRetry={() => project.refresh()} />
          </Panel>
        ) : (
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.lg,
                }}>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <Eyebrow>progress</Eyebrow>
                  <AppText variant="numberXl">{Math.round(progress * 100)}%</AppText>
                  <AppText variant="code" tone="tertiary">
                    {data ? `${data.done_count} of ${data.task_count} tasks done` : 'loading…'}
                  </AppText>
                </View>
                <ProgressRing
                  progress={progress}
                  size={72}
                  stroke={6}
                  trackColor={colors.surfaceSunken}
                />
              </View>

              <Meter value={progress} height={6} />
            </View>

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
                backgroundColor: colors.surfaceElevated,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <StatRow>
                <Stat
                  label="focused"
                  value={data?.focus_minutes ?? 0}
                  format={formatMinutes}
                  variant="headline"
                />
                <Stat label="sessions" value={data?.focus_sessions ?? 0} variant="headline" />
                <Stat
                  label="milestones"
                  value={milestonesHit}
                  format={(value) => `${value}/${milestones.data?.length ?? 0}`}
                  variant="headline"
                />
              </StatRow>
            </View>
          </Panel>
        )}
      </FadeUp>

      {milestones.status === 'error' && !milestones.data ? (
        <FadeUp index={2}>
          <View>
            <SectionHeader eyebrow="timeline" title="Milestones" />
            <Panel>
              <ErrorState what="milestones" onRetry={() => milestones.refresh()} />
            </Panel>
          </View>
        </FadeUp>
      ) : milestones.data && milestones.data.length > 0 ? (
        <FadeUp index={2}>
          <View>
            <SectionHeader
              eyebrow="timeline"
              title="Milestones"
              trailing={
                <AppText variant="code" tone="tertiary">
                  {milestonesHit}/{milestones.data.length} hit
                </AppText>
              }
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {milestones.data.map((milestone, index) => {
                const hit = milestone.status === 'hit';
                return (
                  <View key={milestone.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.md,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.md,
                        minHeight: 52,
                      }}>
                      {/* A timeline dot, not a checkbox: milestones are events. */}
                      <View
                        style={{
                          width: 30,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <View
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: radius.full,
                            borderWidth: hit ? 0 : 1.5,
                            borderColor: colors.hairlineStrong,
                            backgroundColor: hit ? colors.accent : 'transparent',
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="subheadMedium">{milestone.title}</AppText>
                        <AppText variant="code" tone="tertiary" style={{ fontSize: 10.5 }}>
                          {milestone.due_date ? formatShortDate(milestone.due_date) : 'no date'}
                        </AppText>
                      </View>
                      <StatusPill
                        label={hit ? 'hit' : 'pending'}
                        tone={hit ? 'accent' : 'neutral'}
                      />
                    </View>
                    {index < milestones.data!.length - 1 ? (
                      <View style={{ height: 1, marginLeft: spacing.md + 30 + spacing.md, backgroundColor: colors.hairline }} />
                    ) : null}
                  </View>
                );
              })}
            </Panel>
          </View>
        </FadeUp>
      ) : null}

      <FadeUp index={3}>
        <View>
          <SectionHeader
            eyebrow="execution"
            title="Tasks"
            trailing={
              tasks.data && tasks.data.length > 0 ? (
                <AppText variant="code" tone="tertiary">
                  {tasks.data.filter((task) => task.status !== 'done').length} open
                </AppText>
              ) : undefined
            }
          />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {tasks.status === 'error' && !tasks.data ? (
              <ErrorState what="tasks" onRetry={() => tasks.refresh()} />
            ) : tasks.data && tasks.data.length > 0 ? (
              tasks.data.map((task, index) => {
                const done = task.status === 'done';
                return (
                  <View key={task.id}>
                    <PressableScale
                      haptic="light"
                      onPress={() => toggleTask(task.id, done)}
                      accessibilityLabel={`${done ? 'Reopen' : 'Complete'} ${task.title}`}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.md,
                          paddingHorizontal: spacing.md,
                          paddingVertical: 11,
                          minHeight: 50,
                        }}>
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: radius.xs,
                            borderWidth: 1.2,
                            borderColor: done ? colors.accent : colors.hairlineStrong,
                            backgroundColor: done ? colors.accent : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          {done ? <Check size={11} color={colors.accentContrast} weight="bold" /> : null}
                        </View>
                        <AppText
                          variant="subheadMedium"
                          style={{
                            flex: 1,
                            color: done ? colors.textTertiary : colors.text,
                            textDecorationLine: done ? 'line-through' : 'none',
                          }}>
                          {task.title}
                        </AppText>
                        {task.est_minutes ? (
                          <AppText variant="code" tone="tertiary">
                            {task.est_minutes}m
                          </AppText>
                        ) : null}
                      </View>
                    </PressableScale>
                    {index < tasks.data!.length - 1 ? (
                      <View
                        style={{
                          height: 1,
                          marginLeft: spacing.md + 18 + spacing.md,
                          backgroundColor: colors.hairline,
                        }}
                      />
                    ) : null}
                  </View>
                );
              })
            ) : (
              <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
                <AppText variant="subheadMedium">No tasks yet.</AppText>
                <AppText variant="caption" tone="secondary">
                  Break the next milestone into its first real task.
                </AppText>
              </View>
            )}
          </Panel>
        </View>
      </FadeUp>
    </Screen>
  );
}
