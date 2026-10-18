/**
 * Releases — the last mile of shipping, which used to be the one thing a tablet
 * could not do.
 *
 * The screen is two halves that answer two questions: *what have I shipped?* and
 * *what am I about to ship?* The second half is a form, and it refuses to pretend
 * the two kinds of notes are the same thing:
 *
 *  - **Written notes** are what you type.
 *  - **Generated notes** are GitHub's own summary of the merged pull requests
 *    between the last release and this tag.
 *
 * GitHub uses one or the other, so the form disables the text box when you ask
 * for generated notes rather than silently discarding what you typed.
 *
 * A release is published unless you say draft. The button says which, out loud,
 * because publishing a version is the least reversible thing in this app.
 */
import { useLocalSearchParams } from 'expo-router';
import { ArrowSquareOut, Package, Tag, WarningCircle } from 'phosphor-react-native';
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
import { ChipPicker, Notice } from '@/components/github/rows';
import { formatAgo } from '@/lib/format';
import {
  createRelease,
  getRepoDetail,
  listBranches,
  listReleases,
  type Branch,
  type Release,
} from '@/lib/github/repo';
import { useGithubToken } from '@/lib/github/use-github';
import { useAction } from '@/lib/use-action';
import { useAsyncData } from '@/lib/use-async-data';
import { spacing, useTheme } from '@/theme';

type ReleaseBundle = {
  releases: Release[];
  branches: Branch[];
  defaultBranch: string;
  writable: boolean;
};

async function loadReleases(token: string, repo: string): Promise<ReleaseBundle> {
  const [detail, branches, releases] = await Promise.all([
    getRepoDetail(token, repo),
    listBranches(token, repo).catch(() => [] as Branch[]),
    listReleases(token, repo).catch(() => [] as Release[]),
  ]);
  return {
    releases,
    branches,
    defaultBranch: detail.defaultBranch,
    writable: detail.canPush && !detail.archived,
  };
}

