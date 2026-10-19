/**
 * One target — its standing, its history, and the log behind both.
 *
 * Everything on this screen is derived from the stored checks by the pure
 * functions in `src/lib/sentinel/status.ts`: the window figures, the incident
 * runs, the spread, the sparkline. Nothing is cached in another shape, so the
 * numbers cannot disagree with the rows they came from.
 *
 * The reliability block is careful about one word. "Uptime" over a window counts
 * *the checks taken*, and says so out loud ("of 12 checks"), because this app
 * watches while you look and would otherwise imply minute-by-minute monitoring
 * it does not do.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ArrowsClockwise, ClockCounterClockwise, PencilSimple, WarningCircle } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LatencyChart } from '@/components/sentinel/latency-chart';
import { AppButton } from '@/components/ui/app-button';
import { AppText, type TextTone } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill, type StatusTone } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { deleteWatchSite } from '@/lib/db/repo';
import {
  formatAgo,
  formatMs,
  formatPercent,
  formatSpan,
  hostOf,
  incidentsIn,
  latencyStats,
  minutesSince,
  uptimeIn,
  verdictLabel,
  type CheckLike,
  type Verdict,
} from '@/lib/sentinel/status';
import { useWatchSite } from '@/lib/sentinel/use-sentinel';
import { radius, spacing, useTheme } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;
const POINTS = 60;

type Range = '24h' | '7d' | '30d';

const RANGES: { value: Range; label: string; days: number }[] = [
  { value: '24h', label: '24 hours', days: 1 },
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
];

/** The board's verdict vocabulary, in the pill's tones. */
function verdictTone(verdict: Verdict | null): StatusTone {
  if (verdict === 'down') return 'danger';
  if (verdict === 'slow') return 'ember';
  if (verdict === 'up') return 'accent';
  return 'neutral';
}

function toneInk(verdict: Verdict | null): TextTone {
  if (verdict === 'down') return 'danger';
  if (verdict === 'slow') return 'ember';
  if (verdict === 'up') return 'accent';
  return 'tertiary';
}

/** A label over a figure — the screen has four of these, so it has one of these. */
function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: TextTone }) {
  return (
    <View style={{ minWidth: 96, flexGrow: 1, gap: 2 }}>
      <Eyebrow>{label}</Eyebrow>
      <AppText variant="headline" tone={tone}>
        {value}
      </AppText>
    </View>
  );
}

