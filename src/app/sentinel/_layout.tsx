/**
 * The Sentinel section's own stack.
 *
 * Same shape as Bench and GitHub next door — every screen owns its header, and
 * the root stack keeps one entry for the folder — with one difference: the form
 * is presented as a modal from the bottom, because registering a target is a
 * short errand you came from a board to do, exactly like the client and project
 * forms at the root.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function SentinelLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen
        name="site-form"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
