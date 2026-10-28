/**
 * PressableScale — touch feedback on the UI thread.
 *
 * Scale and opacity run on shared values (no re-render): 0.985 and 0.94 in, then
 * back on the out curve. The scale is deliberately shallow — this app presses
 * like a panel, not like a bubble. Light haptic on press, once, never on web.
 */
import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing } from '@/theme';

export type PressableScaleProps = PropsWithChildren<
  Pick<PressableProps, 'onPress' | 'onLongPress' | 'disabled' | 'hitSlop' | 'accessibilityLabel'> & {
    style?: PressableProps['style'];
    contentStyle?: StyleProp<ViewStyle>;
    /** Haptic fired on press-in. */
    haptic?: 'none' | 'light' | 'selection' | 'medium';
  }
>;

function fireHaptic(kind: NonNullable<PressableScaleProps['haptic']>) {
  if (process.env.EXPO_OS === 'web' || kind === 'none') return;
  if (kind === 'selection') {
    Haptics.selectionAsync().catch(() => {});
  } else {
    Haptics.impactAsync(
      kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    ).catch(() => {});
  }
}

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  hitSlop,
  accessibilityLabel,
  style,
  contentStyle,
  haptic = 'light',
}: PressableScaleProps) {
  const press = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.get() * 0.015 }],
    opacity: 1 - press.get() * 0.06,
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        fireHaptic(haptic);
        press.set(withTiming(1, { duration: duration.press, easing: easing.out }));
      }}
      onPressOut={() => {
        press.set(withTiming(0, { duration: duration.fast, easing: easing.out }));
      }}
      style={style}>
      <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
