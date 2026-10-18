/**
 * Edit — read a file, change it, and put it back on a branch.
 *
 * This is the screen that makes Devlofy a two-way GitHub client, so it is the
 * screen where the safety rules live, encoded rather than promised (ADR-020):
 *
 *  1. **Never the default branch.** There is no code path here that commits to
 *     `main`; the target is either an existing non-default branch or a new one.
 *     If you need to land something on the default branch, that is what the pull
 *     request is for.
 *  2. **A diff before a commit, always.** The preview updates as you type, and
 *     the summary line ("1 file · +2 −3") is exactly what the button will do.
 *  3. **The button says what it will do** — "Commit and open a pull request", not
 *     "Save". Nothing here is a surprise.
 *  4. **No force, no delete.** A file that changed while you were typing is a
 *     refusal (409) with a way to re-read it, not an overwrite.
 *
 * Two write paths, chosen by what is being asked:
 *  - an **existing file** goes through the Contents API, which demands the blob
 *    `sha` it was read at — that is the guard in rule 4;
 *  - a **new file** goes through the Git Data API (blob → tree → commit → ref),
 *    which needs no `sha` because there is nothing to clobber.
 *
 * The editor is a separate component keyed by the file's identity, so moving to
 * another file starts a fresh editor rather than patching one with new text —
 * the alternative is a class of bug where the caret and the diff disagree.
 *
 * Params: `repo`, `ref`, and `path` — where `path` empty or ending in `/` means
 * "new file here", and anything else means "this file".
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowSquareOut,
  CheckCircle,
  GitBranch,
  GitPullRequest,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { GithubGate } from '@/components/github/gate';
import { ChipPicker, Notice } from '@/components/github/rows';
import { DiffView } from '@/components/ui/diff-view';
import { GithubError } from '@/lib/github/api';
import { describeDiff, diffLines } from '@/lib/diff';
import { createPull, type PullSummary } from '@/lib/github/pulls';
import {
  commitFile,
  commitFiles,
  createBranch,
  getRepoDetail,
  listBranches,
  readFile,
  type Branch,
  type FileContent,
  type RepoDetail,
} from '@/lib/github/repo';
import { useGithubToken } from '@/lib/github/use-github';
import { messageOf } from '@/lib/use-async-data';
import { useAction } from '@/lib/use-action';
import { fonts, radius, spacing, useTheme } from '@/theme';

/** `devlofy/fix-the-copy` — a branch name GitHub will accept, from a sentence. */
function branchNameFor(sentence: string, fallback: string): string {
  const slug = sentence
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `devlofy/${slug || fallback}`;
}

type EditorBundle = {
  detail: RepoDetail;
  branches: Branch[];
  ref: string;
  existing: FileContent | null;
  writable: boolean;
};

type WriteResult = {
  branch: string;
  pull: PullSummary | null;
  commitSha: string;
  commitUrl: string;
};

/** The route: it only reads the params and keys the editor to them. */
export default function EditScreen() {
  const params = useLocalSearchParams<{ repo?: string; path?: string; ref?: string }>();
  const repo = params.repo ?? '';
  const rawPath = params.path ?? '';
  const refParam = params.ref ?? '';
  const { token, ready } = useGithubToken();

  return (
    <EditorBody
      key={`${repo}|${rawPath}|${refParam}|${token ?? ''}`}
      repo={repo}
      rawPath={rawPath}
      refParam={refParam}
      token={ready ? token : null}
      ready={ready}
    />
  );
}

