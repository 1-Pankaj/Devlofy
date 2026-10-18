/**
 * BottomTabBar — compact-width navigation.
 *
 * A solid, edge-anchored bar with a springy accent indicator that slides
 * between destinations (one shared value, UI thread, no re-render). The bar
 * sits in the layout, so nothing is ever hidden behind it.
 *
 * Props are declared structurally instead of importing the navigator's types —
 * `@react-navigation/bottom-tabs` is nested under expo-router, not hoisted.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { duration, easing, radius, spacing, useTheme } from '@/theme';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { navItemForRoute } from './nav-items';

const ITEM_HEIGHT = 46;

export type BottomTabBarProps = {
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

export function BottomTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const items = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => navItemForRoute(route.name));

  const [trackWidth, setTrackWidth] = useState(0);
  const pad = spacing.xs;
  const itemWidth = trackWidth > 0 ? (trackWidth - pad * 2) / items.length : 0;
  const focusedPosition = Math.max(
    0,
    items.findIndex((item) => item.index === state.index),
  );

  const shift = useSharedValue(0);

  useEffect(() => {
    shift.set(
      withTiming(focusedPosition * itemWidth, {
        duration: duration.base,
        easing: easing.emphasized,
      }),
    );
  }, [focusedPosition, itemWidth, shift]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.get() }],
  }));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: spacing.sm,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingHorizontal: spacing.sm,
      }}>
      <View
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={{ flexDirection: 'row', padding: pad, position: 'relative' }}>
        {itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: pad,
                left: pad,
                width: itemWidth,
                height: ITEM_HEIGHT,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: colors.accentSoft,
              },
              indicatorStyle,
            ]}
          />
        ) : null}

        {items.map(({ route }) => {
          const item = navItemForRoute(route.name);
          if (!item) return null;
          const focused = state.routes[state.index]?.key === route.key;
          const Icon = item.icon;
          const color = focused ? colors.accent : colors.textTertiary;

          return (
            <PressableScale
              key={route.key}
              haptic="selection"
              accessibilityLabel={item.label}
              style={{ flex: 1 }}
              contentStyle={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}
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
              <Icon size={23} color={color} weight={focused ? 'fill' : 'regular'} />
              <AppText variant="captionMedium" style={{ fontSize: 11, lineHeight: 14, color }}>
                {item.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
