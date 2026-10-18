/**
 * One repository, at a glance — and the door to everything you can do to it.
 *
 * The screen is assembled from six reads that each fail independently
 * (`loadRepoHome`): the repo, its branches, the files at the current ref, the
 * open pull requests, the open issues, and the newest runs. A token without
 * Issues still gets the files and the checks; a repo with no workflows still gets
 * everything else. The alternative — one failed read and a blank screen — is the
 * thing this codebase is most careful to avoid.
 *
 * The order is deliberate: **files first**, because that is what people come
 * here for, then what is changing (pull requests), then whether it is green
 * (checks), then the backlog (issues), then history (commits).
 *
 * Writing is per-repository, so the screen asks GitHub what this token may do
 * here (`permissions.push`) and says so plainly before offering an edit.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretRight,
  FilePlus,
  GitBranch,
  GithubLogo,
  Lightning,
  LockSimple,
  GitPullRequest,
  Star,
  Tag,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback, useMemo } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { GithubGate } from '@/components/github/gate';
import { ChipPicker, CommitRow, FileRow, IssueRow, Notice, PullRow, RunRow } from '@/components/github/rows';
import { formatAgo } from '@/lib/format';
import { failureMessage } from '@/lib/github/api';
import { listRuns, type WorkflowRun } from '@/lib/github/ci';
import { listIssues, type IssueSummary } from '@/lib/github/issues';
import { listPulls, type PullSummary } from '@/lib/github/pulls';
import {
  listBranches,
  listCommits,
  listDirectory,
  getRepoDetail,
  type Branch,
  type CommitSummary,
  type RepoDetail,
  type TreeEntry,
} from '@/lib/github/repo';
import { useGithubToken } from '@/lib/github/use-github';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

type RepoHome = {
  detail: RepoDetail;
  branches: Branch[];
  files: TreeEntry[];
  pulls: PullSummary[] | null;
  issues: IssueSummary[] | null;
  runs: WorkflowRun[] | null;
  commits: CommitSummary[] | null;
  /** One sentence per section GitHub refused. */
  notes: string[];
  /** The ref everything above was read at. */
  ref: string;
};

async function loadRepoHome(token: string, repo: string, wantedRef?: string): Promise<RepoHome> {
  const detail = await getRepoDetail(token, repo);
  const ref = wantedRef && wantedRef.length > 0 ? wantedRef : detail.defaultBranch;
  const notes: string[] = [];

  const keep = async <T,>(what: string, work: () => Promise<T>): Promise<T | null> => {
    try {
      return await work();
    } catch (error) {
      notes.push(`${what}: ${failureMessage(error)}`);
      return null;
    }
  };

  const [branches, files, pulls, issues, runs, commits] = await Promise.all([
    keep('Branches', () => listBranches(token, repo, detail.defaultBranch)),
    listDirectory(token, repo, '', ref).catch(async () => {
      // A ref that does not exist is a real possibility after a force-push.
      notes.push(`Files: nothing at ${ref}.`);
      return [] as TreeEntry[];
    }),
    keep('Pull requests', () => listPulls(token, repo, 'open')),
    keep('Issues', () => listIssues(token, repo, 'open', 6)),
    keep('Actions', () => listRuns(token, repo, { limit: 4 })),
    keep('Commits', () => listCommits(token, repo, { ref, limit: 6 })),
  ]);

  return {
    detail,
    ref,
    branches: branches ?? [],
    files,
    pulls,
    issues,
    runs,
    commits,
    notes,
  };
}

