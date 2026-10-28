/**
 * Client detail — the relationship page: who they are, what you're building,
 * and how much of it is done.
 *
 * Same dossier as a project: one delivery instrument, the facts, the portfolio
 * that belongs to them, and the money that came out of it. Contact details are
 * rows, not cards — the notes are the only prose on the page, so they get the
 * only block of quiet space.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CaretRight,
  CurrencyCircleDollar,
  Envelope,
  Folder,
  PencilSimple,
  Phone,
  UsersThree,
} from 'phosphor-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Meter } from '@/components/ui/meter';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { Stat, StatRow } from '@/components/ui/stat';
import { useLiveQuery } from '@/lib/db/hooks';
import { getClient, getClientStats, listClientProjects, listSessionsInWindow } from '@/lib/db/repo';
import { formatShortDate } from '@/lib/format';
import { formatHours, formatMoney, invoiceTotals, periodRange } from '@/lib/money';
import { useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const currency = useSettings((s) => s.currency);

  const client = useLiveQuery((d) => getClient(d, id), { deps: [id] });
  const stats = useLiveQuery((d) => getClientStats(d, id), { deps: [id] });
  const projects = useLiveQuery((d) => listClientProjects(d, id), { deps: [id] });

  const allTime = useMemo(() => periodRange('all'), []);
  const billable = useLiveQuery(
    (d) => listSessionsInWindow(d, allTime.from.toISOString(), allTime.to.toISOString(), id),
    { deps: [id] },
  );
  const billed = useMemo(() => invoiceTotals(billable.data ?? []), [billable.data]);

  const data = client.data;
  const projectCount = stats.data?.projects ?? 0;
  const progress =
    stats.data && stats.data.tasks > 0 ? stats.data.doneTasks / stats.data.tasks : 0;
  const hasDetails = Boolean(data && (data.email || data.phone || data.notes));

  return (
    <Screen
      header={{
        eyebrow: data?.company ?? 'client',
        title: data?.name ?? 'Client',
        trailing: data ? (
          <PressableScale
            haptic="light"
            accessibilityLabel="Edit client"
            onPress={() => router.push({ pathname: '/client-form', params: { id } })}>
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
        ) : undefined,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Work" />
        </View>
      </FadeUp>

      {data ? (
        <FadeUp index={0}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            <StatusPill
              label={data.status}
              tone={data.status === 'active' ? 'accent' : 'neutral'}
            />
            <StatusPill
              label={`${projectCount} ${projectCount === 1 ? 'project' : 'projects'}`}
              tone="info"
            />
            {data.hourly_rate != null ? (
              <StatusPill
                label={`${formatMoney(data.hourly_rate, currency)}/h`}
                tone="accent"
              />
            ) : null}
          </View>
        </FadeUp>
      ) : null}

      {client.status === 'loading' && !data ? (
        <Panel>
          <Loading label="reading the client…" />
        </Panel>
      ) : client.status === 'error' && !data ? (
        <Panel>
          <ErrorState what="this client" onRetry={() => client.refresh()} />
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
                    <Eyebrow>delivery</Eyebrow>
                    {stats.status === 'error' && !stats.data ? (
                      <PressableScale haptic="selection" onPress={() => stats.refresh()}>
                        <AppText variant="captionMedium" tone="accent">
                          Could not read delivery — retry
                        </AppText>
                      </PressableScale>
                    ) : (
                      <>
                        <AppText variant="numberXl">{Math.round(progress * 100)}%</AppText>
                        <AppText variant="code" tone="tertiary">
                          {stats.data
                            ? `${stats.data.doneTasks} of ${stats.data.tasks} tasks done`
                            : 'reading…'}
                        </AppText>
                      </>
                    )}
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
                    label="active"
                    value={stats.data?.activeProjects ?? 0}
                    variant="headline"
                  />
                  <Stat
                    label="projects"
                    value={projectCount}
                    variant="headline"
                  />
                  <Stat
                    label="billable"
                    value={billed.amount}
                    format={(value) => formatMoney(value, currency).replace(/\.00$/, '')}
                    variant="headline"
                  />
                </StatRow>
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
                        icon={<Envelope size={16} color={colors.textTertiary} weight="regular" />}
                        title="Email"
                        subtitle={data.email}
                        showSeparator={Boolean(data.phone || data.notes)}
                      />
                    ) : null}
                    {data.phone ? (
                      <ListRow
                        icon={<Phone size={16} color={colors.textTertiary} weight="regular" />}
                        title="Phone"
                        subtitle={data.phone}
                        showSeparator={Boolean(data.notes)}
                      />
                    ) : null}
                    {data.notes ? (
                      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
                        <Eyebrow>notes</Eyebrow>
                        <AppText variant="body" tone="secondary">
                          {data.notes}
                        </AppText>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={{ padding: spacing.xl, gap: spacing.xs }}>
                    <AppText variant="subheadMedium">No contact details yet.</AppText>
                    <AppText variant="caption" tone="secondary">
                      Everything stays on this device — add them whenever the relationship needs
                      them.
                    </AppText>
                  </View>
                )}
              </Panel>
            </View>
          </FadeUp>

          <FadeUp index={3}>
            <View>
              <SectionHeader
                eyebrow="portfolio"
                title="Projects"
                trailing={
                  projects.data && projects.data.length > 0 ? (
                    <AppText variant="code" tone="tertiary">
                      {projects.data.length}
                    </AppText>
                  ) : undefined
                }
              />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {projects.status === 'loading' && !projects.data ? (
                  <Loading label="reading the portfolio…" />
                ) : projects.status === 'error' && !projects.data ? (
                  <ErrorState what="this client's projects" onRetry={() => projects.refresh()} />
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
                        footer={
                          project.task_count > 0 ? (
                            <View style={{ gap: 4, paddingTop: 2, paddingRight: spacing.xl }}>
                              <Meter value={projectProgress} height={3} />
                            </View>
                          ) : undefined
                        }
                        trailing={
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <AppText variant="code" tone="secondary">
                              {project.done_count}/{project.task_count}
                            </AppText>
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

          <FadeUp index={4}>
            <View>
              <SectionHeader eyebrow="money" title="Billing" />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                <PressableScale
                  haptic="light"
                  accessibilityLabel="Open the client's invoice draft"
                  onPress={() => router.push({ pathname: '/invoice', params: { clientId: id } })}>
                  <View style={{ padding: spacing.lg, gap: spacing.md }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: spacing.md,
                      }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm + 2,
                          flex: 1,
                        }}>
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
                          <AppText variant="headline">Draft invoice</AppText>
                          <AppText variant="caption" tone="tertiary">
                            {billed.sessions > 0
                              ? `${formatHours(billed.minutes)} across ${billed.sessions} blocks`
                              : 'No rated time yet — set a rate on them or a project'}
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
                        style={{
                          color: billed.sessions > 0 ? colors.text : colors.textTertiary,
                        }}>
                        {formatMoney(billed.amount, currency)}
                      </AppText>
                      <AppText variant="code" tone="tertiary">
                        all time
                      </AppText>
                    </View>
                  </View>
                </PressableScale>
              </Panel>
            </View>
          </FadeUp>
        </>
      )}
    </Screen>
  );
}
