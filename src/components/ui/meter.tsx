/**
 * Meter — the app's determinate bar.
 *
 * Width is animated in pixels from the track's measured width, so it lands
 * exactly and survives rotation. The trough is `surfaceSunken`; the fill is the
 * caller's meaning (brand for progress, ember for a running block, danger for a
 * breach).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, radius, useTheme } from '@/theme';

export type MeterTone = 'accent' | 'ember' | 'info' | 'danger';

export function Meter({
  value,
  tone = 'accent',
  height = 5,
  trackColor,
}: {
  /** 0..1 */
  value: number;
  tone?: MeterTone;
  height?: number;
  trackColor?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const clamped = Math.min(1, Math.max(0, value));

  useEffect(() => {
    progress.set(
      withTiming(clamped, {
        duration: duration.slow,
        easing: easing.out,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [clamped, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, progress.get() * width),
  }));

  const fill = {
    accent: colors.accent,
    ember: colors.ember,
    info: colors.info,
    danger: colors.danger,
  }[tone];

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        height,
        borderRadius: radius.full,
        backgroundColor: trackColor ?? colors.surfaceSunken,
        overflow: 'hidden',
      }}>
      <Animated.View
        style={[
          { height: '100%', borderRadius: radius.full, backgroundColor: fill },
          fillStyle,
        ]}
      />
    </View>
  );
}
