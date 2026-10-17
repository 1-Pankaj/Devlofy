/**
 * LiveDot — a calm "recording" pulse for running sessions. One shared value,
 * UI thread only, and it rests as a steady dot under reduced motion.
 */
import { useEffect } from 'react';
import Animated, {
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
    pulse.set(withRepeat(withTiming(0, { duration: 900 }), -1, true));
  }, [pulse, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.get() * 0.6,
    transform: [{ scale: 0.82 + pulse.get() * 0.18 }],
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
