/**
 * GitHub — the one screen in this app that needs the network.
 *
 * Everything else Devlofy does happens on the device; the code you are pushing
 * is the part that doesn't. So this screen is deliberately narrow: *what on
 * GitHub is waiting for me* — reviews someone wants, your own open pull
 * requests, issues assigned to you, and the newest check on the repos you
 * touched most recently. It reads; it never writes.
 *
 * Two ways in, because the platform decides:
 *
 *  - **Pasted token** — works everywhere, needs nothing from GitHub's app
 *    registry, and is the only option on web (`github.com`'s OAuth endpoints
 *    send no CORS headers, so the device flow cannot complete in a browser).
 *  - **Device flow** — Android only, and only once a client ID is configured in
 *    `app.json`. The user approves a code in any browser they have open.
 *
 * See docs/07-decisions.md (ADR-019) for why, and why the token lives in local
 * storage rather than the OS keychain.
 */
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  CircleIcon,
  GitPullRequest,
  GithubLogo,
  Key,
  SignIn,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill, type StatusTone } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { formatAgo } from '@/lib/format';
import type { GithubItem, GithubRun } from '@/lib/github/api';
import { GITHUB_DEVICE_FLOW_AVAILABLE, GITHUB_TOKEN_URL } from '@/lib/github/config';
import { useGithub } from '@/lib/github/use-github';
import { radius, spacing, useTheme } from '@/theme';

/** CI wording: a check either passed, failed, or is still going. */
function runPill(run: GithubRun): { label: string; tone: StatusTone } {
  if (run.status !== 'completed') {
    return { label: run.status === 'in_progress' ? 'running' : run.status, tone: 'neutral' };
  }
  switch (run.conclusion) {
    case 'success':
      return { label: 'passing', tone: 'accent' };
    case 'failure':
    case 'timed_out':
      return { label: 'failing', tone: 'danger' };
    case 'action_required':
      return { label: 'action needed', tone: 'danger' };
    case 'cancelled':
      return { label: 'cancelled', tone: 'neutral' };
    default:
      return { label: run.conclusion ?? 'finished', tone: 'neutral' };
  }
}

/** GitHub's own lists show `repo#123`, not `owner/repo#123` — the owner is implied. */
function shortRepo(fullName: string): string {
  return fullName.split('/').pop() ?? fullName;
}

function itemSubtitle(item: GithubItem, prefix: string): string {
  return [
    `${shortRepo(item.repo)}#${item.number}`,
    prefix,
    formatAgo(item.updatedAt),
    item.comments > 0 ? `${item.comments} ${item.comments === 1 ? 'comment' : 'comments'}` : null,
    item.draft ? 'draft' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, gap: spacing.xxs }}>
      <AppText variant="headline" tone="accent">
        {value}
      </AppText>
      <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
        {label}
      </AppText>
    </View>
  );
}

function ItemRows({
  items,
  prefix,
  icon,
  tone,
  onOpen,
}: {
  items: GithubItem[];
  prefix: string;
  icon: 'pr' | 'issue';
  tone: 'accent' | 'neutral';
  onOpen: (url: string) => void;
}) {
  const { colors } = useTheme();

  return items.map((item, index) => (
    <ListRow
      key={`${item.kind}-${item.repo}-${item.number}`}
      icon={
        icon === 'pr' ? (
          <GitPullRequest
            size={17}
            color={tone === 'accent' ? colors.accent : colors.textSecondary}
            weight="light"
          />
        ) : (
          <CircleIcon size={17} color={colors.info} weight="bold" />
        )
      }
      tone={icon === 'pr' ? tone : 'info'}
      title={item.title}
      subtitle={itemSubtitle(item, prefix)}
      showSeparator={index < items.length - 1}
      onPress={() => onOpen(item.htmlUrl)}
      trailing={<ArrowSquareOut size={14} color={colors.textTertiary} weight="regular" />}
    />
  ));
}

