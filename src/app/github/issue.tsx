/**
 * One issue — read it, answer it, label it, close it.
 *
 * The three things a solo dev actually does to an issue from a phone: read what
 * it says, reply, and either tag it or close it. So the screen is those three,
 * in that order, with the labels GitHub already has offered as chips rather than
 * a text box you could typo.
 */
import { useLocalSearchParams } from 'expo-router';
import { ChatCircle, CheckCircle, ArrowSquareOut, WarningCircle } from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { GithubGate } from '@/components/github/gate';
import { MultiChipPicker, Notice } from '@/components/github/rows';
import { formatAgo } from '@/lib/format';
import {
  addIssueComment,
  getIssue,
  listAssignableUsers,
  listIssueComments,
  listLabels,
  updateIssue,
  type IssueComment,
  type IssueDetail,
  type Label,
} from '@/lib/github/issues';
import { useGithubToken } from '@/lib/github/use-github';
import { useAction } from '@/lib/use-action';
import { useAsyncData } from '@/lib/use-async-data';
import { spacing, useTheme } from '@/theme';

type IssueBundle = {
  issue: IssueDetail;
  comments: IssueComment[];
  labels: Label[];
  assignable: string[];
};

async function loadIssue(token: string, repo: string, number: number): Promise<IssueBundle> {
  const issue = await getIssue(token, repo, number);
  const [comments, labels, assignable] = await Promise.all([
    listIssueComments(token, repo, number).catch(() => [] as IssueComment[]),
    listLabels(token, repo).catch(() => [] as Label[]),
    listAssignableUsers(token, repo).catch(() => [] as string[]),
  ]);
  return { issue, comments, labels, assignable };
}

