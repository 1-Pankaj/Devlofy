/**
 * Entrance choreography. Stagger by index; always on the UI thread; always
 * respects the system reduced-motion setting.
 */
import type { PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { duration } from '@/theme';

export function FadeUp({
  children,
  index = 0,
  delay = 0,
  style,
}: PropsWithChildren<{ index?: number; delay?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <Animated.View
      entering={FadeInDown.duration(duration.slow)
        .delay(delay + index * 70)
        .reduceMotion(ReduceMotion.System)}
      style={style}>
      {children}
    </Animated.View>
  );
}
