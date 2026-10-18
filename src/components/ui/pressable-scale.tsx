/**
 * PressableScale — touch feedback on the UI thread.
 *
 * Scale runs on a shared value (no re-render), with the token press duration
 * going in and a snappy spring coming back. Light haptic on press, once.
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
  const scaleValue = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.get() }],
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
        scaleValue.set(withTiming(0.975, { duration: duration.press, easing: easing.out }));
      }}
      onPressOut={() => {
        scaleValue.set(withTiming(1, { duration: duration.fast, easing: easing.out }));
      }}
      style={style}>
      <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
