/**
 * Pull requests, in a list you can actually triage.
 *
 * Open is the default because that is the state with work in it; closed and all
 * exist so the list is never a dead end. Every row opens the pull request *in
 * the app*, where it can be reviewed and merged.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowClockwise, GitPullRequest, WarningCircle } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { FadeUp } from '@/components/ui/stagger';
import { GithubGate } from '@/components/github/gate';
import { PullRow } from '@/components/github/rows';
import { listPulls } from '@/lib/github/pulls';
import { useGithubToken } from '@/lib/github/use-github';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

type State = 'open' | 'closed' | 'all';

export default function PullsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string }>();
  const repo = params.repo ?? '';
  const { token, ready } = useGithubToken();
  const [state, setState] = useState<State>('open');

  const pulls = useAsyncData(() => listPulls(token ?? '', repo, state), [token ?? '', repo, state], {
    enabled: ready && token !== null && repo.length > 0,
  });

  const open = useCallback(
    (number: number) =>
      router.push({ pathname: '/github/pr', params: { repo, number: String(number) } }),
    [repo, router],
  );

  return (
    <Screen
      header={{
        eyebrow: repo,
        title: 'Pull requests',
        subtitle: pulls.data ? `${pulls.data.length} ${state}` : 'reading GitHub…',
        trailing: (
          <PressableScale
            haptic="light"
            accessibilityLabel="Refresh"
            disabled={pulls.refreshing}
            style={{ opacity: pulls.refreshing ? 0.45 : 1 }}
            onPress={pulls.reload}>
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

      <GithubGate ready={ready} token={token} what="pull requests">
        {() => (
          <>
            <FadeUp index={1}>
              <Segmented
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'closed', label: 'Closed' },
                  { value: 'all', label: 'All' },
                ]}
                value={state}
                onChange={setState}
              />
            </FadeUp>

            <FadeUp index={2}>
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {pulls.loading ? (
                  <Loading label="reading pull requests…" />
                ) : pulls.error && !pulls.data ? (
                  <View style={{ gap: spacing.md, padding: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <WarningCircle size={15} color={colors.danger} weight="fill" />
                      <Eyebrow tone="danger">Could not read pull requests</Eyebrow>
                    </View>
                    <AppText variant="caption" tone="secondary">
                      {pulls.error}
                    </AppText>
                    <AppButton label="Try again" variant="text" onPress={pulls.reload} />
                  </View>
                ) : (pulls.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={GitPullRequest}
                    title={`No ${state} pull requests`}
                    message="Nothing here. Edit a file from the repository screen to open one."
                  />
                ) : (
                  (pulls.data ?? []).map((pull, index) => (
                    <PullRow
                      key={pull.number}
                      pull={pull}
                      showSeparator={index < (pulls.data ?? []).length - 1}
                      onPress={() => open(pull.number)}
                    />
                  ))
                )}
              </Panel>
            </FadeUp>

            {pulls.error && pulls.data ? (
              <FadeUp index={3}>
                <AppText variant="caption" tone="danger">
                  {pulls.error}
                </AppText>
              </FadeUp>
            ) : null}
          </>
        )}
      </GithubGate>
    </Screen>
  );
}
