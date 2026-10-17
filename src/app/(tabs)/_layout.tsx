/**
 * Tab layout — adaptive.
 *
 * Compact: JS tab navigator with the floating pill bar (consistent across
 * Android and web, and fully brandable). Expanded + desktop mode: the side
 * rail shell, no tab bar.
 */
import { Tabs } from 'expo-router';

import { DesktopShell } from '@/components/nav/desktop-shell';
import { FloatingTabBar } from '@/components/nav/floating-tab-bar';
import { useDesktopMode } from '@/lib/layout/breakpoints';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const desktopMode = useDesktopMode();
  const { colors } = useTheme();

  if (desktopMode) {
    return <DesktopShell />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'none',
        sceneStyle: { backgroundColor: colors.background },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="garden" options={{ title: 'Garden' }} />
      <Tabs.Screen name="work" options={{ title: 'Work' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
