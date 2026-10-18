/**
 * Entrance choreography. Stagger by index, timed rather than sprung so the page
 * *arrives* — a short rise and a fade, never a bounce. Always on the UI thread;
 * always respects reduced motion.
 *
 * The rise is written as an animated style rather than through reanimated's
 * `entering` prop, deliberately. On web, `entering` with a modifier
 * (`withInitialValues` here) leaves the predefined animation table and goes
 * through reanimated's keyframe path, which clones the element and pins the
 * clone with an inline `width`/`height` and `position: absolute`. The clone is
 * removed but the inline box is not, so a block whose content *grows after it
 * arrives* — a diff that fills in while you type, a list that gains a row —
 * keeps the height it had on the first frame, and the section below lays out on
 * top of it. Driving `opacity` and `translateY` ourselves cannot do that:
 * nothing is ever written outside this component's own style.
 */
import { useEffect, type PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing } from '@/theme';

/** How far a block rises into place, in points. */
const RISE = 8;

/** Gap between two staggered blocks, in milliseconds. */
const STEP = 45;

export function FadeUp({
  children,
  index = 0,
  delay = 0,
  style,
}: PropsWithChildren<{ index?: number; delay?: number; style?: StyleProp<ViewStyle> }>) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const start = delay + index * STEP;

  useEffect(() => {
    // Reduced motion means *arrived*, not *delayed*: the block is placed rather
    // than animated, with no stagger to sit through.
    if (reducedMotion) {
      progress.set(1);
      return;
    }
    progress.set(
      withDelay(start, withTiming(1, { duration: duration.page, easing: easing.out })),
    );
  }, [progress, reducedMotion, start]);

  const entering = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * RISE }],
  }));

  return <Animated.View style={[style, entering]}>{children}</Animated.View>;
}
