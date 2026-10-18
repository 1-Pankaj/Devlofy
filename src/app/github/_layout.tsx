/**
 * The GitHub section's own stack.
 *
 * Every screen in here is a `Screen` with its own header, and every one of them
 * is a step deeper into a repository (hub → repo → folder → file → editor, or
 * hub → pull request). So the whole folder gets one navigator with the same
 * transition, and the root stack keeps a single entry for it. Routes are found
 * on the filesystem; nothing needs declaring here.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function GithubLayout() {
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