export default function ReleaseScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ repo?: string }>();
  const repo = params.repo ?? '';
  const { token, ready } = useGithubToken();

  const bundle = useAsyncData(() => loadReleases(token ?? '', repo), [token ?? '', repo], {
    enabled: ready && token !== null && repo.length > 0,
  });

  const [tag, setTag] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);
  const [generate, setGenerate] = useState(true);
  const action = useAction();

  const data = bundle.data;
  const branch = target ?? data?.defaultBranch ?? 'main';

  /** GitHub will not accept a tag that is not shaped like one. */
  const tagIsValid = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(tag.trim() ) && !tag.trim().endsWith('/');

  const latest = data?.releases[0] ?? null;
  const nextTag = useMemo(() => {
    if (!latest) return 'v0.1.0';
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(latest.tagName);
    if (!match) return '';
    return `v${match[1]}.${Number(match[2]) + 1}.0`;
  }, [latest]);

  const openExternal = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => {});
  }, []);

  const publish = useCallback(async () => {
    if (!token || !data) return;
    const outcome = await action.run(
      () =>
        createRelease(token, {
          repo,
          tagName: tag.trim(),
          name: title.trim() || tag.trim(),
          body: generate ? undefined : notes,
          targetCommitish: branch,
          draft,
          prerelease,
          generateNotes: generate,
        }),
      { success: draft ? 'Saved as a draft — nothing is public yet.' : 'Released.' },
    );
    if (outcome.ok) {
      setTag('');
      setTitle('');
      setNotes('');
      bundle.reload();
    }
  }, [action, branch, bundle, data, draft, generate, notes, prerelease, repo, tag, title, token]);

  return (
    <Screen
      header={{
        eyebrow: repo,
        title: 'Releases',
        subtitle: latest ? `latest is ${latest.tagName}` : 'nothing shipped yet',
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Repository" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="releases">
        {() =>
          bundle.loading ? (
            <Panel>
              <Loading label="reading releases…" />
            </Panel>
          ) : !data ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not read releases</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {bundle.error ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={bundle.reload} />
            </Panel>
          ) : (
            <>
              <FadeUp index={1}>
                <View>
                  <SectionHeader
                    eyebrow={`${data.releases.length} on record`}
                    title="Shipped"
                  />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.releases.length === 0 ? (
                      <EmptyState
                        icon={Package}
                        title="No releases"
                        message="Tags without a release do not show up here. Publish the first one below."
                      />
                    ) : (
                      data.releases.map((release, index) => (
                        <View
                          key={release.id}
                          style={{
                            padding: spacing.lg,
                            gap: spacing.sm,
                            borderBottomWidth: index < data.releases.length - 1 ? 1 : 0,
                            borderBottomColor: colors.hairline,
                          }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: spacing.md,
                            }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                              <Tag size={15} color={colors.accent} weight="regular" />
                              <AppText variant="captionMedium" tone="accent">
                                {release.tagName}
                              </AppText>
                            </View>
                            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                              {release.draft ? <StatusPill label="draft" tone="neutral" /> : null}
                              {release.prerelease ? <StatusPill label="pre" tone="info" /> : null}
                            </View>
                          </View>
                          <AppText variant="subhead">{release.name}</AppText>
                          <AppText variant="caption" tone="tertiary">
                            {release.createdAt ? formatAgo(release.createdAt) : 'no date'}
                          </AppText>
                          {release.body.trim().length > 0 ? (
                            <AppText variant="caption" tone="secondary" numberOfLines={6}>
                              {release.body}
                            </AppText>
                          ) : null}
                          <AppButton
                            label="Open on GitHub"
                            icon={ArrowSquareOut}
                            variant="text"
                            onPress={() => openExternal(release.htmlUrl)}
                          />
                        </View>
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={2}>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader eyebrow="publish" title="Cut a release" />
                  {!data.writable ? (
                    <Notice
                      title="Read-only for this token"
                      body="Publishing needs Contents: write on a fine-grained token, or the repo scope on a classic one. The list above is still readable."
                    />
                  ) : null}
                  <Panel style={{ gap: spacing.lg }}>
                    <TextField
                      label="Tag"
                      value={tag}
                      onChangeText={setTag}
                      placeholder={nextTag || 'v1.0.0'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={data.writable}
                    />
                    <TextField
                      label="Title"
                      value={title}
                      onChangeText={setTitle}
                      placeholder={tag.trim() || 'Version 1.0 — the one you can show people'}
                      editable={data.writable}
                    />
                    {data.branches.length > 0 ? (
                      <ChipPicker
                        label="from"
                        options={data.branches
                          .slice(0, 20)
                          .map((candidate) => ({
                            value: candidate.name,
                            label: candidate.isDefault
                              ? `${candidate.name} · default`
                              : candidate.name,
                          }))}
                        value={branch}
                        onChange={setTarget}
                      />
                    ) : (
                      <TextField
                        label="Branch or commit"
                        value={branch}
                        onChangeText={setTarget}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    )}

                    <ChipPicker
                      label="notes"
                      options={[
                        { value: 'generate', label: 'write them for me' },
                        { value: 'manual', label: "I'll write them" },
                      ]}
                      value={generate ? 'generate' : 'manual'}
                      onChange={(value) => setGenerate(value === 'generate')}
                    />

                    <TextField
                      label="Release notes"
                      value={generate ? '' : notes}
                      onChangeText={setNotes}
                      placeholder={
                        generate
                          ? 'GitHub writes these from the merged pull requests'
                          : 'What changed, and what to watch out for.'
                      }
                      multiline
                      editable={data.writable && !generate}
                    />
                    {generate ? (
                      <AppText variant="caption" tone="tertiary">
                        GitHub lists the merged pull requests and their authors between the last
                        release and this tag. Nothing you type is used, which is why the box is
                        closed.
                      </AppText>
                    ) : null}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
                      <ChipPicker
                        label="state"
                        options={[
                          { value: 'published', label: 'publish it' },
                          { value: 'draft', label: 'keep as a draft' },
                        ]}
                        value={draft ? 'draft' : 'published'}
                        onChange={(value) => setDraft(value === 'draft')}
                      />
                      <ChipPicker
                        label="kind"
                        options={[
                          { value: 'stable', label: 'stable' },
                          { value: 'pre', label: 'pre-release' },
                        ]}
                        value={prerelease ? 'pre' : 'stable'}
                        onChange={(value) => setPrerelease(value === 'pre')}
                      />
                    </View>

                    {tag.trim().length > 0 && !tagIsValid ? (
                      <AppText variant="caption" tone="danger">
                        That is not a tag GitHub will accept — no spaces, and it cannot end in a
                        slash.
                      </AppText>
                    ) : null}

                    {action.error ? (
                      <AppText variant="caption" tone="danger">
                        {action.error}
                      </AppText>
                    ) : null}
                    {action.message ? (
                      <AppText variant="caption" tone="accent">
                        {action.message}
                      </AppText>
                    ) : null}

                    <AppButton
                      label={
                        action.busy
                          ? 'Working…'
                          : draft
                            ? 'Save as a draft'
                            : `Publish ${tag.trim() || 'the release'}`
                      }
                      icon={Package}
                      full
                      disabled={!data.writable || !tagIsValid || action.busy}
                      onPress={() => void publish()}
                    />
                    <AppText variant="caption" tone="tertiary">
                      {draft
                        ? 'A draft is invisible to everyone but you, and can be edited or deleted.'
                        : `This creates the tag ${tag.trim() || '…'} on ${branch} and makes it public. Releases can be edited, but the tag stays.`}
                    </AppText>
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
