/**
 * AnimatedNumber — counts to a new value instead of snapping.
 *
 * One shared value runs the count on the UI thread; `scheduleOnRN` hands each
 * frame to the text node, so the digits settle exactly on the value. Reanimated
 * handles reduced motion by jumping the timing — the value still lands.
 */
import { useCallback, useEffect, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import { ReduceMotion, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { duration, easing, useTheme, type TypeVariant } from '@/theme';
import { AppText } from './app-text';

export type AnimatedNumberProps = {
  value: number;
  /** Defaults to the plain integer. */
  format?: (value: number) => string;
  variant?: TypeVariant;
  /** Overrides the default text colour (e.g. on a gradient surface). */
  color?: string;
  /**
   * Decimal places to land on. Counts want none (the default); money wants 2,
   * or the figure would settle a rupee off the truth.
   */
  precision?: number;
  style?: StyleProp<TextStyle>;
};

export function AnimatedNumber({
  value,
  format = (n) => String(n),
  variant = 'numberLg',
  color,
  precision = 0,
  style,
}: AnimatedNumberProps) {
  const { colors } = useTheme();
  const count = useSharedValue(value);
  const [display, setDisplay] = useState(value);

  const commit = useCallback((next: number) => setDisplay(next), []);

  useEffect(() => {
    count.set(
      withTiming(value, {
        duration: duration.slow,
        easing: easing.out,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [count, value]);

  useDerivedValue(() => {
    const scale = 10 ** precision;
    scheduleOnRN(commit, Math.round(count.get() * scale) / scale);
  });

  return (
    <AppText variant={variant} style={[{ color: color ?? colors.text }, style]}>
      {format(display)}
    </AppText>
  );
}
