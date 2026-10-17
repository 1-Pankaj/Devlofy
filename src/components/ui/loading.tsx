/**
 * Loading — the shared "reading local data" state. A quiet spinner over a
 * mono caption; screens show this instead of flashing an empty state.
 */
import { ActivityIndicator, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { AppText } from './app-text';

export function Loading({ label = 'reading the local database…' }: { label?: string }) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl }}>
      <ActivityIndicator color={colors.accent} />
      <AppText variant="mono" tone="tertiary">
        {label}
      </AppText>
    </View>
  );
}
