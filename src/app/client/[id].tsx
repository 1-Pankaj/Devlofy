/**
 * Client detail — the relationship page: who they are, what you're building,
 * and how much of it is done.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CaretRight, Envelope, Folder, PencilSimple, Phone, UsersThree } from 'phosphor-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import { getClient, getClientStats, listClientProjects } from '@/lib/db/repo';
import { formatShortDate } from '@/lib/format';
import { radius, spacing, useTheme } from '@/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const client = useLiveQuery((d) => getClient(d, id), { deps: [id] });
  const stats = useLiveQuery((d) => getClientStats(d, id), { deps: [id] });
  const projects = useLiveQuery((d) => listClientProjects(d, id), { deps: [id] });

  const data = client.data;
  const projectCount = stats.data?.projects ?? 0;
  const progress =
    stats.data && stats.data.tasks > 0 ? stats.data.doneTasks / stats.data.tasks : 0;
  const hasDetails = Boolean(data && (data.email || data.phone || data.notes));

  return (
    <Screen
      ambient={false}
      header={{
        eyebrow: data?.company ?? 'client',
        title: data?.name ?? 'Client',
        trailing: data ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusPill
              label={data.status}
              tone={data.status === 'active' ? 'accent' : 'neutral'}
            />
            <StatusPill
              label={`${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`}
              tone="info"
            />
            <PressableScale
              haptic="light"
              accessibilityLabel="Edit client"
              onPress={() => router.push({ pathname: '/client-form', params: { id } })}>
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
          </View>
        ) : undefined,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Work" />
        </View>
      </FadeUp>

      {client.status === 'loading' && !data ? (
        <Panel>
          <Loading label="reading the client…" />
        </Panel>
      ) : !data ? (
        <Panel>
          <EmptyState
            icon={UsersThree}
            title="Client not found"
            message="It may have been deleted on this device."
          />
        </Panel>
      ) : (
        <>
          <FadeUp index={1}>
            <Panel coreStyle={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
              <ProgressRing progress={progress} size={92} stroke={7}>
                <AppText variant="headline">{Math.round(progress * 100)}%</AppText>
              </ProgressRing>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Eyebrow>delivery</Eyebrow>
                <AppText variant="subhead">
                  {stats.data
                    ? `${stats.data.doneTasks} of ${stats.data.tasks} tasks done`
                    : 'Reading…'}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {stats.data
                    ? `${stats.data.activeProjects} active of ${stats.data.projects} projects`
                    : ''}
                </AppText>
              </View>
            </Panel>
          </FadeUp>

          <FadeUp index={2}>
            <View>
              <SectionHeader eyebrow="contact" title="Details" />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {hasDetails ? (
                  <>
                    {data.email ? (
                      <ListRow
                        icon={<Envelope size={17} color={colors.textTertiary} weight="light" />}
                        title="Email"
                        subtitle={data.email}
                        showSeparator={Boolean(data.phone || data.notes)}
                      />
                    ) : null}
                    {data.phone ? (
                      <ListRow
                        icon={<Phone size={17} color={colors.textTertiary} weight="light" />}
                        title="Phone"
                        subtitle={data.phone}
                        showSeparator={Boolean(data.notes)}
                      />
                    ) : null}
                    {data.notes ? (
                      <View style={{ padding: spacing.xl }}>
                        <AppText variant="body" tone="secondary">
                          {data.notes}
                        </AppText>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={{ padding: spacing.xl }}>
                    <AppText variant="subhead" tone="secondary">
                      No contact details yet. Everything stays on this device — add them whenever
                      the relationship needs them.
                    </AppText>
                  </View>
                )}
              </Panel>
            </View>
          </FadeUp>

          <FadeUp index={3}>
            <View>
              <SectionHeader eyebrow="portfolio" title="Projects" />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {projects.status === 'loading' && !projects.data ? (
                  <Loading label="reading the portfolio…" />
                ) : (projects.data?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={Folder}
                    title="No projects yet"
                    message="Create one from Work and attach it to this client."
                  />
                ) : (
                  projects.data!.map((project, index) => {
                    const projectProgress =
                      project.task_count > 0 ? project.done_count / project.task_count : 0;
                    const meta = [
                      project.status !== 'active' ? project.status : null,
                      project.due_date ? `due ${formatShortDate(project.due_date)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <ListRow
                        key={project.id}
                        title={project.name}
                        subtitle={meta || 'in progress'}
                        showSeparator={index < projects.data!.length - 1}
                        onPress={() =>
                          router.push({ pathname: '/project/[id]', params: { id: project.id } })
                        }
                        trailing={
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <AppText variant="caption" tone="tertiary">
                              {project.done_count}/{project.task_count}
                            </AppText>
                            <ProgressRing progress={projectProgress} size={30} stroke={3.5} />
                            <CaretRight size={14} color={colors.textTertiary} weight="bold" />
                          </View>
                        }
                      />
                    );
                  })
                )}
              </Panel>
            </View>
          </FadeUp>
        </>
      )}
    </Screen>
  );
}
