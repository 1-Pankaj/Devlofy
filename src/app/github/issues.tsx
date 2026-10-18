/**
 * Issues — the backlog as GitHub has it, with a way to add to it.
 *
 * The list is state-filtered and nothing more: the repo screen already shows a
 * preview, and detail lives one tap away. The FAB is the one primary action, and
 * it is the only filled control on the screen.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowClockwise, FilePlus, GithubLogo, WarningCircle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { GithubGate } from '@/components/github/gate';
import { IssueRow } from '@/components/github/rows';
import { listIssues, type IssueState } from '@/lib/github/issues';
import { useGithubToken } from '@/lib/github/use-github';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

export default function IssuesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string }>();
  const repo = params.repo ?? '';
  const { token, ready } = useGithubToken();
  const [state, setState] = useState<IssueState>('open');

  const issues = useAsyncData(
    () => listIssues(token ?? '', repo, state, 40),
    [token ?? '', repo, state],
    { enabled: ready && token !== null && repo.length > 0 },
  );

  const open = useCallback(
    (number: number) =>
      router.push({ pathname: '/github/issue', params: { repo, number: String(number) } }),
    [repo, router],
  );

  return (
    <Screen
      fab={
        <Fab
          label="New issue"
          icon={FilePlus}
          onPress={() => router.push({ pathname: '/github/new-issue', params: { repo } })}
        />
      }
      header={{
        eyebrow: repo,
        title: 'Issues',
        subtitle: issues.data ? `${issues.data.length} ${state}` : 'reading GitHub…',
        trailing: (
          <PressableScale
            haptic="light"
            accessibilityLabel="Refresh"
            disabled={issues.refreshing}
            style={{ opacity: issues.refreshing ? 0.45 : 1 }}
            onPress={issues.reload}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceElevated,
              }}>
              <ArrowClockwise size={15} color={colors.textSecondary} weight="regular" />
            </View>
          </PressableScale>
        ),
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Repository" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="issues">
        {() => (
          <>
            <FadeUp index={1}>
              <Segmented
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'closed', label: 'Closed' },
                ]}
                value={state}
                onChange={setState}
              />
            </FadeUp>

            <FadeUp index={2}>
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {issues.loading ? (
                  <Loading label="reading issues…" />
                ) : issues.error && !issues.data ? (
                  <View style={{ gap: spacing.md, padding: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <WarningCircle size={15} color={colors.danger} weight="fill" />
                      <Eyebrow tone="danger">Could not read issues</Eyebrow>
                    </View>
                    <AppText variant="caption" tone="secondary">
                      {issues.error}
                    </AppText>
                    <AppButton label="Try again" variant="text" onPress={issues.reload} />
                  </View>
                ) : (issues.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={GithubLogo}
                    title={`No ${state} issues`}
                    message={
                      state === 'open'
                        ? 'The backlog is empty. Add the first one with the button below.'
                        : 'Nothing has been closed yet.'
                    }
                  />
                ) : (
                  (issues.data ?? []).map((issue, index) => (
                    <IssueRow
                      key={issue.number}
                      issue={issue}
                      showSeparator={index < (issues.data ?? []).length - 1}
                      onPress={() => open(issue.number)}
                    />
                  ))
                )}
              </Panel>
            </FadeUp>

            {issues.error && issues.data ? (
              <FadeUp index={3}>
                <AppText variant="caption" tone="danger">
                  {issues.error}
                </AppText>
              </FadeUp>
            ) : null}
          </>
        )}
      </GithubGate>
    </Screen>
  );
}
