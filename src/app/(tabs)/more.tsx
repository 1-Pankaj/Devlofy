/**
 * More — appearance, desktop mode, data and the honest fine print.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { DownloadSimple, Pulse, Toolbox } from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import { Share, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { ErrorState } from '@/components/ui/error-state';
import { FeatureCard } from '@/components/ui/feature-card';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { exportAll, countSnippets, getDataStats } from '@/lib/db/repo';
import { BENCH_TOOLS } from '@/lib/bench/tools';
import { standingLine } from '@/lib/sentinel/status';
import { useSentinelStanding } from '@/lib/sentinel/use-sentinel';
import { messageOf } from '@/lib/use-async-data';
import { APP_VERSION } from '@/lib/version';
import { GOAL_OPTIONS, useSettings, type DesktopMode, type ThemeMode } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

function SettingBlock({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText variant="subheadMedium">{title}</AppText>
        {caption ? (
          <AppText variant="caption" tone="secondary">
            {caption}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function MoreScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();

  const themeMode = useSettings((s) => s.themeMode);
  const setThemeMode = useSettings((s) => s.setThemeMode);
  const desktopMode = useSettings((s) => s.desktopMode);
  const setDesktopMode = useSettings((s) => s.setDesktopMode);
  const userName = useSettings((s) => s.userName);
  const setUserName = useSettings((s) => s.setUserName);
  const dailyGoalMinutes = useSettings((s) => s.dailyGoalMinutes);
  const setDailyGoalMinutes = useSettings((s) => s.setDailyGoalMinutes);

  const router = useRouter();
  const stats = useLiveQuery((d) => getDataStats(d));
  const snippets = useLiveQuery((d) => countSnippets(d));
  const standing = useSentinelStanding();
  const sentinelLine = standingLine(standing.standing);
  // A read that failed says so, rather than showing the card with no live line —
  // "no verdict" and "could not read" must never look the same. An empty board
  // gets a neutral pill too: it is the only place a new user learns the shelf
  // card leads somewhere they have not set up yet.
  const sentinelStat =
    standing.status === 'error'
      ? 'Could not read the board'
      : (sentinelLine?.text ?? 'Nothing watched yet');
  const sentinelTone =
    standing.status === 'error' || !sentinelLine ? 'neutral' : sentinelLine.tone;
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportProblem, setExportProblem] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportNote(null);
    setExportProblem(null);
    try {
      const dump = await exportAll(db);
      const text = JSON.stringify(dump.data, null, 2);
      if (process.env.EXPO_OS === 'web') {
        const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(text);
          setExportNote('Copied the full JSON to your clipboard.');
        } else {
          setExportNote('Clipboard unavailable in this browser.');
        }
      } else {
        await Share.share({ message: text, title: 'Devlofy export' });
        setExportNote('Export handed to the share sheet.');
      }
    } catch (error) {
      // A browser on plain http, or a denied clipboard permission, rejects here.
      // Say so — a button that quietly does nothing reads as broken.
      setExportProblem(messageOf(error));
    } finally {
      setExporting(false);
    }
  };

  const supporting = [
    { value: stats.data?.projects ?? 0, label: 'projects' },
    { value: stats.data?.clients ?? 0, label: 'clients' },
    { value: stats.data?.sessions ?? 0, label: 'sessions' },
  ];

  return (
    <Screen
      header={{
        eyebrow: 'settings',
        title: 'More',
        subtitle: 'Shape the app around how you work.',
      }}>
      {/* The shelf. These two are the app's own tools — not settings, and not the
          tracker. They lead the tab, and each carries its live count so the card
          answers "anything wrong?" before it is opened. */}
      <FadeUp index={0}>
        <SectionHeader eyebrow="offline & networked" title="Bench & Sentinel" />
        <View style={{ gap: spacing.md }}>
          <FeatureCard
            icon={Toolbox}
            title="Bench"
            promise="Hashes, JSON, diffs, tokens — computed on this device."
            stat={
              snippets.status === 'ready' && snippets.data
                ? `${BENCH_TOOLS.length} tools · ${snippets.data} kept`
                : `${BENCH_TOOLS.length} tools`
            }
            onPress={() => router.push('/bench')}
          />
          <FeatureCard
            icon={Pulse}
            title="Sentinel"
            promise="Watch the URLs you own: status, latency, incidents."
            stat={sentinelStat}
            tone={sentinelTone}
            onPress={() => router.push('/sentinel')}
          />
        </View>
      </FadeUp>

      <FadeUp index={1}>
        <Panel coreStyle={{ padding: 0 }}>
          <SettingBlock title="Your name" caption="Used for the greeting. Everything else is yours too.">
            <TextField value={userName} onChangeText={setUserName} placeholder="Your name" />
          </SettingBlock>
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          <SettingBlock
            title="Theme"
            caption="Material 3 Expressive. System follows your device.">
            <Segmented<ThemeMode>
              options={[
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              value={themeMode}
              onChange={setThemeMode}
            />
          </SettingBlock>
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          <SettingBlock
            title="Daily focus goal"
            caption="The target behind the ring on Today, and what “to go” counts down from.">
            <Segmented<string>
              options={GOAL_OPTIONS.map((minutes) => ({
                value: String(minutes),
                label: minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`,
              }))}
              value={String(dailyGoalMinutes)}
              onChange={(value) => setDailyGoalMinutes(Number(value))}
            />
          </SettingBlock>
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          <SettingBlock
            title="Desktop mode"
            caption="Side rail layout on tablets and wide windows. Auto follows window width.">
            <Segmented<DesktopMode>
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'always', label: 'On' },
                { value: 'never', label: 'Off' },
              ]}
              value={desktopMode}
              onChange={setDesktopMode}
            />
          </SettingBlock>
        </Panel>
      </FadeUp>

      <FadeUp index={2}>
        <View style={{ gap: spacing.lg }}>
          {/* Data: one hero figure, then the supporting counts */}
          {stats.status === 'error' && !stats.data ? (
            <Panel>
              <ErrorState what="your data counts" onRetry={() => stats.refresh()} />
            </Panel>
          ) : (
            <View
              style={{
                backgroundColor: colors.accentSoft,
                borderRadius: radius.xl,
                borderCurve: 'continuous',
                padding: spacing.lg,
                gap: spacing.lg,
              }}>
              <View style={{ gap: spacing.xxs }}>
                <Eyebrow tone="accent">On this device</Eyebrow>
                <AnimatedNumber
                  value={stats.data?.notes ?? 0}
                  variant="numberXl"
                  color={colors.accent}
                />
                <AppText variant="caption" tone="accent" style={{ opacity: 0.75 }}>
                  notes, all local
                </AppText>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.lg,
                  paddingTop: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.accentBorder,
                }}>
                {supporting.map((stat) => (
                  <View key={stat.label} style={{ flex: 1, gap: spacing.xxs }}>
                    <AnimatedNumber
                      value={stat.value}
                      variant="headline"
                      color={colors.accent}
                    />
                    <AppText variant="caption" tone="accent" style={{ opacity: 0.75 }}>
                      {stat.label}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Panel coreStyle={{ gap: spacing.lg }}>
            <AppButton
              label={exporting ? 'Exporting…' : 'Export JSON'}
              icon={DownloadSimple}
              variant="tonal"
              disabled={exporting}
              onPress={handleExport}
            />
            {exportProblem ? (
              <AppText variant="caption" tone="danger">
                {exportProblem}
              </AppText>
            ) : exportNote ? (
              <AppText variant="caption" tone="accent">
                {exportNote}
              </AppText>
            ) : (
              <AppText variant="caption" tone="tertiary">
                A full dump of the local database. Yours to keep, any time.
              </AppText>
            )}
          </Panel>
        </View>
      </FadeUp>

      <FadeUp index={3}>
        <Panel coreStyle={{ gap: spacing.xs }}>
          <Eyebrow>about</Eyebrow>
          <AppText variant="subheadMedium">Devlofy v{APP_VERSION}</AppText>
          <AppText variant="caption" tone="secondary">
            Offline-first. No account, no cloud, no tracking. Live integrations degrade gracefully
            with last-synced state when you are offline.
          </AppText>
          <AppText variant="mono" tone="tertiary" style={{ marginTop: spacing.sm }}>
            built by codeloom · expo + sqlite + three
          </AppText>
        </Panel>
      </FadeUp>
    </Screen>
  );
}
