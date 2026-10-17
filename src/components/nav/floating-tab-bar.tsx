/**
 * FloatingTabBar — compact-width navigation. A floating pill that clears the
 * content, solid (no scroll-blur), with selection haptics and accent states.
 *
 * Props are declared structurally instead of importing the navigator's types —
 * `@react-navigation/bottom-tabs` is nested under expo-router, not hoisted.
 */
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeShadows, radius, spacing, useTheme } from '@/theme';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { navItemForRoute } from './nav-items';

export type FloatingTabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  emitter: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
  navigateToTab: (routeKey: string) => void;
};

export function FloatingTabBar({ state, emitter, navigateToTab }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const shadows = makeShadows(colors);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View
        style={{
          marginHorizontal: spacing.xl,
          marginBottom: Math.max(insets.bottom, spacing.md),
          flexDirection: 'row',
          borderRadius: radius.full,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.hairline,
          boxShadow: shadows.raised,
          paddingHorizontal: spacing.sm,
          paddingVertical: 10,
        }}>
        {state.routes.map((route, index) => {
          const item = navItemForRoute(route.name);
          if (!item) return null;
          const focused = state.index === index;
          const Icon = item.icon;
          const color = focused ? colors.accent : colors.textTertiary;

          return (
            <PressableScale
              key={route.key}
              haptic="selection"
              accessibilityLabel={item.label}
              style={{ flex: 1 }}
              contentStyle={{ alignItems: 'center', gap: 3 }}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigateToTab(route.key);
                }
              }}>
              <Icon size={22} color={color} weight={focused ? 'fill' : 'regular'} />
              <AppText variant="caption" style={{ fontSize: 11, color }}>
                {item.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
