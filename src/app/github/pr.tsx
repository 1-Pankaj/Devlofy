/**
 * One pull request — read it, review it, merge it.
 *
 * This is the deepest screen in the app, and the order of it is an argument:
 *
 *  1. **What it is** — state, mergeability, branches, size.
 *  2. **What it needs** — the merge button, or the reason it cannot be pressed.
 *  3. **Your verdict** — approve, request changes, or comment. One text field,
 *     three honest buttons.
 *  4. **The evidence** — checks, then the diff, then the conversation.
 *
 * Two details carry the weight here:
 *
 *  - The merge is sent with the `sha` this screen displayed. If the branch moved
 *    while it was open, GitHub refuses (`409`) instead of merging something the
 *    user never saw.
 *  - `mergeable` is `null` on a fresh pull request while GitHub computes it.
 *    `null` is rendered as "still working it out", never as "yes".
 */
import { useLocalSearchParams } from 'expo-router';
import {
  ArrowSquareOut,
  ChatCircle,
  CheckCircle,
  GitBranch,
  GitMerge,
  GitPullRequest,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill, type StatusTone } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { GithubGate } from '@/components/github/gate';
import { CheckRow, ChipPicker, MultiChipPicker, Notice, StateDot } from '@/components/github/rows';
import { DiffStat, DiffView } from '@/components/github/diff-view';
import { formatAgo } from '@/lib/format';
import { listAssignableUsers } from '@/lib/github/issues';
import { parsePatch } from '@/lib/github/patch';
import {
  addPullComment,
  getChecksForRef,
  getPull,
  listConversation,
  listPullFiles,
  markReadyForReview,
  mergePull,
  mergeableLabel,
  requestReviewers,
  submitReview,
  updatePull,
  type CheckSummary,
  type MergeMethod,
  type PullDetail,
  type PullFile,
  type ReviewComment,
  type ReviewEvent,
} from '@/lib/github/pulls';
import { useGithubToken } from '@/lib/github/use-github';
import { useAction } from '@/lib/use-action';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

type PullBundle = {
  pull: PullDetail;
  files: PullFile[];
  checks: CheckSummary;
  conversation: ReviewComment[];
  /** People with access — the pool a review can be requested from. */
  reviewers: string[];
  notes: string[];
};

async function loadPull(token: string, repo: string, number: number): Promise<PullBundle> {
  const pull = await getPull(token, repo, number);
  const notes: string[] = [];

  const keep = async <T,>(what: string, work: () => Promise<T>, empty: T): Promise<T> => {
    try {
      return await work();
    } catch {
      notes.push(what);
      return empty;
    }
  };

  const [files, checks, conversation, reviewers] = await Promise.all([
    keep('the file list', () => listPullFiles(token, repo, number), [] as PullFile[]),
    keep('the checks', () => getChecksForRef(token, repo, pull.headSha), {
      state: 'unknown' as const,
      items: [],
      passing: 0,
      failing: 0,
      running: 0,
    }),
    keep('the conversation', () => listConversation(token, repo, number), [] as ReviewComment[]),
    keep('the collaborator list', () => listAssignableUsers(token, repo), [] as string[]),
  ]);

  return { pull, files, checks, conversation, reviewers, notes };
}

