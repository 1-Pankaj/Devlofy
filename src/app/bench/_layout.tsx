/**
 * The Bench section's own stack.
 *
 * Same shape as the GitHub section next door: every screen is a `Screen` with its
 * own header, and the root stack keeps a single entry for the folder. Routes are
 * found on the filesystem, so nothing needs declaring here.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function BenchLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
