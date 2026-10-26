/**
 * Invoice draft — tracked time, priced.
 *
 * This screen is the payoff of the whole attribution chain: because every block
 * knows its project, and a project knows its rate, the bill exists the moment the
 * work does. Nothing is stored as an invoice document — the draft is recomputed
 * from the session log every time, so it can never describe time that has since
 * been corrected, excluded, or deleted.
 *
 * Reachable from Work (all clients) or a client page (that client only).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CheckSquare,
  Copy,
  CurrencyCircleDollar,
  EyeSlash,
  Timer,
  Warning,
} from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AnimatedNumber } from '@/components/ui/animated-number';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormChip } from '@/components/ui/form-chip';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { useLiveQuery } from '@/lib/db/hooks';
import { getClient, listSessionsInWindow, setSessionBillable } from '@/lib/db/repo';
import { formatClock, formatDayLabel, formatMinutes } from '@/lib/format';
import {
  formatHours,
  formatMoney,
  invoiceLines,
  invoiceText,
  invoiceTotals,
  PERIODS,
  periodRange,
  type Period,
} from '@/lib/money';
import { shareText } from '@/lib/share';
import { messageOf } from '@/lib/use-async-data';
import { CURRENCY_OPTIONS, useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

export default function InvoiceScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const currency = useSettings((s) => s.currency);
  const setCurrency = useSettings((s) => s.setCurrency);

  const [period, setPeriod] = useState<Period>('month');
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => periodRange(period), [period]);
  const from = range.from.toISOString();
  const to = range.to.toISOString();

  const client = useLiveQuery((d) => getClient(d, clientId ?? ''), { deps: [clientId] });
  const sessions = useLiveQuery((d) => listSessionsInWindow(d, from, to, clientId ?? null), {
    deps: [from, to, clientId],
  });

  const rows = useMemo(() => sessions.data ?? [], [sessions.data]);
  const lines = useMemo(() => invoiceLines(rows), [rows]);
  const totals = useMemo(() => invoiceTotals(rows), [rows]);
  const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? '';

  const handleToggle = async (sessionId: string, billable: boolean) => {
    setProblem(null);
    try {
      await setSessionBillable(db, sessionId, billable);
      await sessions.refresh();
    } catch (error) {
      setProblem(messageOf(error));
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const text = invoiceText(lines, totals, {
        symbol: currency,
        periodLabel,
        client: client.data?.name ?? null,
      });
      const result = await shareText(text, 'Devlofy invoice draft');
      setNote(
        result === 'copied'
          ? 'Copied the draft to your clipboard.'
          : result === 'shared'
            ? 'Sent the draft to the share sheet.'
            : 'Clipboard unavailable in this browser.',
      );
    } catch (error) {
      // A refused clipboard is the common case on plain http — say so instead
      // of leaving the button looking like it did nothing.
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={{
        eyebrow: clientId ? (client.data?.company ?? 'client') : 'work',
        title: clientId ? `${client.data?.name ?? 'Client'}` : 'Invoice draft',
        subtitle: clientId
          ? 'Billable time on this client'
          : 'Priced from your own session log',
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label={clientId ? 'Client' : 'Work'} />
        </View>
      </FadeUp>

      <FadeUp index={0}>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
      </FadeUp>

      {sessions.status === 'loading' && !sessions.data ? (
        <Panel>
          <Loading label="adding up your time…" />
        </Panel>
      ) : sessions.status === 'error' && !sessions.data ? (
        <Panel>
          <ErrorState what="your focus sessions" onRetry={() => sessions.refresh()} />
        </Panel>
      ) : (
        <>
          <FadeUp index={1}>
            <View
              style={{
                backgroundColor: colors.accentSoft,
                borderRadius: radius.xl,
                borderCurve: 'continuous',
                padding: spacing.lg,
                gap: spacing.lg,
              }}>
              <View style={{ gap: spacing.xxs }}>
                <Eyebrow tone="accent">{periodLabel} · draft total</Eyebrow>
                <AnimatedNumber
                  value={totals.amount}
                  variant="numberXl"
                  precision={2}
                  format={(value) => formatMoney(value, currency)}
                  color={colors.accent}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.lg,
                  paddingTop: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.accentBorder,
                }}>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="headline" tone="accent">
                    {formatHours(totals.minutes)}
                  </AppText>
                  <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
                    billable
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="headline" tone="accent">
                    {totals.sessions}
                  </AppText>
                  <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
                    blocks
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="headline" tone="accent">
                    {lines.length}
                  </AppText>
                  <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
                    line items
                  </AppText>
                </View>
              </View>
            </View>
          </FadeUp>

          <FadeUp index={2}>
            <View style={{ gap: spacing.md }}>
              <AppButton
                label={
                  process.env.EXPO_OS === 'web' ? 'Copy invoice text' : 'Share invoice text'
                }
                icon={Copy}
                variant="tonal"
                disabled={totals.sessions === 0 || busy}
                onPress={handleShare}
              />
              {note ? (
                <AppText variant="caption" tone="secondary">
                  {note}
                </AppText>
              ) : null}
              {problem ? (
                <AppText variant="caption" tone="danger">
                  {problem}
                </AppText>
              ) : null}
            </View>
          </FadeUp>

          {totals.unratedMinutes > 0 ? (
            <FadeUp index={2}>
              <Panel variant="outlined" style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Warning size={15} color={colors.ember} weight="fill" />
                  <Eyebrow tone="ember">Not priced</Eyebrow>
                </View>
                <AppText variant="subhead" tone="secondary">
                  {formatMinutes(totals.unratedMinutes)} in this period sits on projects with no
                  rate, so it cannot be billed.
                </AppText>
                <AppButton
                  label="Set a rate in Work"
                  variant="text"
                  onPress={() => router.push('/work')}
                />
              </Panel>
            </FadeUp>
          ) : null}

          {totals.excludedMinutes > 0 ? (
            <FadeUp index={2}>
              <AppText variant="caption" tone="tertiary">
                {formatMinutes(totals.excludedMinutes)} excluded from this draft — tap a block
                below to put it back.
              </AppText>
            </FadeUp>
          ) : null}

          {/* The draft itself */}
          <FadeUp index={3}>
            <View>
              <SectionHeader eyebrow="draft" title="Line items" />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {lines.length === 0 ? (
                  <EmptyState
                    icon={CurrencyCircleDollar}
                    title="Nothing billable yet"
                    message="Give a project an hourly rate and every block you focus on it is priced automatically."
                  />
                ) : (
                  lines.map((line, index) => (
                    <ListRow
                      key={line.key}
                      icon={<CurrencyCircleDollar size={17} color={colors.accent} weight="light" />}
                      tone="accent"
                      title={line.project}
                      subtitle={`${[line.client, formatHours(line.minutes), `${formatMoney(
                        line.rate ?? 0,
                        currency,
                      )}/h`]
                        .filter(Boolean)
                        .join(' · ')}`}
                      showSeparator={index < lines.length - 1}
                      trailing={
                        <AppText variant="mono" tone="secondary">
                          {formatMoney(line.amount, currency)}
                        </AppText>
                      }
                    />
                  ))
                )}
              </Panel>
            </View>
          </FadeUp>

          {/* The evidence: every block, and whether it is on the bill */}
          <FadeUp index={4}>
            <View>
              <SectionHeader
                eyebrow="evidence"
                title="Blocks"
                trailing={
                  <AppText variant="caption" tone="secondary">
                    tap to exclude
                  </AppText>
                }
              />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {rows.length === 0 ? (
                  <EmptyState
                    icon={Timer}
                    title="No blocks in this period"
                    message="Focus sessions appear here the moment they finish."
                  />
                ) : (
                  rows.map((row, index) => {
                    const priced = row.rate !== null;
                    const billed = priced && row.billable === 1;
                    return (
                      <ListRow
                        key={row.id}
                        icon={
                          priced ? (
                            billed ? (
                              <CheckSquare size={17} color={colors.accent} weight="fill" />
                            ) : (
                              <EyeSlash size={17} color={colors.textTertiary} weight="light" />
                            )
                          ) : (
                            <Timer size={17} color={colors.textTertiary} weight="light" />
                          )
                        }
                        tone={billed ? 'accent' : 'neutral'}
                        title={row.project_name ?? 'No project'}
                        subtitle={`${formatDayLabel(row.started_at)} · ${formatClock(
                          row.started_at,
                        )} · ${row.minutes}m${row.task_title ? ` · ${row.task_title}` : ''}`}
                        showSeparator={index < rows.length - 1}
                        onPress={
                          billed
                            ? () => handleToggle(row.id, false)
                            : priced
                              ? () => handleToggle(row.id, true)
                              : undefined
                        }
                        trailing={
                          priced ? (
                            <AppText variant="mono" tone={billed ? 'secondary' : 'tertiary'}>
                              {billed ? formatMoney((row.minutes / 60) * (row.rate ?? 0), currency) : 'excluded'}
                            </AppText>
                          ) : (
                            <StatusPill label="unrated" tone="neutral" />
                          )
                        }
                      />
                    );
                  })
                )}
              </Panel>
            </View>
          </FadeUp>

          {/* Currency is a preference, not a guess */}
          <FadeUp index={5}>
            <View style={{ gap: spacing.sm }}>
              <Eyebrow>Currency</Eyebrow>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {CURRENCY_OPTIONS.map((symbol) => (
                  <FormChip
                    key={symbol}
                    label={symbol}
                    active={symbol === currency}
                    onPress={() => setCurrency(symbol)}
                  />
                ))}
              </View>
            </View>
          </FadeUp>
        </>
      )}
    </Screen>
  );
}
