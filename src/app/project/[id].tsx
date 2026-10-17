/**
 * Project detail — progress, milestones, tasks.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Check, PencilSimple } from 'phosphor-react-native';
import { View } from 'react-native';

import { BackRow } from '@/components/ui/back-button';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import { getProject, listMilestones, listProjectTasks, setTaskDone } from '@/lib/db/repo';
import { formatShortDate } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

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

  return (
    <Screen
      ambient={false}
      header={{
        eyebrow: data?.client_name ?? 'Personal',
        title: data?.name ?? 'Project',
        subtitle: data?.description ?? undefined,
        trailing: (
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
            {data ? (
              <StatusPill
                label={data.status}
                tone={data.status === 'active' ? 'accent' : 'neutral'}
              />
            ) : null}
            {data?.due_date ? (
              <StatusPill label={`due ${formatShortDate(data.due_date)}`} tone="ember" />
            ) : null}
            {stackTags.map((tag) => (
              <StatusPill key={tag} label={tag} tone="info" />
            ))}
            {data ? (
              <PressableScale
                haptic="light"
                accessibilityLabel="Edit project"
                onPress={() => router.push({ pathname: '/project-form', params: { id } })}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                  }}>
                  <PencilSimple size={15} color={colors.textSecondary} weight="regular" />
                </View>
              </PressableScale>
            ) : null}
          </View>
        ),
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow />
        </View>
      </FadeUp>

      <FadeUp index={1}>
        <Panel coreStyle={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
          <ProgressRing progress={progress} size={92} stroke={7}>
            <AppText variant="headline">{Math.round(progress * 100)}%</AppText>
          </ProgressRing>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Eyebrow>progress</Eyebrow>
            <AppText variant="subhead">
              {data ? `${data.done_count} of ${data.task_count} tasks done` : 'Loading…'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {milestones.data && milestones.data.length > 0
                ? `${milestones.data.filter((m) => m.status === 'hit').length}/${milestones.data.length} milestones hit`
                : 'No milestones set'}
            </AppText>
          </View>
        </Panel>
      </FadeUp>

      {milestones.data && milestones.data.length > 0 ? (
        <FadeUp index={2}>
          <View>
            <SectionHeader eyebrow="timeline" title="Milestones" />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {milestones.data.map((milestone, index) => (
                <View key={milestone.id}>
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
                        borderColor:
                          milestone.status === 'hit' ? colors.accentBorder : colors.hairlineStrong,
                        backgroundColor:
                          milestone.status === 'hit' ? colors.accentSoft : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {milestone.status === 'hit' ? (
                        <Check size={13} color={colors.accent} weight="bold" />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="subheadMedium">{milestone.title}</AppText>
                      <AppText variant="caption" tone="secondary">
                        {milestone.due_date ? formatShortDate(milestone.due_date) : 'No date'}
                      </AppText>
                    </View>
                    <StatusPill
                      label={milestone.status === 'hit' ? 'hit' : 'pending'}
                      tone={milestone.status === 'hit' ? 'accent' : 'neutral'}
                    />
                  </View>
                  {index < milestones.data!.length - 1 ? (
                    <View style={{ height: 1, marginLeft: 62, backgroundColor: colors.hairline }} />
                  ) : null}
                </View>
              ))}
            </Panel>
          </View>
        </FadeUp>
      ) : null}

      <FadeUp index={3}>
        <View>
          <SectionHeader eyebrow="execution" title="Tasks" />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {tasks.data && tasks.data.length > 0 ? (
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
                          paddingHorizontal: spacing.lg,
                          paddingVertical: spacing.md,
                        }}>
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: radius.full,
                            borderWidth: 1.5,
                            borderColor: done ? colors.accentBorder : colors.hairlineStrong,
                            backgroundColor: done ? colors.accentSoft : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          {done ? <Check size={13} color={colors.accent} weight="bold" /> : null}
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
                          <AppText variant="mono" tone="tertiary">
                            {task.est_minutes}m
                          </AppText>
                        ) : null}
                      </View>
                    </PressableScale>
                    {index < tasks.data!.length - 1 ? (
                      <View style={{ height: 1, marginLeft: 62, backgroundColor: colors.hairline }} />
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