function EditorBody({
  repo,
  rawPath,
  refParam,
  token,
  ready,
}: {
  repo: string;
  rawPath: string;
  refParam: string;
  token: string | null;
  ready: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const isNewFile = rawPath.length === 0 || rawPath.endsWith('/');
  const directoryHint = isNewFile ? rawPath.replace(/\/+$/, '') : '';

  const [bundle, setBundle] = useState<EditorBundle | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [pathDraft, setPathDraft] = useState(directoryHint ? `${directoryHint}/` : '');
  const [draft, setDraft] = useState<string | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'new' | 'current'>('new');
  const [branchDraft, setBranchDraft] = useState('');
  const [openPull, setOpenPull] = useState(true);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [conflict, setConflict] = useState(false);

  const loading = bundle === null && readError === null;

  /** Everything the editor needs, in one read: permissions, branches, the file. */
  const read = useCallback(async (): Promise<EditorBundle> => {
    if (!token) throw new GithubError('auth', 'No token.');
    const [detail, branches] = await Promise.all([
      getRepoDetail(token, repo),
      listBranches(token, repo).catch(() => [] as Branch[]),
    ]);
    const ref = refParam || detail.defaultBranch;
    const existing = isNewFile ? null : await readFile(token, repo, rawPath, ref);
    return { detail, branches, ref, existing, writable: detail.canPush && !detail.archived };
  }, [isNewFile, rawPath, refParam, repo, token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    read().then(
      (next) => {
        if (!alive) return;
        setBundle(next);
        setReadError(null);
        setDraft(next.existing?.text ?? '');
        setSha(next.existing?.sha ?? null);
      },
      (problem: unknown) => {
        if (alive) setReadError(messageOf(problem));
      },
    );
    return () => {
      alive = false;
    };
  }, [read, token, tick]);

  const retry = useCallback(() => {
    setReadError(null);
    setBundle(null);
    setTick((value) => value + 1);
  }, []);

  const data = bundle;
  const ref = data?.ref ?? refParam;
  const isDefaultBranch = Boolean(data) && ref === data?.detail.defaultBranch;
  const cannotEditFile = Boolean(data?.existing?.isBinary) || Boolean(data?.existing?.tooBig);
  const writable = Boolean(data?.writable) && !cannotEditFile;

  const original = isNewFile ? '' : (data?.existing?.text ?? '');
  const currentText = draft ?? original;
  const deferredText = useDeferredValue(currentText);

  const diff = useMemo(
    () => (draft === null ? null : diffLines(original, deferredText)),
    [draft, deferredText, original],
  );

  const resolvedPath = isNewFile ? pathDraft.replace(/^\//, '') : rawPath;
  const suggestedBranch = useMemo(
    () => branchNameFor(message || resolvedPath.split('/').pop() || 'change', 'edit'),
    [message, resolvedPath],
  );
  const targetBranch = target === 'new' ? branchDraft.trim() || suggestedBranch : ref;

  const action = useAction();

  const openExternal = useCallback((url: string | null) => {
    if (url) void Linking.openURL(url).catch(() => {});
  }, []);

  /** Re-read the file's `sha` but keep whatever is in the editor. */
  const reread = useCallback(async () => {
    if (!token || !data || isNewFile) return;
    const fresh = await readFile(token, repo, rawPath, ref);
    setSha(fresh.sha);
    setConflict(false);
  }, [data, isNewFile, rawPath, ref, repo, token]);

  const commit = useCallback(async () => {
    if (!token || !data) return;
    const trimmedMessage = message.trim();

    const run = async () => {
      const branch = targetBranch;

      if (target === 'new') {
        // Branch from the ref we were reading — the diff on screen is against it.
        const base =
          data.branches.find((candidate) => candidate.name === ref) ??
          data.branches.find((candidate) => candidate.name === data.detail.defaultBranch);
        if (!base?.sha) {
          throw new GithubError(
            'not-found',
            `GitHub would not say where ${ref} points, so a branch cannot be cut from it.`,
          );
        }
        await createBranch(token, { repo, name: branch, fromSha: base.sha });
      }

      const written = isNewFile
        ? // A new file: blobs → tree → commit → ref. Nothing to clobber.
          await commitFiles(token, {
            repo,
            branch,
            message: trimmedMessage,
            files: [{ path: resolvedPath, content: currentText }],
          })
        : // An existing file: the Contents API, guarded by the sha we read.
          await commitFile(token, {
            repo,
            path: rawPath,
            content: currentText,
            message: trimmedMessage,
            branch,
            sha: sha ?? undefined,
          });

      let pull: PullSummary | null = null;
      if (target === 'new' && openPull) {
        pull = await createPull(token, {
          repo,
          title: trimmedMessage.split('\n')[0] || `Update ${resolvedPath}`,
          head: branch,
          base: data.detail.defaultBranch,
          body: `Changed \`${resolvedPath}\` from Devlofy.${diff ? `\n\n${describeDiff(diff)}.` : ''}`,
        });
      }

      return { branch, pull, commitSha: written.commitSha, commitUrl: written.htmlUrl };
    };

    const outcome = await action.run(run);
    if (!outcome.ok) {
      if (outcome.error.toLowerCase().includes('changed that branch')) setConflict(true);
      return;
    }

    setResult(outcome.value);
  }, [
    action,
    currentText,
    data,
    diff,
    isNewFile,
    message,
    openPull,
    rawPath,
    ref,
    repo,
    resolvedPath,
    sha,
    target,
    targetBranch,
    token,
  ]);

  const commitLabel =
    target === 'new'
      ? openPull
        ? 'Commit and open a pull request'
        : 'Commit to a new branch'
      : `Commit to ${ref}`;

  const blocked =
    !writable ||
    message.trim().length === 0 ||
    currentText.length === 0 ||
    diff?.unchanged === true ||
    (isNewFile && resolvedPath.length === 0) ||
    (target === 'new' && targetBranch.length === 0);

  return (
    <Screen
      header={{
        eyebrow: `${repo}${ref ? ` · ${ref}` : ''}`,
        title: isNewFile ? 'New file' : (rawPath.split('/').pop() ?? 'Edit'),
        subtitle: isNewFile ? directoryHint || 'repository root' : rawPath,
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label={isNewFile ? 'Folder' : 'File'} />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="the editor">
        {() =>
          result ? (
            <FadeUp index={1}>
              <Panel style={{ gap: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <CheckCircle size={18} color={colors.accent} weight="fill" />
                  <Eyebrow tone="accent">Committed</Eyebrow>
                </View>
                <AppText variant="subhead" tone="secondary">
                  {resolvedPath} is now on {result.branch}.
                  {result.pull
                    ? ` Pull request #${result.pull.number} is open against ${data?.detail.defaultBranch}.`
                    : ''}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {result.pull ? (
                    <AppButton
                      label={`Review #${result.pull.number}`}
                      icon={GitPullRequest}
                      onPress={() =>
                        router.replace({
                          pathname: '/github/pr',
                          params: { repo, number: String(result.pull!.number) },
                        })
                      }
                    />
                  ) : null}
                  <AppButton
                    label="Back to the branch"
                    icon={GitBranch}
                    variant={result.pull ? 'tonal' : 'filled'}
                    onPress={() =>
                      router.replace({
                        pathname: '/github/repo',
                        params: { repo, ref: result.branch },
                      })
                    }
                  />
                  <AppButton
                    label="The commit on GitHub"
                    icon={ArrowSquareOut}
                    variant="text"
                    onPress={() => openExternal(result.commitUrl)}
                  />
                </View>
              </Panel>
            </FadeUp>
          ) : loading ? (
            <Panel>
              <Loading label={isNewFile ? 'reading the repository…' : `reading ${rawPath}…`} />
            </Panel>
          ) : !data ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not open the editor</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {readError ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={retry} />
            </Panel>
          ) : (
            <>
              {!data.writable ? (
                <FadeUp index={1}>
                  <Notice
                    title="Read-only for this token"
                    body="Committing needs Contents: write on a fine-grained token, or the repo scope on a classic one. You can still read the file and copy from it."
                  />
                </FadeUp>
              ) : null}

              {cannotEditFile ? (
                <FadeUp index={1}>
                  <Notice
                    tone="ember"
                    title={data.existing?.isBinary ? 'Binary file' : 'Too large to edit here'}
                    body="The app will not open it, so it cannot commit it either. Change it on GitHub instead."
                  />
                </FadeUp>
              ) : null}

              {isNewFile ? (
                <FadeUp index={2}>
                  <TextField
                    label="File path"
                    value={pathDraft}
                    onChangeText={setPathDraft}
                    placeholder="src/lib/new-file.ts"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={writable}
                  />
                </FadeUp>
              ) : null}

              <FadeUp index={3}>
                <TextField
                  label={isNewFile ? 'Contents' : 'File'}
                  value={currentText}
                  onChangeText={setDraft}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={writable}
                  inputStyle={{
                    fontFamily: fonts.monoRegular,
                    fontSize: 13,
                    lineHeight: 20,
                    minHeight: 280,
                    textAlignVertical: 'top',
                  }}
                />
              </FadeUp>

              <FadeUp index={4}>
                <View style={{ gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                    }}>
                    <Eyebrow>What will change</Eyebrow>
                    <AppText variant="mono" tone="secondary" style={{ fontSize: 12 }}>
                      {diff ? describeDiff(diff) : 'reading…'}
                    </AppText>
                  </View>
                  <DiffView
                    hunks={diff?.hunks ?? []}
                    emptyLabel={
                      diff?.truncated
                        ? 'the change is large — the counts above are exact, the lines are not shown'
                        : 'nothing changed yet'
                    }
                  />
                </View>
              </FadeUp>

              <FadeUp index={5}>
                <View style={{ gap: spacing.lg }}>
                  <SectionHeader eyebrow="commit" title="Where it lands" />

                  <Panel style={{ gap: spacing.lg }}>
                    <TextField
                      label="Commit message"
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Fix the copy on the empty state"
                      autoCapitalize="sentences"
                      editable={writable}
                    />

                    <View style={{ gap: spacing.sm }}>
                      <Eyebrow>Destination</Eyebrow>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <PressableScale
                          haptic="selection"
                          onPress={() => setTarget('new')}
                          disabled={!writable}>
                          <View
                            style={{
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                              borderRadius: radius.full,
                              backgroundColor:
                                target === 'new' ? colors.accentSoft : colors.surfaceElevated,
                            }}>
                            <AppText
                              variant="captionMedium"
                              style={{
                                color: target === 'new' ? colors.accent : colors.textSecondary,
                              }}>
                              a new branch{openPull ? ' + pull request' : ''}
                            </AppText>
                          </View>
                        </PressableScale>

                        {isDefaultBranch ? null : (
                          <PressableScale
                            haptic="selection"
                            onPress={() => setTarget('current')}
                            disabled={!writable}>
                            <View
                              style={{
                                paddingVertical: spacing.sm,
                                paddingHorizontal: spacing.md,
                                borderRadius: radius.full,
                                backgroundColor:
                                  target === 'current' ? colors.accentSoft : colors.surfaceElevated,
                              }}>
                              <AppText
                                variant="captionMedium"
                                style={{
                                  color:
                                    target === 'current' ? colors.accent : colors.textSecondary,
                                }}>
                                {ref} directly
                              </AppText>
                            </View>
                          </PressableScale>
                        )}
                      </View>
                    </View>

                    {target === 'new' ? (
                      <>
                        <TextField
                          label="Branch name"
                          value={branchDraft}
                          onChangeText={setBranchDraft}
                          placeholder={suggestedBranch}
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={writable}
                        />
                        <ChipPicker
                          label="and then"
                          options={[
                            { value: 'pr', label: 'open a pull request' },
                            { value: 'branch', label: 'just the branch' },
                          ]}
                          value={openPull ? 'pr' : 'branch'}
                          onChange={(value) => setOpenPull(value === 'pr')}
                        />
                      </>
                    ) : null}

                    {isDefaultBranch ? (
                      <Notice
                        tone="accent"
                        title={`${ref} is the default branch`}
                        body="Devlofy never commits straight to a default branch. Commit to a new branch and open a pull request — that is what the pull request is for."
                      />
                    ) : null}

                    {conflict ? (
                      <Notice
                        tone="ember"
                        title="The file changed while you were editing"
                        body="GitHub refused the commit so nobody's edit is lost. Re-read the file to pick up its new version, then commit again."
                        actionLabel="Re-read the file, keeping my text"
                        onAction={() => void action.run(reread)}
                      />
                    ) : null}

                    {action.error ? (
                      <AppText variant="caption" tone="danger">
                        {action.error}
                      </AppText>
                    ) : null}

                    <AppButton
                      label={action.busy ? 'Committing…' : commitLabel}
                      icon={target === 'new' && openPull ? GitPullRequest : GitBranch}
                      full
                      disabled={blocked || action.busy}
                      onPress={() => void commit()}
                    />

                    <AppText variant="caption" tone="tertiary">
                      {target === 'new'
                        ? `Creates ${targetBranch} from ${ref}${openPull ? `, then opens a pull request against ${data.detail.defaultBranch}` : ''}.`
                        : `Adds a commit to ${ref}. No force-push, ever.`}
                    </AppText>

                    {diff?.unchanged ? (
                      <AppText variant="caption" tone="tertiary">
                        Nothing to commit yet — change something first.
                      </AppText>
                    ) : null}
                  </Panel>

                  {data.existing && !cannotEditFile ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <StatusPill label={`read at ${data.existing.sha.slice(0, 7)}`} tone="neutral" />
                      <AppText variant="caption" tone="tertiary">
                        GitHub will refuse the commit if that changed underneath you.
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </FadeUp>
            </>
          )
        }
      </GithubGate>
    </Screen>
  );
}
