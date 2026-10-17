import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

export type ProgressRingProps = {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
};

export function ProgressRing({
  progress,
  size = 72,
  stroke = 6,
  color,
  children,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const strokeColor = color ?? colors.accent;
  const center = size / 2;
  const radiusValue = center - stroke / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radiusValue}
          stroke={colors.hairline}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radiusValue}
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </View>
  );
}
