/**
 * Blob — one file, read properly.
 *
 * The whole point is that this is *not* a text dump: it is syntax-highlighted
 * (from theme tokens, so it is correct in both schemes), it says who last
 * touched it and when, and it offers the two things you actually want next —
 * copy it, or change it.
 *
 * A binary file, or one too large to hold in an editor, is described rather than
 * opened. That is not a limitation to hide; it is the honest answer, and it
 * comes with a link to the file on GitHub where the real viewer lives.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowSquareOut,
  Clock,
  Copy,
  PencilSimple,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { Fab } from '@/components/ui/fab';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { CodeBlock } from '@/components/ui/code-block';
import { GithubGate } from '@/components/github/gate';
import { formatBytes } from '@/components/github/rows';
import { formatAgo } from '@/lib/format';
import { describeLines } from '@/lib/diff';
import { getRepoDetail, listCommits, readFile } from '@/lib/github/repo';
import { useGithubToken } from '@/lib/github/use-github';
import { shareText } from '@/lib/share';
import { useAsyncData } from '@/lib/use-async-data';
import { spacing, useTheme } from '@/theme';

export default function BlobScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string; path?: string; ref?: string }>();
  const repo = params.repo ?? '';
  const path = params.path ?? '';
  const ref = params.ref;
  const { token, ready } = useGithubToken();

  const file = useAsyncData(
    async () => {
      const [content, detail, history] = await Promise.all([
        readFile(token ?? '', repo, path, ref),
        getRepoDetail(token ?? '', repo).catch(() => null),
        listCommits(token ?? '', repo, { path, ref, limit: 1 }).catch(() => []),
      ]);
      return {
        content,
        writable: Boolean(detail?.canPush) && !detail?.archived,
        lastCommit: history[0] ?? null,
      };
    },
    [token ?? '', repo, path, ref ?? ''],
    { enabled: ready && token !== null && repo.length > 0 && path.length > 0 },
  );

  const data = file.data;
  const editable = Boolean(data?.writable) && Boolean(data?.content) &&
    !data?.content.isBinary && !data?.content.tooBig;

  const openExternal = useCallback((url: string | null) => {
    if (url) void Linking.openURL(url).catch(() => {});
  }, []);

  const copy = useCallback(() => {
    if (data?.content.text) void shareText(data.content.text, data.content.name);
  }, [data]);

  const lines = data?.content.text ? data.content.text.split('\n').length : 0;

  return (
    <Screen
      fab={
        editable ? (
          <Fab
            label="Edit"
            icon={PencilSimple}
            onPress={() =>
              router.push({
                pathname: '/github/edit',
                params: { repo, path, ref: ref ?? '' },
              })
            }
          />
        ) : undefined
      }
      header={{
        eyebrow: `${repo}${ref ? ` · ${ref}` : ''}`,
        title: path.split('/').pop() ?? path,
        subtitle: path,
        trailing: data?.content ? (
          <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
            <StatusPill label={formatBytes(data.content.size)} tone="neutral" />
            {data.content.isBinary ? <StatusPill label="binary" tone="neutral" /> : null}
          </View>
        ) : undefined,
      }}>
      <FadeUp index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <BackRow label="Folder" />
          {data?.content.text ? (
            <PressableScale haptic="selection" onPress={copy}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Copy size={14} color={colors.textSecondary} weight="regular" />
                <AppText variant="caption" tone="secondary">
                  Copy
                </AppText>
              </View>
            </PressableScale>
          ) : null}
          {data?.content.htmlUrl ? (
            <PressableScale
              haptic="selection"
              onPress={() => openExternal(data.content.htmlUrl)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <ArrowSquareOut size={14} color={colors.textSecondary} weight="regular" />
                <AppText variant="caption" tone="secondary">
                  On GitHub
                </AppText>
              </View>
            </PressableScale>
          ) : null}
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="this file">
        {() =>
          file.loading ? (
            <Panel>
              <Loading label={`reading ${path}…`} />
            </Panel>
          ) : !data ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not read that file</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {file.error ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={file.reload} />
            </Panel>
          ) : (
            <>
              <FadeUp index={1}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}>
                  <AppText variant="caption" tone="tertiary">
                    {data.content.tooBig || data.content.isBinary
                      ? formatBytes(data.content.size)
                      : `${describeLines(lines)} · ${formatBytes(data.content.size)}`}
                  </AppText>
                  {data.lastCommit ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Clock size={12} color={colors.textTertiary} weight="regular" />
                      <AppText variant="caption" tone="tertiary">
                        {data.lastCommit.firstLine} · {formatAgo(data.lastCommit.date)}
                      </AppText>
                    </View>
                  ) : null}
                  {!data.writable ? <StatusPill label="read-only here" tone="neutral" /> : null}
                </View>
              </FadeUp>

              <FadeUp index={2}>
                {data.content.isBinary ? (
                  <Panel variant="outlined" style={{ gap: spacing.md }}>
                    <Eyebrow>Binary file</Eyebrow>
                    <AppText variant="subhead" tone="secondary">
                      {formatBytes(data.content.size)} of data that is not text. Nothing here will
                      pretend to edit it — open it on GitHub to view or download it.
                    </AppText>
                    <AppButton
                      label="View on GitHub"
                      icon={ArrowSquareOut}
                      variant="tonal"
                      onPress={() => openExternal(data.content.htmlUrl)}
                    />
                  </Panel>
                ) : data.content.tooBig ? (
                  <Panel variant="outlined" style={{ gap: spacing.md }}>
                    <Eyebrow>Too large to open here</Eyebrow>
                    <AppText variant="subhead" tone="secondary">
                      {formatBytes(data.content.size)} would stall the editor on a tablet, so it is
                      not being loaded. The file is fine — it is just big.
                    </AppText>
                    <AppButton
                      label="View on GitHub"
                      icon={ArrowSquareOut}
                      variant="tonal"
                      onPress={() => openExternal(data.content.htmlUrl)}
                    />
                  </Panel>
                ) : (
                  <CodeBlock code={data.content.text} path={data.content.path} />
                )}
              </FadeUp>
            </>
          )
        }
      </GithubGate>
    </Screen>
  );
}
