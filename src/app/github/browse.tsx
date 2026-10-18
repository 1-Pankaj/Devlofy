/**
 * Browse — one directory, anywhere in a repository.
 *
 * Deliberately thin: a breadcrumb you can walk back up, the entries, and a way to
 * add a file where you are. Everything that is *about* the repo (branches,
 * pull requests, checks) stays on the repo screen, so drilling into
 * `src/lib/github` never costs more than one request.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowClockwise, FilePlus, FolderSimple, WarningCircle } from 'phosphor-react-native';
import { useCallback, useMemo } from 'react';
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
import { FadeUp } from '@/components/ui/stagger';
import { GithubGate } from '@/components/github/gate';
import { FileRow } from '@/components/github/rows';
import { getRepoDetail, listDirectory } from '@/lib/github/repo';
import { useGithubToken } from '@/lib/github/use-github';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

export default function BrowseScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string; path?: string; ref?: string }>();
  const repo = params.repo ?? '';
  const path = params.path ?? '';
  const ref = params.ref;
  const { token, ready } = useGithubToken();

  const listing = useAsyncData(
    async () => {
      const [entries, detail] = await Promise.all([
        listDirectory(token ?? '', repo, path, ref),
        getRepoDetail(token ?? '', repo).catch(() => null),
      ]);
      return { entries, writable: Boolean(detail?.canPush) && !detail?.archived };
    },
    [token ?? '', repo, path, ref ?? ''],
    { enabled: ready && token !== null && repo.length > 0 },
  );

  /** Walk up the path one segment at a time: every crumb is a real destination. */
  const crumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    return parts.map((name, index) => ({
      name,
      path: parts.slice(0, index + 1).join('/'),
    }));
  }, [path]);

  const go = useCallback(
    (nextPath: string, kind: 'dir' | 'file') => {
      router.push({
        pathname: kind === 'dir' ? '/github/browse' : '/github/blob',
        params: { repo, path: nextPath, ...(ref ? { ref } : {}) },
      });
    },
    [ref, repo, router],
  );

  const title = path ? (path.split('/').pop() ?? path) : (repo.split('/').pop() ?? repo);
  const data = listing.data;

  return (
    <Screen
      fab={
        data?.writable ? (
          <Fab
            label="New file"
            icon={FilePlus}
            onPress={() =>
              router.push({
                pathname: '/github/edit',
                params: { repo, path: path ? `${path}/` : '', ref: ref ?? '' },
              })
            }
          />
        ) : undefined
      }
      header={{
        eyebrow: `${repo}${ref ? ` · ${ref}` : ''}`,
        title,
        subtitle: path || 'repository root',
        trailing: (
          <PressableScale
            haptic="light"
            accessibilityLabel="Refresh"
            disabled={listing.refreshing}
            style={{ opacity: listing.refreshing ? 0.45 : 1 }}
            onPress={listing.reload}>
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

      <GithubGate ready={ready} token={token} what="this folder">
        {() => (
          <>
            <FadeUp index={1}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}>
                <PressableScale
                  haptic="selection"
                  onPress={() =>
                    router.push({
                      pathname: '/github/repo',
                      params: { repo, ...(ref ? { ref } : {}) },
                    })
                  }>
                  <AppText variant="captionMedium" tone="accent">
                    {repo.split('/').pop() ?? repo}
                  </AppText>
                </PressableScale>
                {crumbs.map((crumb, index) => {
                  // The last crumb is where you already are: it is a label, not a
                  // control. A pressable here would announce itself as a button,
                  // depress under the finger and do nothing.
                  const current = index === crumbs.length - 1;
                  return (
                    <View
                      key={crumb.path}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <AppText variant="caption" tone="tertiary">
                        /
                      </AppText>
                      {current ? (
                        <AppText variant="captionMedium" tone="secondary">
                          {crumb.name}
                        </AppText>
                      ) : (
                        <PressableScale haptic="selection" onPress={() => go(crumb.path, 'dir')}>
                          <AppText variant="captionMedium" tone="accent">
                            {crumb.name}
                          </AppText>
                        </PressableScale>
                      )}
                    </View>
                  );
                })}
              </View>
            </FadeUp>

            <FadeUp index={2}>
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {listing.loading ? (
                  <Loading label={`reading ${path || '/'}…`} />
                ) : !data ? (
                  <View style={{ gap: spacing.md, padding: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <WarningCircle size={15} color={colors.danger} weight="fill" />
                      <Eyebrow tone="danger">Could not read that folder</Eyebrow>
                    </View>
                    <AppText variant="caption" tone="secondary">
                      {listing.error ?? 'GitHub did not answer.'}
                    </AppText>
                    <AppButton label="Try again" variant="text" onPress={listing.reload} />
                  </View>
                ) : data.entries.length === 0 ? (
                  <EmptyState
                    icon={FolderSimple}
                    title="This folder is empty"
                    message="Nothing to show at this path — add a file, or go back up."
                  />
                ) : (
                  data.entries.map((entry, index) => (
                    <FileRow
                      key={entry.path}
                      entry={entry}
                      showSeparator={index < data.entries.length - 1}
                      onPress={() => go(entry.path, entry.type === 'dir' ? 'dir' : 'file')}
                    />
                  ))
                )}
              </Panel>
            </FadeUp>
          </>
        )}
      </GithubGate>
    </Screen>
  );
}
