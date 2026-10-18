/**
 * Entrance choreography. Stagger by index, springy so the page settles rather
 * than slides. Always on the UI thread; always respects reduced motion.
 */
import type { PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

export function FadeUp({
  children,
  index = 0,
  delay = 0,
  style,
}: PropsWithChildren<{ index?: number; delay?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <Animated.View
      entering={FadeInDown.springify()
        .damping(18)
        .mass(0.9)
        .delay(delay + index * 60)
        .reduceMotion(ReduceMotion.System)}
      style={style}>
      {children}
    </Animated.View>
  );
}