export default function IssueScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ repo?: string; number?: string }>();
  const repo = params.repo ?? '';
  const number = Number(params.number ?? 0);
  const { token, ready } = useGithubToken();

  const bundle = useAsyncData(
    () => loadIssue(token ?? '', repo, number),
    [token ?? '', repo, number],
    { enabled: ready && token !== null && repo.length > 0 && number > 0 },
  );

  const issue = bundle.data?.issue;
  const [body, setBody] = useState('');
  const [labelsDraft, setLabelsDraft] = useState<string[] | null>(null);
  const [assigneesDraft, setAssigneesDraft] = useState<string[] | null>(null);
  const action = useAction();

  /** The draft is null until touched — the issue itself is the source of truth. */
  const labels = useMemo(() => labelsDraft ?? issue?.labels ?? [], [labelsDraft, issue?.labels]);
  const assignees = useMemo(
    () => assigneesDraft ?? issue?.assignees ?? [],
    [assigneesDraft, issue?.assignees],
  );

  const send = useCallback(
    () =>
      action
        .run(() => addIssueComment(token ?? '', { repo, number, body }), {
          success: 'Comment posted.',
        })
        .then((outcome) => {
          if (outcome.ok) {
            setBody('');
            bundle.reload();
          }
        }),
    [action, body, bundle, number, repo, token],
  );

  const save = useCallback(
    () =>
      action
        .run(
          () => updateIssue(token ?? '', { repo, number, labels, assignees }),
          { success: 'Issue updated.' },
        )
        .then((outcome) => {
          if (outcome.ok) {
            setLabelsDraft(null);
            setAssigneesDraft(null);
            bundle.reload();
          }
        }),
    [action, assignees, bundle, labels, number, repo, token],
  );

  const close = useCallback(
    (next: 'open' | 'closed') =>
      action
        .run(() => updateIssue(token ?? '', { repo, number, state: next }), {
          success: next === 'closed' ? 'Closed.' : 'Reopened.',
        })
        .then((outcome) => {
          if (outcome.ok) bundle.reload();
        }),
    [action, bundle, number, repo, token],
  );

  const dirty =
    labelsDraft !== null || assigneesDraft !== null;

  return (
    <Screen
      header={{
        eyebrow: repo,
        title: `#${number}`,
        subtitle: issue?.title ?? 'reading GitHub…',
        trailing: issue ? (
          <StatusPill label={issue.state} tone={issue.state === 'open' ? 'info' : 'neutral'} />
        ) : undefined,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Issues" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="that issue">
        {() =>
          bundle.loading ? (
            <Panel>
              <Loading label={`reading issue #${number}…`} />
            </Panel>
          ) : !bundle.data || !issue ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not read that issue</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {bundle.error ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={bundle.reload} />
            </Panel>
          ) : (
            <>
              <FadeUp index={1}>
                <Panel style={{ gap: spacing.md }}>
                  <AppText variant="headline">{issue.title}</AppText>
                  <AppText variant="caption" tone="secondary">
                    @{issue.author} opened this {formatAgo(issue.createdAt)}
                    {issue.closedAt ? ` · closed ${formatAgo(issue.closedAt)}` : ''}
                    {issue.milestone ? ` · ${issue.milestone}` : ''}
                  </AppText>
                  {issue.body.trim().length > 0 ? (
                    <AppText variant="subhead" tone="secondary">
                      {issue.body}
                    </AppText>
                  ) : (
                    <AppText variant="subhead" tone="tertiary">
                      No description was written.
                    </AppText>
                  )}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {labels.map((label) => (
                      <StatusPill key={label} label={label} tone="neutral" />
                    ))}
                    {assignees.map((assignee) => (
                      <StatusPill key={assignee} label={`@${assignee}`} tone="accent" />
                    ))}
                  </View>
                  <AppButton
                    label="Open on GitHub"
                    icon={ArrowSquareOut}
                    variant="text"
                    onPress={() => void Linking.openURL(issue.htmlUrl).catch(() => {})}
                  />
                </Panel>
              </FadeUp>

              <FadeUp index={2}>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader
                    eyebrow="labels"
                    title="Triage"
                    trailing={
                      dirty ? (
                        <AppText variant="caption" tone="accent">
                          unsaved
                        </AppText>
                      ) : undefined
                    }
                  />
                  <Panel style={{ gap: spacing.lg }}>
                    {bundle.data.labels.length === 0 ? (
                      <AppText variant="caption" tone="tertiary">
                        This repository has no labels yet.
                      </AppText>
                    ) : (
                      <MultiChipPicker
                        label="labels"
                        options={bundle.data.labels
                          .slice(0, 24)
                          .map((label) => ({ value: label.name, label: label.name }))}
                        selected={labels}
                        onToggle={(value) =>
                          setLabelsDraft(
                            labels.includes(value)
                              ? labels.filter((label) => label !== value)
                              : [...labels, value],
                          )
                        }
                      />
                    )}
                    {bundle.data.assignable.length > 0 ? (
                      <MultiChipPicker
                        label="assignees"
                        options={bundle.data.assignable
                          .slice(0, 12)
                          .map((login) => ({ value: login, label: `@${login}` }))}
                        selected={assignees}
                        onToggle={(value) =>
                          setAssigneesDraft(
                            assignees.includes(value)
                              ? assignees.filter((login) => login !== value)
                              : [...assignees, value],
                          )
                        }
                      />
                    ) : null}
                    <AppButton
                      label={action.busy ? 'Saving…' : 'Save labels and assignees'}
                      variant="tonal"
                      disabled={!dirty || action.busy}
                      onPress={() => void save()}
                    />
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={3}>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader
                    eyebrow={`${bundle.data.comments.length} so far`}
                    title="Conversation"
                  />
                  {bundle.data.comments.length === 0 ? (
                    <Panel coreStyle={{ padding: 0 }}>
                      <EmptyState
                        icon={ChatCircle}
                        title="Nothing said yet"
                        message="Reply below and it lands on GitHub."
                      />
                    </Panel>
                  ) : (
                    bundle.data.comments.map((comment) => (
                      <Panel key={comment.id} style={{ gap: spacing.xs }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: spacing.md,
                          }}>
                          <AppText variant="captionMedium">@{comment.author}</AppText>
                          <AppText variant="caption" tone="tertiary">
                            {formatAgo(comment.createdAt)}
                          </AppText>
                        </View>
                        <AppText variant="subhead" tone="secondary">
                          {comment.body}
                        </AppText>
                      </Panel>
                    ))
                  )}

                  <Panel style={{ gap: spacing.md }}>
                    <TextField
                      label="Reply"
                      value={body}
                      onChangeText={setBody}
                      placeholder="Fixed in the branch — take a look."
                      multiline
                      editable={!action.busy}
                    />
                    <AppButton
                      label="Comment"
                      icon={ChatCircle}
                      disabled={action.busy || body.trim().length === 0}
                      onPress={() => void send()}
                    />
                  </Panel>
                </View>
              </FadeUp>

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

              <FadeUp index={5}>
                <Panel style={{ gap: spacing.md }}>
                  {issue.state === 'open' ? (
                    <>
                      <Eyebrow>Close it</Eyebrow>
                      <AppText variant="caption" tone="secondary">
                        Closing keeps every comment and the history; it can be reopened.
                      </AppText>
                      <AppButton
                        label="Close issue"
                        icon={CheckCircle}
                        variant="outlined"
                        disabled={action.busy}
                        onPress={() => void close('closed')}
                      />
                    </>
                  ) : (
                    <>
                      <Eyebrow>Reopen</Eyebrow>
                      <AppText variant="caption" tone="secondary">
                        Put it back in the open list, exactly as it was.
                      </AppText>
                      <AppButton
                        label="Reopen issue"
                        variant="tonal"
                        disabled={action.busy}
                        onPress={() => void close('open')}
                      />
                    </>
                  )}
                </Panel>
              </FadeUp>

              {bundle.data.labels.length === 0 && bundle.data.assignable.length === 0 ? (
                <FadeUp index={6}>
                  <Notice
                    title="Labels not read"
                    body="This token can read the issue but not the repository's labels, so triage is hidden. A read-only token needs Issues: read."
                  />
                </FadeUp>
              ) : null}
            </>
          )
        }
      </GithubGate>
    </Screen>
  );
}
