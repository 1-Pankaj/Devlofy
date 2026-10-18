/**
 * Work — projects and clients. One segment control, two grouped lists.
 * Loading shows a quiet reader instead of flashing an empty state; clients
 * open their detail page.
 */
import { useRouter } from 'expo-router';
import {
  CaretRight,
  CurrencyCircleDollar,
  Folder,
  Plus,
  UsersThree,
} from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
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
import { listClients, listProjects, listSessionsInWindow } from '@/lib/db/repo';
import { formatMinutes, formatShortDate } from '@/lib/format';
import { formatHours, formatMoney, invoiceTotals, periodRange } from '@/lib/money';
import { useSettings } from '@/state/settings';
import { spacing, useTheme } from '@/theme';

type Segment = 'projects' | 'clients';

export default function WorkScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('projects');

  const projects = useLiveQuery((d) => listProjects(d));
  const clients = useLiveQuery((d) => listClients(d));

  const currency = useSettings((s) => s.currency);
  const month = useMemo(() => periodRange('month'), []);
  const draft = useLiveQuery(
    (d) => listSessionsInWindow(d, month.from.toISOString(), month.to.toISOString()),
    { deps: [] },
  );
  const billed = useMemo(() => invoiceTotals(draft.data ?? []), [draft.data]);

  const activeProjects = (projects.data ?? []).filter((p) => p.status === 'active').length;
  const subtitle =
    projects.status === 'ready' && clients.status === 'ready'
      ? `${activeProjects} active · ${clients.data?.length ?? 0} clients`
      : undefined;

  return (
    <Screen
      header={{ eyebrow: 'studio', title: 'Work', subtitle }}
      fab={
        <Fab
          label={segment === 'projects' ? 'New project' : 'New client'}
          icon={Plus}
          onPress={() =>
            router.push(segment === 'projects' ? '/project-form' : '/client-form')
          }
        />
      }>
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
            <SectionHeader eyebrow="portfolio" title="Projects" />
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
                    project.client_name ?? 'No client',
                    project.status !== 'active' ? project.status : null,
                    project.due_date ? `due ${formatShortDate(project.due_date)}` : null,
                    project.focus_minutes > 0 ? `${formatMinutes(project.focus_minutes)} tracked` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <ListRow
                      key={project.id}
                      title={project.name}
                      subtitle={meta}
                      avatar={project.client_name ?? project.name}
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
            <SectionHeader eyebrow="relationships" title="Clients" />
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
                    avatar={client.name}
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

      {/* The money end of the chain, in one row — it is a draft, so it belongs
          next to the work it came from rather than in its own tab. */}
      <FadeUp index={2}>
        <View>
          <SectionHeader eyebrow="money" title="Billing" />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <ListRow
              icon={<CurrencyCircleDollar size={17} color={colors.accent} weight="light" />}
              tone="accent"
              title="Invoice draft"
              subtitle={
                billed.sessions > 0
                  ? `${formatHours(billed.minutes)} billable this month`
                  : 'No rated time this month yet'
              }
              onPress={() => router.push('/invoice')}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {billed.sessions > 0 ? (
                    <AppText variant="mono" tone="secondary">
                      {formatMoney(billed.amount, currency)}
                    </AppText>
                  ) : null}
                  <CaretRight size={14} color={colors.textTertiary} weight="bold" />
                </View>
              }
            />
          </Panel>
        </View>
      </FadeUp>
    </Screen>
  );
}