export default function PullScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ repo?: string; number?: string }>();
  const repo = params.repo ?? '';
  const number = Number(params.number ?? 0);
  const { token, ready } = useGithubToken();

  const bundle = useAsyncData(() => loadPull(token ?? '', repo, number), [token ?? '', repo, number], {
    enabled: ready && token !== null && repo.length > 0 && number > 0,
  });

  const [method, setMethod] = useState<MergeMethod>('merge');
  const [reviewBody, setReviewBody] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewersDraft, setReviewersDraft] = useState<string[]>([]);

  const action = useAction();
  const pull = bundle.data?.pull;

  const openExternal = useCallback((url: string | null) => {
    if (url) void Linking.openURL(url).catch(() => {});
  }, []);

  const afterWrite = useCallback(() => {
    setReviewBody('');
    setCommentBody('');
    bundle.reload();
  }, [bundle]);

  const approve = useCallback(
    (event: ReviewEvent) =>
      action.run(
        () =>
          submitReview(token ?? '', {
            repo,
            number,
            event,
            body: reviewBody,
            commitId: pull?.headSha,
          }),
        {
          success:
            event === 'APPROVE'
              ? 'Approved.'
              : event === 'REQUEST_CHANGES'
                ? 'Changes requested.'
                : 'Review posted.',
        },
      ).then((outcome) => {
        if (outcome.ok) afterWrite();
      }),
    [action, afterWrite, number, pull?.headSha, repo, reviewBody, token],
  );

  const comment = useCallback(
    () =>
      action
        .run(() => addPullComment(token ?? '', { repo, number, body: commentBody }), {
          success: 'Comment posted.',
        })
        .then((outcome) => {
          if (outcome.ok) afterWrite();
        }),
    [action, afterWrite, commentBody, number, repo, token],
  );

  const merge = useCallback(
    () =>
      action
        .run(
          () =>
            mergePull(token ?? '', {
              repo,
              number,
              method,
              sha: pull?.headSha,
              commitTitle: pull ? `${pull.title} (#${pull.number})` : undefined,
            }),
          { success: 'Merged.' },
        )
        .then((outcome) => {
          if (outcome.ok) bundle.reload();
        }),
    [action, bundle, method, number, pull, repo, token],
  );

  const ready_ = useCallback(
    () =>
      action
        .run(() => markReadyForReview(token ?? '', pull?.nodeId ?? ''), {
          success: 'Marked ready for review.',
        })
        .then((outcome) => {
          if (outcome.ok) bundle.reload();
        }),
    [action, bundle, pull?.nodeId, token],
  );

  /**
   * Asking for a review is the one social action a PR has. It is a separate call
   * from submitting one, so the two never get conflated.
   */
  const requestReview = useCallback(
    () =>
      action
        .run(
          () => requestReviewers(token ?? '', { repo, number, reviewers: reviewersDraft }),
          { success: `Asked ${reviewersDraft.length} for a review.` },
        )
        .then((outcome) => {
          if (outcome.ok) {
            setReviewersDraft([]);
            bundle.reload();
          }
        }),
    [action, bundle, number, repo, reviewersDraft, token],
  );

  const setState = useCallback(
    (next: 'open' | 'closed') =>
      action
        .run(() => updatePull(token ?? '', { repo, number, state: next }), {
          success: next === 'closed' ? 'Closed.' : 'Reopened.',
        })
        .then((outcome) => {
          if (outcome.ok) bundle.reload();
        }),
    [action, bundle, number, repo, token],
  );

  const stateTone: StatusTone = useMemo(() => {
    if (!pull) return 'neutral';
    if (pull.state === 'merged') return 'accent';
    if (pull.state === 'closed') return 'neutral';
    return pull.draft ? 'neutral' : 'info';
  }, [pull]);

  const canMerge =
    pull?.state === 'open' && pull.mergeable === true && !pull.draft && Boolean(pull.headSha);
  const readable = pull ? mergeableLabel(pull.draft ? 'draft' : pull.mergeableState) : null;

  return (
    <Screen
      header={{
        eyebrow: repo,
        title: `#${number}`,
        subtitle: pull?.title ?? 'reading GitHub…',
        trailing: pull ? <StatusPill label={pull.state} tone={stateTone} /> : undefined,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Pull requests" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="that pull request">
        {() =>
          bundle.loading ? (
            <Panel>
              <Loading label={`reading pull request #${number}…`} />
            </Panel>
          ) : !bundle.data || !pull ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not read that pull request</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {bundle.error ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={bundle.reload} />
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
                    gap: spacing.md,
                  }}>
                  <AppText variant="headline" style={{ color: colors.text }}>
                    {pull.title}
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <StatusPill label={pull.state} tone={stateTone} />
                    {pull.draft ? <StatusPill label="draft" tone="neutral" /> : null}
                    {readable ? <StatusPill label={readable.label} tone={readable.tone} /> : null}
                  </View>
                  <AppText variant="caption" tone="secondary">
                    @{pull.author} wants {pull.headRef} → {pull.baseRef}
                    {pull.isCrossRepo ? ' (from a fork)' : ''} · updated {formatAgo(pull.updatedAt)}
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <DiffStat added={pull.additions} removed={pull.deletions} />
                      <AppText variant="caption" tone="tertiary">
                        across {pull.changedFiles} {pull.changedFiles === 1 ? 'file' : 'files'}
                      </AppText>
                    </View>
                    <AppText variant="caption" tone="tertiary">
                      {pull.commits} commits · {pull.comments} comments
                    </AppText>
                  </View>
                  {pull.requestedReviewers.length > 0 ? (
                    <AppText variant="caption" tone="secondary">
                      Reviewers asked: {pull.requestedReviewers.map((name) => `@${name}`).join(', ')}
                    </AppText>
                  ) : null}
                  {pull.reviewers.length > 0 ? (
                    <AppText variant="caption" tone="secondary">
                      Verdicts: {pull.reviewers.map((r) => `${r.login} ${r.state.toLowerCase()}`).join(' · ')}
                    </AppText>
                  ) : null}
                  <AppButton
                    label="Open on GitHub"
                    icon={ArrowSquareOut}
                    variant="text"
                    onPress={() => openExternal(pull.htmlUrl)}
                  />
                </View>
              </FadeUp>

              {pull.body.trim().length > 0 ? (
                <FadeUp index={2}>
                  <Panel style={{ gap: spacing.sm }}>
                    <Eyebrow>Description</Eyebrow>
                    <AppText variant="subhead" tone="secondary">
                      {pull.body}
                    </AppText>
                  </Panel>
                </FadeUp>
              ) : null}

              {/* The decision. */}
              {pull.state === 'open' ? (
                <FadeUp index={3}>
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader eyebrow="merge" title="Landing it" />
                    <Panel style={{ gap: spacing.lg }}>
                      {pull.draft ? (
                        <>
                          <AppText variant="subhead" tone="secondary">
                            This is a draft, so GitHub will not merge it. Mark it ready when it is.
                          </AppText>
                          <AppButton
                            label={action.busy ? 'Marking…' : 'Mark ready for review'}
                            icon={CheckCircle}
                            disabled={action.busy}
                            onPress={() => void ready_()}
                          />
                        </>
                      ) : pull.mergeable === null ? (
                        <AppText variant="subhead" tone="secondary">
                          GitHub is still working out whether this can merge. Refresh in a moment.
                        </AppText>
                      ) : pull.mergeable === false ? (
                        <Notice
                          tone="danger"
                          title={`Cannot merge — ${readable?.label ?? 'GitHub says no'}`}
                          body={
                            pull.mergeableState === 'dirty'
                              ? 'There are conflicts with the base branch. Resolve them on GitHub, then come back.'
                              : 'A required check or review is missing. GitHub will not let this through yet.'
                          }
                        />
                      ) : (
                        <AppText variant="subhead" tone="secondary">
                          {pull.changedFiles} files, {pull.additions} added, {pull.deletions} removed.
                          Nothing is merged until you press the button.
                        </AppText>
                      )}

                      {!pull.draft && pull.mergeable === true ? (
                        <>
                          <ChipPicker
                            label="how"
                            options={[
                              { value: 'merge', label: 'merge commit' },
                              { value: 'squash', label: 'squash' },
                              { value: 'rebase', label: 'rebase' },
                            ]}
                            value={method}
                            onChange={setMethod}
                          />
                          <AppButton
                            label={action.busy ? 'Merging…' : `Merge with a ${method === 'merge' ? 'merge commit' : method}`}
                            icon={GitMerge}
                            full
                            disabled={!canMerge || action.busy}
                            onPress={() => void merge()}
                          />
                          <AppText variant="caption" tone="tertiary">
                            Sent with the head commit this screen is showing, so a branch that moved
                            underneath us is refused rather than merged unseen.
                          </AppText>
                        </>
                      ) : null}
                    </Panel>
                  </View>
                </FadeUp>
              ) : null}

              {/* Your verdict. */}
              {pull.state === 'open' && !pull.draft ? (
                <FadeUp index={4}>
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader eyebrow="review" title="Your call" />
                    <Panel style={{ gap: spacing.md }}>
                      <TextField
                        label="A line or two (required to request changes)"
                        value={reviewBody}
                        onChangeText={setReviewBody}
                        placeholder="Looks right — one nit on the naming."
                        multiline
                        editable={!action.busy}
                      />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <AppButton
                          label="Approve"
                          icon={CheckCircle}
                          variant="tonal"
                          disabled={action.busy}
                          onPress={() => void approve('APPROVE')}
                        />
                        <AppButton
                          label="Request changes"
                          icon={WarningCircle}
                          variant="outlined"
                          disabled={action.busy || reviewBody.trim().length === 0}
                          onPress={() => void approve('REQUEST_CHANGES')}
                        />
                      </View>
                    </Panel>
                  </View>
                </FadeUp>
              ) : null}

              {/* Asking. */}
              {pull.state === 'open' && bundle.data.reviewers.length > 0 ? (
                <FadeUp index={4}>
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader eyebrow="reviewers" title="Ask someone" />
                    <Panel style={{ gap: spacing.md }}>
                      <MultiChipPicker
                        label="request a review from"
                        options={bundle.data.reviewers
                          .filter((login) => login !== pull.author)
                          .slice(0, 12)
                          .map((login) => ({ value: login, label: `@${login}` }))}
                        selected={reviewersDraft}
                        onToggle={(value) =>
                          setReviewersDraft(
                            reviewersDraft.includes(value)
                              ? reviewersDraft.filter((login) => login !== value)
                              : [...reviewersDraft, value],
                          )
                        }
                      />
                      <AppButton
                        label={action.busy ? 'Asking…' : 'Request a review'}
                        variant="tonal"
                        disabled={reviewersDraft.length === 0 || action.busy}
                        onPress={() => void requestReview()}
                      />
                    </Panel>
                  </View>
                </FadeUp>
              ) : null}

              {action.error ? (
                <FadeUp index={4}>
                  <AppText variant="caption" tone="danger">
                    {action.error}
                  </AppText>
                </FadeUp>
              ) : null}
              {action.message ? (
                <FadeUp index={4}>
                  <AppText variant="caption" tone="accent">
                    {action.message}
                  </AppText>
                </FadeUp>
              ) : null}

              {/* The evidence. */}
              {bundle.data.checks.items.length > 0 ? (
                <FadeUp index={5}>
                  <View>
                    <SectionHeader
                      eyebrow={`${bundle.data.checks.passing} passing · ${bundle.data.checks.failing} failing`}
                      title="Checks"
                      trailing={<StateDot state={bundle.data.checks.state} />}
                    />
                    <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                      {bundle.data.checks.items.map((item, index) => (
                        <CheckRow
                          key={`${item.source}-${item.name}`}
                          item={item}
                          showSeparator={index < bundle.data!.checks.items.length - 1}
                        />
                      ))}
                    </Panel>
                  </View>
                </FadeUp>
              ) : (
                <FadeUp index={5}>
                  <Panel variant="outlined">
                    <AppText variant="caption" tone="tertiary">
                      No checks reported on {pull.headSha.slice(0, 7)}
                      {bundle.data.notes.length > 0 ? ' — or this token cannot read them.' : '.'}
                    </AppText>
                  </Panel>
                </FadeUp>
              )}

              <FadeUp index={6}>
                <View>
                  <SectionHeader eyebrow="diff" title="Files changed" />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {bundle.data.files.length === 0 ? (
                      <EmptyState
                        icon={GitPullRequest}
                        title="No file list"
                        message="GitHub returned no files for this pull request — it may be too large, or the list was refused."
                      />
                    ) : (
                      bundle.data.files.map((file, index) => {
                        const isOpen = expanded === file.filename;
                        return (
                          <View key={file.filename}>
                            <PressableScale
                              haptic="selection"
                              onPress={() => setExpanded(isOpen ? null : file.filename)}>
                              <View
                                style={{
                                  paddingVertical: spacing.md,
                                  paddingHorizontal: spacing.lg,
                                  gap: spacing.xs,
                                  borderBottomWidth:
                                    index < bundle.data!.files.length - 1 || isOpen ? 1 : 0,
                                  borderBottomColor: colors.hairline,
                                }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: spacing.md,
                                  }}>
                                  <AppText
                                    variant="captionMedium"
                                    numberOfLines={1}
                                    style={{ flex: 1 }}>
                                    {file.filename}
                                  </AppText>
                                  <DiffStat added={file.additions} removed={file.deletions} />
                                </View>
                                <AppText variant="caption" tone="tertiary">
                                  {file.status}
                                  {file.previousFilename ? ` · was ${file.previousFilename}` : ''}
                                  {file.patch ? ' · tap to read the diff' : ' · no diff available'}
                                </AppText>
                              </View>
                            </PressableScale>
                            {isOpen && file.patch ? (
                              <View style={{ padding: spacing.md }}>
                                <DiffView hunks={parsePatch(file.patch)} />
                              </View>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={7}>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader eyebrow="conversation" title="What was said" />
                  {bundle.data.conversation.length === 0 ? (
                    <Panel coreStyle={{ padding: 0 }}>
                      <EmptyState
                        icon={ChatCircle}
                        title="Nothing said yet"
                        message="Be the first — a review comment counts."
                      />
                    </Panel>
                  ) : (
                    bundle.data.conversation.map((entry) => (
                      <Panel key={`${entry.state ?? 'comment'}-${entry.id}`} style={{ gap: spacing.xs }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: spacing.md,
                          }}>
                          <AppText variant="captionMedium">
                            @{entry.author}
                            {entry.state ? ` · ${entry.state.toLowerCase().replace(/_/g, ' ')}` : ''}
                          </AppText>
                          <AppText variant="caption" tone="tertiary">
                            {formatAgo(entry.createdAt)}
                          </AppText>
                        </View>
                        <AppText variant="subhead" tone="secondary">
                          {entry.body}
                        </AppText>
                      </Panel>
                    ))
                  )}

                  {pull.state === 'open' ? (
                    <Panel style={{ gap: spacing.md }}>
                      <TextField
                        label="Add to the conversation"
                        value={commentBody}
                        onChangeText={setCommentBody}
                        placeholder="Answer, ask, or note something for later."
                        multiline
                        editable={!action.busy}
                      />
                      <AppButton
                        label="Comment"
                        icon={ChatCircle}
                        variant="tonal"
                        disabled={action.busy || commentBody.trim().length === 0}
                        onPress={() => void comment()}
                      />
                    </Panel>
                  ) : null}
                </View>
              </FadeUp>

              <FadeUp index={8}>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader eyebrow="housekeeping" title={pull.state === 'open' ? 'Close it' : 'Bring it back'} />
                  <Panel style={{ gap: spacing.md }}>
                    <AppText variant="caption" tone="secondary">
                      {pull.state === 'open'
                        ? 'Closing does not merge anything or delete the branch. It can be reopened.'
                        : 'Reopening puts it back in the open list, exactly as it was.'}
                    </AppText>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {pull.state === 'open' ? (
                        <AppButton
                          label="Close without merging"
                          variant="outlined"
                          disabled={action.busy}
                          onPress={() => void setState('closed')}
                        />
                      ) : (
                        <AppButton
                          label="Reopen"
                          icon={GitBranch}
                          variant="tonal"
                          disabled={action.busy}
                          onPress={() => void setState('open')}
                        />
                      )}
                    </View>
                  </Panel>
                </View>
              </FadeUp>
            </>
          )
        }
      </GithubGate>
    </Screen>
  );
}
