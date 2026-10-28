/**
 * Tab layout — adaptive.
 *
 * Compact: JS tab navigator with the solid bottom bar (consistent across
 * Android and web, and fully brandable). Expanded + desktop mode: the same
 * navigator with no bar at all — the side rail at the app root is the
 * navigation there, so a second control would only repeat it.
 */
import { Tabs } from 'expo-router';

import { BottomTabBar } from '@/components/nav/bottom-tab-bar';
import { useDesktopMode } from '@/lib/layout/breakpoints';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const desktopMode = useDesktopMode();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: colors.background },
      }}
      tabBar={(props) => (desktopMode ? null : <BottomTabBar {...props} />)}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="garden" options={{ title: 'Garden' }} />
      <Tabs.Screen name="work" options={{ title: 'Work' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
