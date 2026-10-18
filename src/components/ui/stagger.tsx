/**
 * Entrance choreography. Stagger by index, timed rather than sprung so the page
 * *arrives* — a short rise and a fade, never a bounce. Always on the UI thread;
 * always respects reduced motion.
 */
import type { PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { duration, easing } from '@/theme';

export function FadeUp({
  children,
  index = 0,
  delay = 0,
  style,
}: PropsWithChildren<{ index?: number; delay?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <Animated.View
      entering={FadeInDown.duration(duration.page)
        .easing(easing.out)
        .withInitialValues({ transform: [{ translateY: 8 }] })
        .delay(delay + index * 45)
        .reduceMotion(ReduceMotion.System)}
      style={style}>
      {children}
    </Animated.View>
  );
}
