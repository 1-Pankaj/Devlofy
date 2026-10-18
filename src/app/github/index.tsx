/**
 * GitHub — the hub, and the one screen in this app that needs a network.
 *
 * Everything else Devlofy does happens on the device; the code you are shipping
 * is the part that doesn't. This screen answers one question — *what on GitHub
 * is waiting for me?* — and it is now the front door to the whole two-way
 * surface: repositories you can browse and edit, pull requests you can review
 * and merge, issues you can triage, runs you can re-run, and an inbox.
 *
 * Two rules from v0.4 still hold, and one is new:
 *
 *  1. **The token decides.** Sections are fetched independently (see `api.ts`),
 *     so a limited token loses a section and never the screen.
 *  2. **What we could not read is said out loud,** in `notes`, rather than
 *     becoming a silent zero.
 *  3. **Writes are bounded** (ADR-020): never `main` by default, always the diff
 *     first, never a force-push, never a branch deletion.
 *
 * Two ways in, because the platform decides:
 *
 *  - **Pasted token** — works everywhere, and is the only option on web
 *    (`github.com`'s OAuth endpoints send no CORS headers, so the device flow
 *    cannot complete in a browser). A fine-grained token can be given read-only
 *    or write access per repository; both work here.
 *  - **Device flow** — Android only, and only once a client ID is configured in
 *    `app.json`. The user approves a code in any browser they have open. That
 *    token is necessarily a classic `repo` token, which can write.
 */
