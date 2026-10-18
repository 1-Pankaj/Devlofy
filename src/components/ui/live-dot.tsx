/**
 * LiveDot — a calm "recording" pulse for running sessions. One shared value,
 * UI thread only, a slow breath rather than a blink, and it rests as a steady
 * dot under reduced motion.
 */
import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      pulse.set(1);
      return;
    }
    pulse.set(
      withRepeat(withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.get() * 0.55,
    transform: [{ scale: 0.92 + pulse.get() * 0.08 }],
  }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}
