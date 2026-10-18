/**
 * The inbox — what GitHub pushed at you while you were away.
 *
 * This is the one list in the app that is *not* a query you designed: it is
 * GitHub's own notion of "you should look at this". The reason on each row is
 * translated from its API slug (`review_requested` → "review wanted") because a
 * slug in a UI is a bug.
 *
 * Reading the inbox is a classic-token feature — fine-grained tokens are not
 * allowed near `/notifications` at all. When that is why it failed, the screen
 * says so in GitHub's own words rather than implying the inbox is empty.
 *
 * Opening a row marks it read and takes you to the thing itself, in the app.
 */
import { useRouter } from 'expo-router';
import { ArrowClockwise, Bell, Checks, WarningCircle } from 'phosphor-react-native';
import { useCallback } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { GithubGate } from '@/components/github/gate';
import { formatAgo } from '@/lib/format';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationReasonLabel,
  type Notification,
} from '@/lib/github/issues';
import { useGithubToken } from '@/lib/github/use-github';
import { useAction } from '@/lib/use-action';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { token, ready } = useGithubToken();
  const action = useAction();

  const inbox = useAsyncData(() => listNotifications(token ?? ''), [token ?? ''], {
    enabled: ready && token !== null,
  });

  const open = useCallback(
    (entry: Notification) => {
      // Opening it is reading it; the local list is updated at once and the
      // PATCH is fire-and-forget, because a failed "mark read" is not a reason
      // to stop someone reading their notifications.
      inbox.setData((inbox.data ?? []).map((row) => (row.id === entry.id ? { ...row, unread: false } : row)));
      if (token) void markNotificationRead(token, entry.id).catch(() => {});

      if (entry.number !== null && entry.repo) {
        if (entry.type === 'PullRequest') {
          router.push({
            pathname: '/github/pr',
            params: { repo: entry.repo, number: String(entry.number) },
          });
          return;
        }
        router.push({
          pathname: '/github/issue',
          params: { repo: entry.repo, number: String(entry.number) },
        });
        return;
      }
      void Linking.openURL(entry.htmlUrl).catch(() => {});
    },
    [inbox, router, token],
  );

  const markAll = useCallback(async () => {
    if (!token) return;
    const outcome = await action.run(() => markAllNotificationsRead(token), {
      success: 'Everything is marked read.',
    });
    if (outcome.ok) inbox.setData([]);
  }, [action, inbox, token]);

  const unread = (inbox.data ?? []).filter((entry) => entry.unread).length;

  return (
    <Screen
      header={{
        eyebrow: 'github',
        title: 'Inbox',
        subtitle: inbox.data
          ? unread === 0
            ? 'nothing unread'
            : `${unread} unread`
          : 'reading GitHub…',
        trailing: (
          <PressableScale
            haptic="light"
            accessibilityLabel="Refresh"
            disabled={inbox.refreshing}
            style={{ opacity: inbox.refreshing ? 0.45 : 1 }}
            onPress={inbox.reload}>
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

      <GithubGate ready={ready} token={token} what="your inbox">
        {() => (
          <>
            <FadeUp index={1}>
              <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                {inbox.loading ? (
                  <Loading label="reading notifications…" />
                ) : inbox.error && !inbox.data ? (
                  <View style={{ gap: spacing.md, padding: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <WarningCircle size={15} color={colors.danger} weight="fill" />
                      <Eyebrow tone="danger">Could not read the inbox</Eyebrow>
                    </View>
                    <AppText variant="caption" tone="secondary">
                      {inbox.error}
                    </AppText>
                    <AppText variant="caption" tone="tertiary">
                      The notifications API is not available to fine-grained tokens. A classic token
                      with the repo scope reaches it; the rest of this app does not need one.
                    </AppText>
                    <AppButton label="Try again" variant="text" onPress={inbox.reload} />
                  </View>
                ) : (inbox.data ?? []).length === 0 ? (
                  <EmptyState
                    icon={Bell}
                    title="Inbox zero"
                    message="Nothing unread. Mentions, review requests and replies will land here."
                  />
                ) : (
                  (inbox.data ?? []).map((entry, index) => (
                    <ListRow
                      key={entry.id}
                      icon={<Bell size={17} color={colors.accent} weight="regular" />}
                      tone="accent"
                      title={entry.title}
                      subtitle={[
                        entry.repo.split('/').pop(),
                        entry.number !== null ? `#${entry.number}` : null,
                        notificationReasonLabel(entry.reason),
                        formatAgo(entry.updatedAt),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      showSeparator={index < (inbox.data ?? []).length - 1}
                      trailing={entry.unread ? <StatusPill label="unread" tone="accent" /> : undefined}
                      onPress={() => open(entry)}
                    />
                  ))
                )}
              </Panel>
            </FadeUp>

            {action.error ? (
              <FadeUp index={2}>
                <AppText variant="caption" tone="danger">
                  {action.error}
                </AppText>
              </FadeUp>
            ) : null}

            {action.message ? (
              <FadeUp index={2}>
                <AppText variant="caption" tone="accent">
                  {action.message}
                </AppText>
              </FadeUp>
            ) : null}

            {(inbox.data ?? []).length > 0 ? (
              <FadeUp index={3}>
                <AppButton
                  label={action.busy ? 'Marking…' : 'Mark everything read'}
                  icon={Checks}
                  variant="tonal"
                  disabled={action.busy}
                  onPress={() => void markAll()}
                />
              </FadeUp>
            ) : null}
          </>
        )}
      </GithubGate>
    </Screen>
  );
}