import { useRouter } from 'expo-router';
import {
  ArrowClockwise,
  ArrowSquareOut,
  Bell,
  CheckCircle,
  CircleIcon,
  FolderOpen,
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
import { listNotifications } from '@/lib/github/issues';
import { useGithub } from '@/lib/github/use-github';
import { useAsyncData } from '@/lib/use-async-data';
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

export default function GithubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const github = useGithub();

  const [tokenDraft, setTokenDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const canSignIn = GITHUB_DEVICE_FLOW_AVAILABLE;
  const snapshot = github.snapshot;
  const connected = github.ready && github.auth !== null;
  const token = github.auth?.token ?? null;

  /** The inbox is one request, and it is the only *pushed* thing GitHub has. */
  const inbox = useAsyncData(() => listNotifications(token ?? ''), [token ?? ''], {
    enabled: Boolean(token),
  });
  const unread = (inbox.data ?? []).filter((entry) => entry.unread).length;

  const openExternal = useCallback((url: string | null) => {
    if (!url) return;
    void Linking.openURL(url).catch(() => {});
  }, []);

  const openRepo = useCallback(
    (fullName: string) => router.push({ pathname: '/github/repo', params: { repo: fullName } }),
    [router],
  );

  const openItem = useCallback(
    (item: GithubItem) => {
      if (item.kind === 'pr' && item.repo && item.number > 0) {
        router.push({
          pathname: '/github/pr',
          params: { repo: item.repo, number: String(item.number) },
        });
        return;
      }
      if (item.kind === 'issue' && item.repo && item.number > 0) {
        router.push({
          pathname: '/github/issue',
          params: { repo: item.repo, number: String(item.number) },
        });
        return;
      }
      openExternal(item.htmlUrl);
    },
    [openExternal, router],
  );

  const openRun = useCallback(
    (run: GithubRun) => {
      router.push({
        pathname: '/github/actions',
        params: { repo: run.repo, run: String(run.id) },
      });
    },
    [router],
  );

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
      onPress={() => {
        void github.refresh();
        inbox.reload();
      }}
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
          ? `@${snapshot?.viewer.login ?? '…'} · ${waiting} waiting on you`
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
                Read the pull requests waiting on a review, your own open pull requests, the issues
                assigned to you, and the newest check per repo — then act on them here: edit a file
                and open a pull request, review and merge, triage issues, re-run a workflow. Nothing
                is ever pushed straight to a default branch, and nothing is committed without
                showing you the diff first.
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
                  A fine-grained token with Contents, Issues and Actions access is enough; add
                  <AppText variant="captionMedium" tone="secondary">
                    {' '}
                    Contents: read and write{' '}
                  </AppText>
                  to commit from here. A classic token with the repo scope also works. It is kept in
                  this device&apos;s local storage — the app has no server to hold it, and it never
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
                  label="Create a token on GitHub"
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
                    {[
                      ...snapshot.reviewRequests.map((item) => ({ item, prefix: 'review requested', tone: 'accent' as const })),
                      ...snapshot.authoredPrs.map((item) => ({ item, prefix: 'your pull request', tone: 'neutral' as const })),
                      ...snapshot.assignedIssues.map((item) => ({ item, prefix: 'assigned to you', tone: 'neutral' as const })),
                    ].map(({ item, prefix, tone }, index, all) => (
                      <ListRow
                        key={`${item.kind}-${item.repo}-${item.number}`}
                        icon={
                          item.kind === 'pr' ? (
                            <GitPullRequest
                              size={17}
                              color={tone === 'accent' ? colors.accent : colors.textSecondary}
                              weight="light"
                            />
                          ) : (
                            <CircleIcon size={17} color={colors.info} weight="bold" />
                          )
                        }
                        tone={item.kind === 'pr' ? tone : 'info'}
                        title={item.title}
                        subtitle={itemSubtitle(item, prefix)}
                        showSeparator={index < all.length - 1}
                        onPress={() => openItem(item)}
                        trailing={<StatusPill label="open in app" tone="neutral" />}
                      />
                    ))}
                  </>
                )}
              </Panel>
            </View>
          </FadeUp>

          <FadeUp index={3}>
            <View>
              <SectionHeader eyebrow="inbox" title="Notifications" />
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                <ListRow
                  icon={<Bell size={17} color={colors.accent} weight="regular" />}
                  tone="accent"
                  title="What changed while you were away"
                  subtitle={
                    inbox.error
                      ? 'this token cannot read the inbox'
                      : inbox.loading
                        ? 'reading…'
                        : unread === 0
                          ? 'nothing unread'
                          : `${unread} unread`
                  }
                  trailing={<ArrowSquareOut size={14} color={colors.textTertiary} weight="regular" />}
                  onPress={() => router.push('/github/notifications')}
                />
              </Panel>
            </View>
          </FadeUp>

          {snapshot.runs.length > 0 ? (
            <FadeUp index={4}>
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
                        onPress={() => openRun(run)}
                        trailing={<StatusPill label={pill.label} tone={pill.tone} />}
                      />
                    );
                  })}
                </Panel>
              </View>
            </FadeUp>
          ) : null}

          <FadeUp index={5}>
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
                      icon={<FolderOpen size={17} color={colors.accent} weight="light" />}
                      tone="accent"
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
                      onPress={() => openRepo(repo.fullName)}
                      trailing={
                        // One action per row: this opens the repository here. The
                        // outbound link lives on the repository screen, because a
                        // second button inside this one would nest two controls in
                        // the same tap target.
                        repo.isPrivate ? <StatusPill label="private" tone="neutral" /> : null
                      }
                    />
                  ))
                )}
              </Panel>
            </View>
          </FadeUp>

          {snapshot.notes.length > 0 ? (
            <FadeUp index={6}>
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

          <FadeUp index={7}>
            <View style={{ gap: spacing.sm }}>
              <Eyebrow>Connection</Eyebrow>
              <AppText variant="caption" tone="tertiary">
                Connected as @{snapshot.viewer.login}. The app can read and write; whether it may
                write to a repository is GitHub&apos;s decision, per repository, and each repo screen
                says which.
                {snapshot.rate
                  ? ` ${snapshot.rate.remaining} of ${snapshot.rate.limit} requests left this hour.`
                  : ''}
                {github.auth && github.auth.scopes.length > 0
                  ? ` Scopes: ${github.auth.scopes.join(', ')}.`
                  : ''}
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
