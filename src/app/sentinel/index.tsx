/**
 * Sentinel — the board.
 *
 * One question, answered worst-first: *is anything of mine down?* Targets are
 * cards rather than rows because the answer is visual — a shape over time, a
 * verdict, a time it took — and because this is the category's whole point:
 * a living board, not a list.
 *
 * The thing to notice in the markup is what is *absent*: no live dot, no spinner
 * counting seconds since the last check, no "checking…" state that pretends to be
 * continuous. Checks happen when you open this screen or press the button, and
 * every card says exactly when it was measured.
 */
import { useRouter } from 'expo-router';
import { ArrowsClockwise, Crosshair, Plus } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { SiteCard } from '@/components/sentinel/site-card';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Fab } from '@/components/ui/fab';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { CHECKS_KEPT } from '@/lib/db/repo';
import { useBreakpoint } from '@/lib/layout/breakpoints';
import { formatAgo, minutesSince } from '@/lib/sentinel/status';
import { useSentinelBoard } from '@/lib/sentinel/use-sentinel';
import { spacing } from '@/theme';

export default function SentinelBoardScreen() {
  const router = useRouter();
  const board = useSentinelBoard();
  const expanded = useBreakpoint() === 'expanded';
  const count = board.rows.length;

  // The board's clock, so "checked 4m ago" ages on its own and the cards below
  // stay pure functions of their props. Slow on purpose: nothing here is finer
  // than a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const subtitle = board.running
    ? board.progress
      ? `Checking ${Math.min(board.progress.done + 1, board.progress.total)} of ${board.progress.total}…`
      : 'Checking…'
    : count === 0
      ? 'Watch the URLs you own, from this device.'
      : `${count} ${count === 1 ? 'target' : 'targets'} · checked ${formatAgo(minutesSince(board.lastCheckedAt, now))}`;

  // The platform's limit, stated once, only when it actually applies to what is
  // on screen: everything here was measured by the browser.
  const allFromWeb = count > 0 && board.rows.every((row) => !row.latest || row.latest.source === 'web');

  return (
    <Screen
      header={{ eyebrow: 'The outside world', title: 'Sentinel', subtitle }}
      fab={
        <Fab
          label="Add target"
          icon={Plus}
          onPress={() => router.push('/sentinel/site-form')}
        />
      }>
      {/* The rail already says "More" on a wide page. */}
      {expanded ? null : (
        <FadeUp index={0}>
          <BackRow label="More" />
        </FadeUp>
      )}

      {board.status === 'loading' ? (
        <FadeUp index={1}>
          <Loading label="reading the local check log…" />
        </FadeUp>
      ) : board.status === 'error' ? (
        <FadeUp index={1}>
          <Panel>
            <ErrorState what="your watch targets" onRetry={board.refresh} compact />
          </Panel>
        </FadeUp>
      ) : (
        <>
          {count > 0 ? (
            <FadeUp index={1}>
              <View style={{ gap: spacing.sm }}>
                <AppButton
                  label={board.running ? 'Checking…' : 'Check all now'}
                  icon={ArrowsClockwise}
                  variant="outlined"
                  disabled={board.running}
                  onPress={() => void board.runAll()}
                />
                {allFromWeb ? (
                  <AppText variant="caption" tone="tertiary">
                    A browser cannot read another site’s status code, so these checks prove a target
                    answered and how long it took — not that it returned 200. Run them on the tablet for
                    real statuses.
                  </AppText>
                ) : null}
              </View>
            </FadeUp>
          ) : null}

          {count === 0 ? (
            <FadeUp index={2}>
              <EmptyState
                icon={Crosshair}
                title="Nothing is being watched"
                message="Add a URL you own — a site, an API, a health endpoint. Checks run when you open this board, and the history stays on this device."
              />
            </FadeUp>
          ) : (
            board.rows.map((row, index) => (
              <FadeUp key={row.site.id} index={index + 2}>
                <SiteCard
                  row={row}
                  now={now}
                  onPress={() =>
                    router.push({ pathname: '/sentinel/[id]', params: { id: row.site.id } })
                  }
                />
              </FadeUp>
            ))
          )}

          {count > 0 ? (
            <FadeUp index={count + 2}>
              <AppText variant="caption" tone="tertiary">
                Uptime counts the checks taken, not the clock: this app watches only while you are
                looking. The last {CHECKS_KEPT} checks per target are kept.
              </AppText>
            </FadeUp>
          ) : null}
        </>
      )}
    </Screen>
  );
}
