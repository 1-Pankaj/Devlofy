/**
 * A read that failed — `EmptyState`'s sibling, and the reason a failed query
 * never has to look like an empty one.
 *
 * It exists because the alternative is a lie with a friendly face: screens that
 * branch only on `loading` and `empty` show "Nothing here yet" (or worse,
 * "This project no longer exists") when the read actually threw, and the user's
 * own data looks deleted. `useLiveQuery` keeps the last good value and only
 * reaches `error` with nothing to show, so this state means what it says — and
 * the retry is explicit, because a screen that failed will not try again on its
 * own.
 */
import { View } from 'react-native';

import { spacing } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export function ErrorState({
  what,
  onRetry,
  compact = false,
}: {
  /** What could not be read. The sentence is built from it so the copy keeps the
   *  same shape everywhere: `Could not read projects.` */
  what: string;
  /** Retry handler — pass the live query's `refresh`. */
  onRetry?: () => void;
  /** Tighter padding, for a failure inside a panel that is already inset. */
  compact?: boolean;
}) {
  return (
    <View style={{ padding: compact ? spacing.lg : spacing.xl, gap: spacing.sm }}>
      <AppText variant="subheadMedium" tone="danger">
        Could not read {what}.
      </AppText>
      {onRetry ? (
        <PressableScale haptic="selection" onPress={onRetry}>
          <AppText variant="captionMedium" tone="accent">
            Retry
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}
