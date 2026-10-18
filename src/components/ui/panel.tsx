/**
 * Panel — a Material 3 tonal container.
 *
 * A card reads as raised because of **tone**, not because of an outline: it sits
 * one step above the canvas, and the tinted elevation does the rest. There is no
 * 1px grey border anywhere in this system.
 *
 *   filled    resting container (default)
 *   elevated  the thing being interacted with
 *   outlined  secondary grouping where tone alone is too weak
 */
import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeShadows, radius, spacing, useTheme, type RadiusToken, type SpacingToken } from '@/theme';

export type PanelVariant = 'filled' | 'elevated' | 'outlined';

export type PanelProps = PropsWithChildren<{
  variant?: PanelVariant;
  style?: StyleProp<ViewStyle>;
  /** Overrides the container style — pass `padding: 0, overflow: 'hidden'` for lists. */
  coreStyle?: StyleProp<ViewStyle>;
  pad?: SpacingToken;
  rounding?: RadiusToken;
}>;

export function Panel({
  children,
  variant = 'filled',
  style,
  coreStyle,
  pad = 'lg',
  rounding = 'lg',
}: PanelProps) {
  const { colors } = useTheme();
  const shadows = makeShadows(colors);
  const outlined = variant === 'outlined';

  return (
    <View
      style={[
        {
          backgroundColor: outlined ? 'transparent' : colors.surface,
          borderRadius: radius[rounding],
          borderCurve: 'continuous',
          borderWidth: outlined ? 1 : 0,
          borderColor: colors.hairlineStrong,
          boxShadow: variant === 'elevated' ? shadows.raised : outlined ? undefined : shadows.card,
          padding: spacing[pad],
        },
        style,
        coreStyle,
      ]}>
      {children}
    </View>
  );
}