export default function RepoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string; ref?: string }>();
  const repo = params.repo ?? '';
  const { token, ready } = useGithubToken();

  const home = useAsyncData(
    () => loadRepoHome(token ?? '', repo, params.ref),
    [token ?? '', repo, params.ref ?? ''],
    { enabled: ready && token !== null && repo.length > 0 },
  );

  const data = home.data;
  const writable = Boolean(data?.detail.canPush) && !data?.detail.archived;

  const openExternal = useCallback((url: string | null) => {
    if (url) void Linking.openURL(url).catch(() => {});
  }, []);

  const setRef = useCallback(
    (next: string) => {
      // The ref lives in the URL, so this screen stays shareable and back-able;
      // changing it re-runs the loader through its dependency list.
      router.setParams({ ref: next });
    },
    [router],
  );

  const branchOptions = useMemo(
    () =>
      (data?.branches ?? []).slice(0, 30).map((branch) => ({
        value: branch.name,
        label: branch.isDefault ? `${branch.name} · default` : branch.name,
      })),
    [data?.branches],
  );

  return (
    <Screen
      header={{
        eyebrow: data?.detail.owner ?? 'repository',
        title: data?.detail.name ?? repo.split('/').pop() ?? 'Repository',
        subtitle: data
          ? [
              data.detail.isPrivate ? 'private' : 'public',
              data.detail.language,
              `at ${data.ref}`,
            ]
              .filter(Boolean)
              .join(' · ')
          : 'reading GitHub…',
        trailing: (
          <PressableScale
            haptic="light"
            accessibilityLabel="Refresh"
            disabled={home.refreshing}
            style={{ opacity: home.refreshing ? 0.45 : 1 }}
            onPress={home.reload}>
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
          <BackRow label="GitHub" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what={`${repo || 'that repository'}`}>
        {() =>
          home.loading ? (
            <Panel>
              <Loading label={`reading ${repo}…`} />
            </Panel>
          ) : !data ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not read that repository</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {home.error ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={home.reload} />
            </Panel>
          ) : (
            <>
              <FadeUp index={1}>
                <Panel style={{ gap: spacing.lg }}>
                  {data.detail.description ? (
                    <AppText variant="subhead" tone="secondary">
                      {data.detail.description}
                    </AppText>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <StatusPill
                      label={writable ? 'can write' : 'read-only'}
                      tone={writable ? 'accent' : 'neutral'}
                    />
                    {data.detail.archived ? <StatusPill label="archived" tone="neutral" /> : null}
                    {data.detail.license ? (
                      <StatusPill label={data.detail.license} tone="neutral" />
                    ) : null}
                    {data.detail.stars > 0 ? (
                      <StatusPill label={`${data.detail.stars} ★`} tone="neutral" />
                    ) : null}
                    {data.detail.forks > 0 ? (
                      <StatusPill label={`${data.detail.forks} forks`} tone="neutral" />
                    ) : null}
                    <StatusPill
                      label={`${data.detail.openIssues} open`}
                      tone={data.detail.openIssues > 0 ? 'info' : 'neutral'}
                    />
                  </View>
                  <AppText variant="caption" tone="tertiary">
                    {data.detail.pushedAt
                      ? `Last push ${formatAgo(data.detail.pushedAt)}.`
                      : 'No pushes yet.'}
                    {writable
                      ? ' Edits commit to a branch and open a pull request — never straight to a default branch.'
                      : ' This token can read here but not write: a fine-grained token needs Contents: write, a classic one needs the repo scope.'}
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <AppButton
                      label="Pull requests"
                      icon={GitPullRequest}
                      variant="tonal"
                      onPress={() =>
                        router.push({ pathname: '/github/pulls', params: { repo } })
                      }
                    />
                    <AppButton
                      label="Issues"
                      icon={GithubLogo}
                      variant="tonal"
                      onPress={() =>
                        router.push({ pathname: '/github/issues', params: { repo } })
                      }
                    />
                    <AppButton
                      label="Actions"
                      icon={Lightning}
                      variant="tonal"
                      onPress={() =>
                        router.push({ pathname: '/github/actions', params: { repo } })
                      }
                    />
                    <AppButton
                      label="Releases"
                      icon={Tag}
                      variant="tonal"
                      onPress={() =>
                        router.push({ pathname: '/github/release', params: { repo } })
                      }
                    />
                    <AppButton
                      label="On GitHub"
                      icon={ArrowSquareOut}
                      variant="text"
                      onPress={() => openExternal(data.detail.htmlUrl)}
                    />
                  </View>
                </Panel>
              </FadeUp>

              {data.branches.length > 0 ? (
                <FadeUp index={2}>
                  <ChipPicker
                    label={`browsing at ${data.ref}`}
                    options={branchOptions}
                    value={data.branches.some((branch) => branch.name === data.ref) ? data.ref : null}
                    onChange={setRef}
                  />
                </FadeUp>
              ) : null}

              <FadeUp index={3}>
                <View>
                  <SectionHeader
                    eyebrow="files"
                    title={data.ref}
                    actionLabel={writable ? 'New file' : undefined}
                    onAction={
                      writable
                        ? () =>
                            router.push({
                              pathname: '/github/edit',
                              params: { repo, path: '', ref: data.ref },
                            })
                        : undefined
                    }
                  />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.files.length === 0 ? (
                      <EmptyState
                        icon={FilePlus}
                        title="Nothing at this ref"
                        message="That branch may be empty, or the token cannot read its contents."
                      />
                    ) : (
                      data.files.map((entry, index) => (
                        <FileRow
                          key={entry.path}
                          entry={entry}
                          showSeparator={index < data.files.length - 1}
                          onPress={() =>
                            router.push({
                              pathname: entry.type === 'dir' ? '/github/browse' : '/github/blob',
                              params: { repo, path: entry.path, ref: data.ref },
                            })
                          }
                        />
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={4}>
                <View>
                  <SectionHeader
                    eyebrow="open"
                    title="Pull requests"
                    actionLabel="All"
                    onAction={() => router.push({ pathname: '/github/pulls', params: { repo } })}
                  />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.pulls === null ? (
                      <Notice
                        title="Not read"
                        body={data.notes.find((line) => line.startsWith('Pull requests'))}
                        style={{ margin: spacing.md }}
                      />
                    ) : data.pulls.length === 0 ? (
                      <EmptyState
                        icon={GitPullRequest}
                        title="No open pull requests"
                        message="Nothing is waiting to be merged."
                      />
                    ) : (
                      data.pulls.slice(0, 5).map((pull, index) => (
                        <PullRow
                          key={pull.number}
                          pull={pull}
                          showSeparator={index < Math.min(data.pulls!.length, 5) - 1}
                          onPress={() =>
                            router.push({
                              pathname: '/github/pr',
                              params: { repo, number: String(pull.number) },
                            })
                          }
                        />
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={5}>
                <View>
                  <SectionHeader
                    eyebrow="checks"
                    title="Recent runs"
                    actionLabel="Actions"
                    onAction={() => router.push({ pathname: '/github/actions', params: { repo } })}
                  />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.runs === null ? (
                      <Notice
                        title="Not read"
                        body={data.notes.find((line) => line.startsWith('Actions'))}
                        style={{ margin: spacing.md }}
                      />
                    ) : data.runs.length === 0 ? (
                      <EmptyState
                        icon={Lightning}
                        title="No workflow runs"
                        message="This repository has no runs on record — or no workflows."
                      />
                    ) : (
                      data.runs.map((run, index) => (
                        <RunRow
                          key={run.id}
                          run={run}
                          showSeparator={index < data.runs!.length - 1}
                          onPress={() =>
                            router.push({
                              pathname: '/github/actions',
                              params: { repo, run: String(run.id) },
                            })
                          }
                        />
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={6}>
                <View>
                  <SectionHeader
                    eyebrow="backlog"
                    title="Open issues"
                    actionLabel="All"
                    onAction={() => router.push({ pathname: '/github/issues', params: { repo } })}
                  />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.issues === null ? (
                      <Notice
                        title="Not read"
                        body={data.notes.find((line) => line.startsWith('Issues'))}
                        style={{ margin: spacing.md }}
                      />
                    ) : data.issues.length === 0 ? (
                      <EmptyState
                        icon={GithubLogo}
                        title="No open issues"
                        message="The backlog is empty."
                      />
                    ) : (
                      data.issues.map((issue, index) => (
                        <IssueRow
                          key={issue.number}
                          issue={issue}
                          showSeparator={index < data.issues!.length - 1}
                          onPress={() =>
                            router.push({
                              pathname: '/github/issue',
                              params: { repo, number: String(issue.number) },
                            })
                          }
                        />
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={7}>
                <View>
                  <SectionHeader eyebrow="history" title={`Commits on ${data.ref}`} />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.commits === null ? (
                      <Notice
                        title="Not read"
                        body={data.notes.find((line) => line.startsWith('Commits'))}
                        style={{ margin: spacing.md }}
                      />
                    ) : data.commits.length === 0 ? (
                      <EmptyState
                        icon={GitBranch}
                        title="No commits yet"
                        message="This branch has no history."
                      />
                    ) : (
                      data.commits.map((commit, index) => (
                        <CommitRow
                          key={commit.sha}
                          commit={commit}
                          showSeparator={index < data.commits!.length - 1}
                          onPress={() => openExternal(commit.htmlUrl)}
                        />
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={8}>
                <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
                  {data.detail.isPrivate ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <LockSimple size={14} color={colors.textTertiary} weight="regular" />
                      <AppText variant="caption" tone="tertiary">
                        private
                      </AppText>
                    </View>
                  ) : null}
                  {data.detail.stars > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Star size={14} color={colors.textTertiary} weight="regular" />
                      <AppText variant="caption" tone="tertiary">
                        {data.detail.stars}
                      </AppText>
                    </View>
                  ) : null}
                  <PressableScale
                    haptic="selection"
                    onPress={() => openExternal(`${data.detail.htmlUrl}/commits/${data.ref}`)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <AppText variant="caption" tone="accent">
                        Commit history on GitHub
                      </AppText>
                      <CaretRight size={12} color={colors.accent} weight="regular" />
                    </View>
                  </PressableScale>
                </View>
              </FadeUp>
            </>
          )
        }
      </GithubGate>
    </Screen>
  );
}
