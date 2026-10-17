/**
 * More — appearance, desktop mode, data and the honest fine print.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { DownloadSimple } from 'phosphor-react-native';
import { useState, type ReactNode } from 'react';
import { Share, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { exportAll, getDataStats } from '@/lib/db/repo';
import { useSettings, type DesktopMode, type ThemeMode } from '@/state/settings';
import { spacing, useTheme } from '@/theme';

const APP_VERSION = '0.1.0';

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

  const stats = useLiveQuery((d) => getDataStats(d));
  const [exportNote, setExportNote] = useState<string | null>(null);

  const handleExport = async () => {
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
  };

  return (
    <Screen header={{ eyebrow: 'settings', title: 'More', subtitle: 'Shape the app around how you work.' }}>
      <FadeUp index={0}>
        <Panel coreStyle={{ padding: 0 }}>
          <SettingBlock title="Your name" caption="Used for the greeting. Everything else is yours too.">
            <TextField value={userName} onChangeText={setUserName} placeholder="Your name" />
          </SettingBlock>
          <View style={{ height: 1, backgroundColor: colors.hairline }} />
          <SettingBlock title="Theme" caption="Ink is the canon. System follows your device.">
            <Segmented<ThemeMode>
              options={[
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Ink' },
                { value: 'light', label: 'Paper' },
              ]}
              value={themeMode}
              onChange={setThemeMode}
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

      <FadeUp index={1}>
        <Panel coreStyle={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Eyebrow>your data</Eyebrow>
            <View style={{ flexDirection: 'row' }}>
              {[
                { value: stats.data?.notes ?? 0, label: 'notes' },
                { value: stats.data?.projects ?? 0, label: 'projects' },
                { value: stats.data?.clients ?? 0, label: 'clients' },
                { value: stats.data?.sessions ?? 0, label: 'sessions' },
              ].map((stat, index) => (
                <View key={stat.label} style={{ flex: 1, flexDirection: 'row' }}>
                  {index > 0 ? (
                    <View style={{ width: 1, backgroundColor: colors.hairline, marginVertical: 4 }} />
                  ) : null}
                  <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                    <AppText variant="numberLg">{String(stat.value)}</AppText>
                    <Eyebrow>{stat.label}</Eyebrow>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <AppButton label="Export JSON" icon={DownloadSimple} variant="soft" onPress={handleExport} />
          {exportNote ? (
            <AppText variant="caption" tone="accent">
              {exportNote}
            </AppText>
          ) : (
            <AppText variant="caption" tone="tertiary">
              A full dump of the local database. Yours to keep, any time.
            </AppText>
          )}
        </Panel>
      </FadeUp>

      <FadeUp index={2}>
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
