/**
 * Work — the studio, read as a ledger.
 *
 * The page opens with three figures that answer "what am I carrying?" before any
 * list does, then the portfolio itself: one row per project, with its progress
 * drawn under the name instead of hidden behind a ring only. Clients are the
 * second face of the same ledger, one segment away.
 *
 * Money and GitHub close the page because they are the two ends of the chain:
 * time becomes an invoice, work becomes a commit. Both are destinations, not
 * settings, so both are drawn as surfaces rather than rows in a menu.
 */
import { useRouter } from 'expo-router';
import {
  CaretRight,
  CurrencyCircleDollar,
  Folder,
  GithubLogo,
  Plus,
  UsersThree,
} from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Fab } from '@/components/ui/fab';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Meter } from '@/components/ui/meter';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { Stat, StatRow } from '@/components/ui/stat';
import { useLiveQuery } from '@/lib/db/hooks';
import { listClients, listProjects, listSessionsInWindow } from '@/lib/db/repo';
import { formatMinutes, formatShortDate } from '@/lib/format';
import { useGithubConnected } from '@/lib/github/use-github';
import { useBreakpoint } from '@/lib/layout/breakpoints';
import { formatHours, formatMoney, invoiceTotals, periodRange } from '@/lib/money';
import { useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

type Segment = 'projects' | 'clients';

export default function WorkScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const compact = useBreakpoint() === 'compact';
  const [segment, setSegment] = useState<Segment>('projects');

  const projects = useLiveQuery((d) => listProjects(d));
  const clients = useLiveQuery((d) => listClients(d));

  const currency = useSettings((s) => s.currency);
  const githubConnected = useGithubConnected();
  const month = useMemo(() => periodRange('month'), []);
  const monthLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: 'long' }),
    [],
  );
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
      {/* The ledger head. Three figures, one rule between each — no card inside a
          card, no separate hero. */}
      <FadeUp index={0}>
        <Panel pad="lg">
          {projects.status === 'error' && !projects.data ? (
            <ErrorState what="your studio figures" onRetry={() => projects.refresh()} compact />
          ) : (
            <View style={{ gap: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <Eyebrow>carrying</Eyebrow>
                <AppText variant="code" tone="tertiary">
                  {monthLabel}
                </AppText>
              </View>
              <StatRow>
                {/* Three figures share a 390px row. "active projects" wraps the
                    mono label into two lines there and nothing else does, so the
                    phone gets the terse form; the page below already says which
                    projects. */}
                <Stat
                  label={compact ? 'active' : 'active projects'}
                  value={activeProjects}
                  variant={compact ? 'numberMd' : 'numberLg'}
                />
                <Stat
                  label="clients"
                  value={clients.data?.length ?? 0}
                  variant={compact ? 'numberMd' : 'numberLg'}
                />
                <Stat
                  label="billable"
                  value={billed.amount}
                  format={(value) => formatMoney(value, currency).replace(/\.00$/, '')}
                  variant={compact ? 'numberMd' : 'numberLg'}
                />
              </StatRow>
            </View>
          )}
        </Panel>
      </FadeUp>

      <FadeUp index={1}>
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
        <FadeUp index={2}>
          <View>
            <SectionHeader
              eyebrow="portfolio"
              title="Projects"
              trailing={
                projects.data && projects.data.length > 0 ? (
                  <AppText variant="code" tone="tertiary">
                    {projects.data.length} total
                  </AppText>
                ) : undefined
              }
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {projects.status === 'loading' && !projects.data ? (
                <Loading label="reading the portfolio…" />
              ) : projects.status === 'error' && !projects.data ? (
                <ErrorState what="projects" onRetry={() => projects.refresh()} />
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
                      footer={
                        project.task_count > 0 ? (
                          <View
                            style={{
                              gap: 4,
                              paddingTop: 2,
                              paddingRight: spacing.xl,
                            }}>
                            <Meter value={progress} height={3} />
                          </View>
                        ) : undefined
                      }
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ alignItems: 'flex-end', gap: 1 }}>
                            <AppText variant="code" tone="secondary">
                              {project.done_count}/{project.task_count}
                            </AppText>
                            <AppText variant="monoLabel" tone="tertiary" style={{ fontSize: 9 }}>
                              tasks
                            </AppText>
                          </View>
                          <CaretRight size={13} color={colors.textTertiary} weight="bold" />
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
        <FadeUp index={2}>
          <View>
            <SectionHeader
              eyebrow="relationships"
              title="Clients"
              trailing={
                clients.data && clients.data.length > 0 ? (
                  <AppText variant="code" tone="tertiary">
                    {clients.data.length} total
                  </AppText>
                ) : undefined
              }
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {clients.status === 'loading' && !clients.data ? (
                <Loading label="reading the roster…" />
              ) : clients.status === 'error' && !clients.data ? (
                <ErrorState what="clients" onRetry={() => clients.refresh()} />
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <StatusPill
                          label={client.status}
                          tone={client.status === 'active' ? 'accent' : 'neutral'}
                        />
                        <CaretRight size={13} color={colors.textTertiary} weight="bold" />
                      </View>
                    }
                  />
                ))
              )}
            </Panel>
          </View>
        </FadeUp>
      )}

      {/* Money: a statement, not a row. It is the one place on this page where a
          single figure is the whole story, so it gets to be big. */}
      <FadeUp index={3}>
        <View>
          <SectionHeader eyebrow="money" title="Billing" />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <PressableScale
              haptic="light"
              accessibilityLabel="Open the invoice draft"
              onPress={() => router.push('/invoice')}>
              <View style={{ padding: spacing.lg, gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: spacing.md,
                  }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, flex: 1 }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: radius.md,
                        borderCurve: 'continuous',
                        backgroundColor: colors.accentSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <CurrencyCircleDollar size={16} color={colors.accent} weight="regular" />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <AppText variant="headline">Invoice draft</AppText>
                      <AppText variant="caption" tone="tertiary">
                        {billed.sessions > 0
                          ? `${formatHours(billed.minutes)} across ${billed.sessions} ${
                              billed.sessions === 1 ? 'session' : 'sessions'
                            }`
                          : 'No rated time this month yet'}
                      </AppText>
                    </View>
                  </View>
                  <CaretRight
                    size={13}
                    color={colors.textTertiary}
                    weight="bold"
                    style={{ marginTop: 8 }}
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: spacing.md,
                    paddingTop: spacing.md,
                    borderTopWidth: 1,
                    borderTopColor: colors.hairline,
                  }}>
                  <AppText
                    variant="title"
                    style={{ color: billed.sessions > 0 ? colors.text : colors.textTertiary }}>
                    {formatMoney(billed.amount, currency)}
                  </AppText>
                  <AppText variant="code" tone="tertiary">
                    {billed.sessions > 0 ? 'this month' : 'nothing billable'}
                  </AppText>
                </View>
              </View>
            </PressableScale>
          </Panel>
        </View>
      </FadeUp>

      {/* The one surface that reads the outside world. It reads *and* writes —
          edits commit to a branch and open a pull request (ADR-020). */}
      <FadeUp index={4}>
        <View>
          <SectionHeader eyebrow="code" title="GitHub" />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <ListRow
              icon={<GithubLogo size={17} color={colors.accent} weight="regular" />}
              tone="accent"
              title="GitHub"
              subtitle={
                githubConnected === true
                  ? 'Connected · repos, edits, reviews and checks'
                  : 'Browse code, edit a file, review and merge, triage issues'
              }
              onPress={() => router.push('/github')}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <StatusPill
                    label={githubConnected === true ? 'connected' : 'open'}
                    tone={githubConnected === true ? 'accent' : 'neutral'}
                  />
                  <CaretRight size={13} color={colors.textTertiary} weight="bold" />
                </View>
              }
            />
          </Panel>
        </View>
      </FadeUp>
    </Screen>
  );
}
