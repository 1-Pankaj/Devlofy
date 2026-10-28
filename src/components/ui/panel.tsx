/**
 * Panel — the app's one container.
 *
 * A white surface, held by a 1px hairline, with a 8px radius and no shadow. That
 * is the whole idea: the interface is a stack of drawn boxes on a neutral
 * canvas, and depth is only used when something actually leaves the page.
 *
 *   filled    white + hairline (default) — every card, list and form
 *   elevated  white + hairline + a real shadow — a surface that floats
 *   outlined  transparent + a stronger hairline — a secondary grouping
 *
 * `tone="sunken"` is the flat alternative: a recessed well for a segmented rail
 * or a read-only block, with no border at all.
 */
import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeShadows, radius, spacing, useTheme, type RadiusToken, type SpacingToken } from '@/theme';

export type PanelVariant = 'filled' | 'elevated' | 'outlined';
export type PanelTone = 'default' | 'sunken';

export type PanelProps = PropsWithChildren<{
  variant?: PanelVariant;
  tone?: PanelTone;
  style?: StyleProp<ViewStyle>;
  /** Overrides the container style — pass `padding: 0, overflow: 'hidden'` for lists. */
  coreStyle?: StyleProp<ViewStyle>;
  pad?: SpacingToken;
  rounding?: RadiusToken;
}>;

export function Panel({
  children,
  variant = 'filled',
  tone = 'default',
  style,
  coreStyle,
  pad = 'lg',
  rounding = 'lg',
}: PanelProps) {
  const { colors } = useTheme();
  const shadows = makeShadows(colors);

  const sunken = tone === 'sunken';
  const outlined = variant === 'outlined';

  return (
    <View
      style={[
        {
          backgroundColor: sunken ? colors.surfaceElevated : outlined ? 'transparent' : colors.surface,
          borderRadius: radius[rounding],
          borderCurve: 'continuous',
          borderWidth: sunken ? 0 : 1,
          borderColor: outlined ? colors.hairlineStrong : colors.hairline,
          boxShadow: variant === 'elevated' ? shadows.raised : undefined,
          padding: spacing[pad],
        },
        style,
        coreStyle,
      ]}>
      {children}
    </View>
  );
}
