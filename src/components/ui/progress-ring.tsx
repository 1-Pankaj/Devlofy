/**
 * ProgressRing — a determinate circular indicator.
 *
 * Solid, not a gradient: one accent arc with a rounded cap over a quiet trough.
 * The stroke animates on the UI thread and snaps under reduced motion.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { duration, easing, useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Track colour. Defaults to the step above the surface; override on a tonal block. */
  trackColor?: string;
  children?: ReactNode;
};

export function ProgressRing({
  progress,
  size = 72,
  stroke = 6,
  color,
  trackColor,
  children,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const strokeColor = color ?? colors.accent;
  const center = size / 2;
  const radiusValue = center - stroke / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const clamped = Math.min(1, Math.max(0, progress));

  const value = useSharedValue(clamped);

  useEffect(() => {
    value.set(
      withTiming(clamped, {
        duration: duration.slow,
        easing: easing.out,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [clamped, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [circumference * value.get(), circumference],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radiusValue}
          stroke={trackColor ?? colors.surfaceElevated}
          strokeWidth={stroke}
          fill="none"
        />
        {clamped > 0 ? (
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radiusValue}
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
            animatedProps={animatedProps}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
