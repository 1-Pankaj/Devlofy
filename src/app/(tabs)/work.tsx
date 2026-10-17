/**
 * Work — projects and clients. One segment control, two grouped lists.
 * Loading shows a quiet reader instead of flashing an empty state; clients
 * open their detail page.
 */
import { useRouter } from 'expo-router';
import { CaretRight, Folder, UsersThree } from 'phosphor-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import { listClients, listProjects } from '@/lib/db/repo';
import { formatShortDate } from '@/lib/format';
import { spacing, useTheme } from '@/theme';

type Segment = 'projects' | 'clients';

export default function WorkScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('projects');

  const projects = useLiveQuery((d) => listProjects(d));
  const clients = useLiveQuery((d) => listClients(d));

  const activeProjects = (projects.data ?? []).filter((p) => p.status === 'active').length;
  const subtitle =
    projects.status === 'ready' && clients.status === 'ready'
      ? `${activeProjects} active · ${clients.data?.length ?? 0} clients`
      : undefined;

  return (
    <Screen header={{ eyebrow: 'studio', title: 'Work', subtitle }}>
      <FadeUp index={0}>
        <Segmented<Segment>
          options={[
            { value: 'projects', label: 'Projects' },
            { value: 'clients', label: 'Clients' },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </FadeUp>

      {segment === 'projects' ? (
        <FadeUp index={1}>
          <View>
            <SectionHeader
              eyebrow="portfolio"
              title="Projects"
              actionLabel="New project"
              onAction={() => router.push('/project-form')}
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {projects.status === 'loading' && !projects.data ? (
                <Loading label="reading the portfolio…" />
              ) : projects.status === 'error' && !projects.data ? (
                <View style={{ padding: spacing.xl, gap: spacing.sm }}>
                  <AppText variant="subheadMedium" tone="danger">
                    Could not read projects.
                  </AppText>
                  <PressableScale haptic="selection" onPress={() => projects.refresh()}>
                    <AppText variant="captionMedium" tone="accent">
                      Retry
                    </AppText>
                  </PressableScale>
                </View>
              ) : (projects.data?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Folder}
                  image={emptyArt.projects}
                  title="No projects yet"
                  message="Projects hold tasks, milestones and the story of a build."
                />
              ) : (
                projects.data!.map((project, index) => {
                  const progress =
                    project.task_count > 0 ? project.done_count / project.task_count : 0;
                  const meta = [
                    project.client_name ?? 'Personal',
                    project.status !== 'active' ? project.status : null,
                    project.due_date ? `due ${formatShortDate(project.due_date)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <ListRow
                      key={project.id}
                      title={project.name}
                      subtitle={meta}
                      showSeparator={index < projects.data!.length - 1}
                      onPress={() =>
                        router.push({ pathname: '/project/[id]', params: { id: project.id } })
                      }
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <AppText variant="caption" tone="tertiary">
                            {project.done_count}/{project.task_count}
                          </AppText>
                          <ProgressRing progress={progress} size={30} stroke={3.5} />
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
      ) : (
        <FadeUp index={1}>
          <View>
            <SectionHeader
              eyebrow="relationships"
              title="Clients"
              actionLabel="New client"
              onAction={() => router.push('/client-form')}
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {clients.status === 'loading' && !clients.data ? (
                <Loading label="reading the roster…" />
              ) : clients.status === 'error' && !clients.data ? (
                <View style={{ padding: spacing.xl, gap: spacing.sm }}>
                  <AppText variant="subheadMedium" tone="danger">
                    Could not read clients.
                  </AppText>
                  <PressableScale haptic="selection" onPress={() => clients.refresh()}>
                    <AppText variant="captionMedium" tone="accent">
                      Retry
                    </AppText>
                  </PressableScale>
                </View>
              ) : (clients.data?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={UsersThree}
                  image={emptyArt.clients}
                  title="No clients yet"
                  message="Add the people you build for — projects attach to them."
                />
              ) : (
                clients.data!.map((client, index) => (
                  <ListRow
                    key={client.id}
                    icon={<UsersThree size={17} color={colors.info} weight="light" />}
                    title={client.name}
                    subtitle={[client.company, `${client.project_count} projects`]
                      .filter(Boolean)
                      .join(' · ')}
                    showSeparator={index < clients.data!.length - 1}
                    onPress={() =>
                      router.push({ pathname: '/client/[id]', params: { id: client.id } })
                    }
                    trailing={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <StatusPill
                          label={client.status}
                          tone={client.status === 'active' ? 'accent' : 'neutral'}
                        />
                        <CaretRight size={14} color={colors.textTertiary} weight="bold" />
                      </View>
                    }
                  />
                ))
              )}
            </Panel>
          </View>
        </FadeUp>
      )}
    </Screen>
  );
}