export default function GithubScreen() {
  const { colors } = useTheme();
  const github = useGithub();

  const [tokenDraft, setTokenDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const canSignIn = GITHUB_DEVICE_FLOW_AVAILABLE;
  const snapshot = github.snapshot;
  const connected = github.ready && github.auth !== null;

  const openExternal = useCallback((url: string | null) => {
    if (!url) return;
    void Linking.openURL(url).catch(() => {});
  }, []);

  const handleConnect = async () => {
    setNote(null);
    const problem = await github.connect(tokenDraft);
    if (problem) setNote(problem);
    else setTokenDraft('');
  };

  const refreshAction = connected ? (
    <PressableScale
      haptic="light"
      disabled={github.refreshing}
      accessibilityLabel="Refresh from GitHub"
      onPress={() => void github.refresh()}
      style={{ opacity: github.refreshing ? 0.45 : 1 }}>
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
  ) : undefined;

  const waiting =
    (snapshot?.reviewRequests.length ?? 0) +
    (snapshot?.authoredPrs.length ?? 0) +
    (snapshot?.assignedIssues.length ?? 0);

  return (
    <Screen
      header={{
        eyebrow: 'code',
        title: 'GitHub',
        subtitle: connected
          ? `read-only · @${snapshot?.viewer.login ?? '…'}`
          : 'Your repos, without leaving the app',
        trailing: refreshAction,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Work" />
        </View>
      </FadeUp>

      {!github.ready ? (
        <Panel>
          <Loading label="reading the stored key…" />
        </Panel>
      ) : !connected ? (
        <>
          <FadeUp index={1}>
            <Panel style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <GithubLogo size={18} color={colors.accent} weight="regular" />
                <Eyebrow tone="accent">Not connected</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                Read-only: the pull requests waiting on a review from you, your own open pull
                requests, the issues assigned to you, and the newest check on the repos you pushed
                to most recently. Nothing is ever written back to GitHub.
              </AppText>
            </Panel>
          </FadeUp>

          <FadeUp index={2}>
            <View>
              <SectionHeader eyebrow="token" title="Paste a token" />
              <Panel style={{ gap: spacing.lg }}>
                <TextField
                  label="Personal access token"
                  value={tokenDraft}
                  onChangeText={setTokenDraft}
                  placeholder="github_pat_… or ghp_…"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  editable={!github.connecting}
                  returnKeyType="go"
                  onSubmitEditing={handleConnect}
                />
                <AppText variant="caption" tone="tertiary">
                  A fine-grained token with read-only Contents, Issues, Actions and Metadata is
                  enough; a classic token with just the repo scope also works. It is kept in this
                  device&apos;s local storage — the app has no server to hold it, and it never
                  leaves the device except to talk to GitHub.
                </AppText>
                <AppButton
                  label={github.connecting ? 'Checking…' : 'Connect'}
                  icon={Key}
                  disabled={github.connecting || tokenDraft.trim().length === 0}
                  onPress={handleConnect}
                />
                {note ? (
                  <AppText variant="caption" tone="danger">
                    {note}
                  </AppText>
                ) : null}
                <AppButton
                  label="Create a read-only token on GitHub"
                  icon={ArrowSquareOut}
                  variant="text"
                  onPress={() => openExternal(GITHUB_TOKEN_URL)}
                />
              </Panel>
            </View>
          </FadeUp>

          {canSignIn ? (
            <FadeUp index={3}>
              <View>
                <SectionHeader eyebrow="on this device" title="Sign in instead" />
                <Panel style={{ gap: spacing.lg }}>
                  {github.device.stage === 'idle' ? (
                    <>
                      <AppText variant="caption" tone="secondary">
                        GitHub shows a short code, you approve it in any browser, and the app picks
                        it up. No copy-pasting a token.
                      </AppText>
                      <AppButton
                        label="Start sign-in"
                        icon={SignIn}
                        variant="tonal"
                        onPress={() => void github.startDeviceSignIn()}
                      />
                    </>
                  ) : github.device.stage === 'starting' ? (
                    <Loading label="asking GitHub for a code…" />
                  ) : github.device.stage === 'waiting' ? (
                    <>
                      <View style={{ alignItems: 'center', gap: spacing.md }}>
                        <Eyebrow tone="accent">type this code on GitHub</Eyebrow>
                        <View
                          style={{
                            alignSelf: 'stretch',
                            alignItems: 'center',
                            backgroundColor: colors.surfaceSunken,
                            borderRadius: radius.md,
                            borderCurve: 'continuous',
                            paddingVertical: spacing.md,
                          }}>
                          <AppText variant="mono" style={{ fontSize: 30, letterSpacing: 3 }}>
                            {github.device.userCode}
                          </AppText>
                        </View>
                        <AppText variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
                          at {github.device.verificationUri.replace('https://', '')}. The code is
                          good for about 15 minutes, and this screen finishes by itself once you
                          approve.
                        </AppText>
                      </View>
                      <AppButton
                        label="Open GitHub to approve"
                        icon={ArrowSquareOut}
                        onPress={() => openExternal(github.device.approveUri)}
                      />
                      <AppButton
                        label="Cancel"
                        variant="text"
                        onPress={github.cancelDeviceSignIn}
                      />
                    </>
                  ) : (
                    <>
                      <AppText variant="caption" tone="danger">
                        {github.device.message}
                      </AppText>
                      <AppButton
                        label="Try again"
                        variant="tonal"
                        onPress={() => void github.startDeviceSignIn()}
                      />
                    </>
                  )}
                </Panel>
              </View>
            </FadeUp>
          ) : null}
        </>
      ) : !snapshot ? (
        <Panel>
          <Loading label="reading GitHub…" />
        </Panel>
      ) : (
        <>
          {github.error ? (
            <FadeUp index={1}>
              <Panel variant="outlined" style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <WarningCircle size={15} color={colors.danger} weight="fill" />
                  <Eyebrow tone="danger">Could not refresh</Eyebrow>
                </View>
                <AppText variant="subhead" tone="secondary">
                  {github.error} Showing the snapshot from {formatAgo(snapshot.fetchedAt)}.
                </AppText>
                <AppButton
                  label="Try again"
                  variant="text"
                  onPress={() => void github.refresh()}
                />
              </Panel>
            </FadeUp>
          ) : null}

          {/* The reason to open this screen: what is waiting on you. */}
          <FadeUp index={1}>
            <View
              style={{
                backgroundColor: colors.accentSoft,
                borderRadius: radius.xl,
                borderCurve: 'continuous',
                padding: spacing.lg,
                gap: spacing.lg,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                }}>
                <Eyebrow tone="accent">waiting on you · @{snapshot.viewer.login}</Eyebrow>
                <AppText variant="caption" tone="accent" style={{ opacity: 0.72 }}>
                  {github.refreshing ? 'refreshing…' : formatAgo(snapshot.fetchedAt)}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <Stat value={snapshot.reviewRequests.length} label="to review" />
                <Stat value={snapshot.authoredPrs.length} label="your PRs" />
                <Stat value={snapshot.assignedIssues.length} label="issues" />
              </View>
            </View>
          </FadeUp>

          <FadeUp index={2}>
            <View>
              <SectionHeader
                eyebrow="needs you"
                title="Open work"
                trailing={
                  <AppText variant="caption" tone="secondary">
                    {waiting === 0 ? 'all clear' : `${waiting} open`}
                  </AppText>
                }
              />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {waiting === 0 ? (
                  <EmptyState
                    icon={CheckCircle}
                    title="Nothing waiting on you"
                    message="No review requests, no open pull requests of your own, no assigned issues."
                  />
                ) : (
                  <>
                    <ItemRows
                      items={snapshot.reviewRequests}
                      prefix="review requested"
                      icon="pr"
                      tone="accent"
                      onOpen={openExternal}
                    />
                    <ItemRows
                      items={snapshot.authoredPrs}
                      prefix="your pull request"
                      icon="pr"
                      tone="neutral"
                      onOpen={openExternal}
                    />
                    <ItemRows
                      items={snapshot.assignedIssues}
                      prefix="assigned to you"
                      icon="issue"
                      tone="neutral"
                      onOpen={openExternal}
                    />
                  </>
                )}
              </Panel>
            </View>
          </FadeUp>

          {snapshot.runs.length > 0 ? (
            <FadeUp index={3}>
              <View>
                <SectionHeader
                  eyebrow="checks"
                  title="Latest run per repo"
                  trailing={
                    <AppText variant="caption" tone="secondary">
                      most recent {snapshot.runs.length}
                    </AppText>
                  }
                />
                <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                  {snapshot.runs.map((run, index) => {
                    const pill = runPill(run);
                    return (
                      <ListRow
                        key={`${run.repo}-${run.runNumber}`}
                        icon={
                          <GitPullRequest size={17} color={colors.textSecondary} weight="light" />
                        }
                        title={shortRepo(run.repo)}
                        subtitle={[run.name, run.branch, formatAgo(run.createdAt)]
                          .filter(Boolean)
                          .join(' · ')}
                        showSeparator={index < snapshot.runs.length - 1}
                        onPress={() => openExternal(run.htmlUrl)}
                        trailing={<StatusPill label={pill.label} tone={pill.tone} />}
                      />
                    );
                  })}
                </Panel>
              </View>
            </FadeUp>
          ) : null}

          <FadeUp index={4}>
            <View>
              <SectionHeader
                eyebrow="recently pushed"
                title="Repositories"
                trailing={
                  <AppText variant="caption" tone="secondary">
                    {snapshot.repos.length} tracked
                  </AppText>
                }
              />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {snapshot.repos.length === 0 ? (
                  <EmptyState
                    icon={GithubLogo}
                    title="No repositories"
                    message="This token cannot see any repositories yet."
                  />
                ) : (
                  snapshot.repos.map((repo, index) => (
                    <ListRow
                      key={repo.fullName}
                      icon={<GithubLogo size={17} color={colors.textSecondary} weight="light" />}
                      title={repo.name}
                      subtitle={[
                        repo.language,
                        `pushed ${formatAgo(repo.pushedAt)}`,
                        repo.openIssues > 0 ? `${repo.openIssues} open issues` : null,
                        repo.stars > 0 ? `${repo.stars} ★` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      showSeparator={index < snapshot.repos.length - 1}
                      onPress={() => openExternal(repo.htmlUrl)}
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          {repo.isPrivate ? <StatusPill label="private" tone="neutral" /> : null}
                          <ArrowSquareOut
                            size={14}
                            color={colors.textTertiary}
                            weight="regular"
                          />
                        </View>
                      }
                    />
                  ))
                )}
              </Panel>
            </View>
          </FadeUp>

          {snapshot.notes.length > 0 ? (
            <FadeUp index={5}>
              <Panel variant="outlined" style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <WarningCircle size={15} color={colors.textTertiary} weight="fill" />
                  <Eyebrow>Partly read</Eyebrow>
                </View>
                {snapshot.notes.map((line) => (
                  <AppText key={line} variant="caption" tone="secondary">
                    {line}
                  </AppText>
                ))}
              </Panel>
            </FadeUp>
          ) : null}

          <FadeUp index={6}>
            <View style={{ gap: spacing.sm }}>
              <Eyebrow>Connection</Eyebrow>
              <AppText variant="caption" tone="tertiary">
                Connected as @{snapshot.viewer.login}. The app only reads
                {snapshot.rate
                  ? ` · ${snapshot.rate.remaining} of ${snapshot.rate.limit} GitHub requests left this hour`
                  : ''}
                . The token is stored on this device only.
              </AppText>
              <AppButton
                label="Disconnect GitHub"
                variant="text"
                onPress={() => void github.disconnect()}
              />
            </View>
          </FadeUp>
        </>
      )}
    </Screen>
  );
}