export default function WatchTargetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const view = useWatchSite(id);
  const [range, setRange] = useState<Range>('24h');
  const [confirming, setConfirming] = useState(false);
  // A clock the render can read: everything relative on this screen ("3m ago",
  // "the last 24 hours") is derived from one value that ticks slowly, rather than
  // from `Date.now()` mid-render — which is how a component stops being a
  // function of its inputs. Thirty seconds is finer than any label here shows.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const site = view.site;
  const checks = view.checks;

  if (view.status === 'loading') {
    return (
      <Screen header={{ eyebrow: 'Sentinel', title: 'Target' }}>
        <Loading label="reading the check log…" />
      </Screen>
    );
  }

  if (view.status === 'error') {
    return (
      <Screen header={{ eyebrow: 'Sentinel', title: 'Target' }}>
        <Panel>
          <ErrorState what="this target" onRetry={view.refresh} compact />
        </Panel>
      </Screen>
    );
  }

  if (view.status === 'missing' || !site) {
    return (
      <Screen header={{ eyebrow: 'Sentinel', title: 'No longer watched' }}>
        <BackRow label="Sentinel" />
        <EmptyState
          icon={ClockCounterClockwise}
          title="This target no longer exists"
          message="It was deleted on this device, so its check log went with it."
        />
      </Screen>
    );
  }

  const days = RANGES.find((option) => option.value === range)?.days ?? 1;
  const sinceMs = now - days * DAY_MS;
  const stats = uptimeIn(checks, sinceMs);
  const latency = latencyStats(checks.filter((check) => Date.parse(check.checked_at) >= sinceMs));
  const incidents = incidentsIn(checks).reverse();
  const latest = checks[0] ?? null;
  const spark: CheckLike[] = checks.slice(0, POINTS).reverse();
  const paused = site.enabled !== 1;

  const deleteTarget = async () => {
    await deleteWatchSite(db, site.id);
    router.back();
  };

  return (
    <Screen
      header={{
        eyebrow: hostOf(site.url),
        title: site.name,
        subtitle: site.url,
      }}>
      <FadeUp index={0}>
        <BackRow label="Sentinel" />
      </FadeUp>

      <FadeUp index={1}>
        <Panel pad="lg" style={{ gap: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}>
            <StatusPill
              label={
                paused
                  ? 'paused'
                  : latest
                    ? verdictLabel(latest.verdict, latest.source)
                    : 'never checked'
              }
              tone={paused ? 'neutral' : verdictTone(latest?.verdict ?? null)}
            />
            <AppText variant="mono" tone={toneInk(latest?.verdict ?? null)}>
              {formatMs(latest?.ms ?? null)}
            </AppText>
          </View>

          <LatencyChart checks={spark} height={52} />

          <AppText variant="caption" tone="tertiary">
            {latest
              ? `Last check ${formatAgo(minutesSince(latest.checked_at, now))}${
                  latest.status !== null ? ` · HTTP ${latest.status}` : ' · status hidden by the browser'
                } · ${checks.length} ${checks.length === 1 ? 'check' : 'checks'} kept`
              : 'Not checked yet — press Check now.'}
          </AppText>

          {latest?.detail && latest.verdict === 'down' ? (
            <AppText variant="caption" tone="danger">
              {latest.detail}
            </AppText>
          ) : null}
        </Panel>
      </FadeUp>

      <FadeUp index={2}>
        <AppButton
          label={view.running ? 'Checking…' : 'Check now'}
          icon={ArrowsClockwise}
          variant="tonal"
          full
          disabled={view.running}
          onPress={() => void view.checkNow()}
        />
      </FadeUp>

      <FadeUp index={3}>
        <SectionHeader eyebrow="Reliability" title={`The last ${range === '24h' ? '24 hours' : range === '7d' ? '7 days' : '30 days'}`} />
        <Segmented<Range>
          options={RANGES.map((option) => ({ value: option.value, label: option.label }))}
          value={range}
          onChange={setRange}
          style={{ marginBottom: spacing.md }}
        />
        <Panel pad="lg" style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
            <Stat
              label="Uptime"
              value={formatPercent(stats.ratio)}
              tone={stats.worst === 'down' ? 'danger' : stats.worst === 'slow' ? 'ember' : 'default'}
            />
            <Stat label="Checks" value={String(stats.total)} />
            <Stat
              label="Slowest"
              value={formatMs(latency?.max ?? null)}
              tone={latency && site.expect_ms !== null && latency.max > site.expect_ms ? 'ember' : 'default'}
            />
            <Stat label="Median" value={formatMs(latency?.median ?? null)} />
          </View>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" tone="secondary">
              {stats.total === 0
                ? 'No checks in this window yet.'
                : `${stats.up + stats.slow} of ${stats.total} checks answered${
                    stats.slow > 0 ? `, ${stats.slow} of them slowly` : ''
                  }.`}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {site.expect_status !== null
                ? `Expects HTTP ${site.expect_status}`
                : 'Expects any status below 500'}
              {site.expect_ms !== null
                ? ` · slow over ${formatMs(site.expect_ms)}`
                : ' · no time budget set'}
            </AppText>
            {latency && latency.count > 1 ? (
              <AppText variant="caption" tone="tertiary">
                {`Fastest ${formatMs(latency.min)} · p95 ${formatMs(latency.p95)} · over ${latency.count} answered checks`}
              </AppText>
            ) : null}
          </View>
        </Panel>
      </FadeUp>

      <FadeUp index={4}>
        <SectionHeader eyebrow="Incidents" title={incidents.length === 0 ? 'Nothing has gone down' : `${incidents.length} ${incidents.length === 1 ? 'incident' : 'incidents'}`} />
        {incidents.length === 0 ? (
          <Panel pad="lg">
            <AppText variant="subhead" tone="secondary">
              Three failures in a row is an incident. None in the kept history — though with checks this
              app only takes while you are looking, absence is not proof.
            </AppText>
          </Panel>
        ) : (
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {incidents.map((incident, index) => (
              <View key={incident.startedAt}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  }}>
                  {incident.ongoing ? (
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.md,
                        borderCurve: 'continuous',
                        backgroundColor: colors.dangerSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <WarningCircle size={17} color={colors.danger} weight="light" />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: radius.md,
                        borderCurve: 'continuous',
                        backgroundColor: colors.surfaceElevated,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <ClockCounterClockwise size={17} color={colors.textSecondary} weight="light" />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="subheadMedium">
                      {incident.ongoing ? 'Down now' : `Down for ${formatSpan(incident.minutes)}`}
                    </AppText>
                    <AppText variant="caption" tone="secondary" numberOfLines={1}>
                      {`${incident.failures} failures from ${shortTime(incident.startedAt)}${
                        incident.endedAt ? ` to ${shortTime(incident.endedAt)}` : ''
                      }`}
                    </AppText>
                  </View>
                </View>
                {index < incidents.length - 1 ? (
                  <View style={{ height: 1, marginLeft: spacing.lg, backgroundColor: colors.hairline }} />
                ) : null}
              </View>
            ))}
          </Panel>
        )}
      </FadeUp>

      <FadeUp index={5}>
        <SectionHeader eyebrow="The log" title="Recent checks" />
        <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
          {checks.slice(0, 20).map((check, index) => (
            <View key={check.id}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm + 2,
                }}>
                <AppText variant="mono" tone="tertiary" style={{ width: 96 }}>
                  {shortTime(check.checked_at)}
                </AppText>
                <AppText variant="mono" tone={toneInk(check.verdict)} style={{ flex: 1 }}>
                  {check.status !== null ? String(check.status) : verdictLabel(check.verdict, check.source)}
                </AppText>
                <AppText variant="mono" tone="secondary">
                  {formatMs(check.ms)}
                </AppText>
              </View>
              {index < Math.min(checks.length, 20) - 1 ? (
                <View style={{ height: 1, marginLeft: spacing.lg, backgroundColor: colors.hairline }} />
              ) : null}
            </View>
          ))}
          {checks.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <AppText variant="caption" tone="tertiary">
                No checks yet. Press Check now and the result lands here.
              </AppText>
            </View>
          ) : null}
        </Panel>
      </FadeUp>

      {site.note ? (
        <FadeUp index={6}>
          <SectionHeader eyebrow="Note" title={site.name} />
          <Panel pad="lg">
            <AppText variant="subhead">{site.note}</AppText>
          </Panel>
        </FadeUp>
      ) : null}

      <FadeUp index={7}>
        <SectionHeader eyebrow="The target" title="Settings" />
        <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <ListRow
            icon={<PencilSimple size={17} color={colors.textSecondary} weight="light" />}
            title="Edit target"
            subtitle="Name, URL, what counts as up"
            showSeparator
            onPress={() =>
              router.push({ pathname: '/sentinel/site-form', params: { id: site.id } })
            }
          />
          {confirming ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <AppText variant="subheadMedium" tone="danger" style={{ flex: 1 }}>
                Delete this target and its log?
              </AppText>
              <PressableScale haptic="light" onPress={() => setConfirming(false)}>
                <AppText variant="captionMedium" tone="secondary">
                  Keep
                </AppText>
              </PressableScale>
              <PressableScale haptic="medium" onPress={() => void deleteTarget()}>
                <AppText variant="captionMedium" tone="danger">
                  Delete
                </AppText>
              </PressableScale>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <PressableScale haptic="medium" onPress={() => setConfirming(true)}>
                <AppText variant="captionMedium" tone="danger">
                  Stop watching this target
                </AppText>
              </PressableScale>
            </View>
          )}
        </Panel>
      </FadeUp>
    </Screen>
  );
}

/** `14:02` — the log is a table, so it wants a fixed short stamp, not a sentence. */
function shortTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
