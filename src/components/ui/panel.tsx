/**
 * Panel — the Double-Bezel card.
 *
 * Outer shell: 2px bezel on a sunken surface with a hairline ring.
 * Inner core: the content surface, concentric radius, hairline + inner
 * highlight. On dark it reads as machined metal; on light as bonded paper.
 */
import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeShadows, radius, spacing, useTheme, type RadiusToken, type SpacingToken } from '@/theme';

export type PanelProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  coreStyle?: StyleProp<ViewStyle>;
  pad?: SpacingToken;
  rounding?: RadiusToken;
  /** Ambient accent glow — reserve for hero surfaces. */
  glow?: boolean;
}>;

export function Panel({
  children,
  style,
  coreStyle,
  pad = 'lg',
  rounding = 'xl',
  glow = false,
}: PanelProps) {
  const { colors } = useTheme();
  const shadows = makeShadows(colors);
  const outerRadius = radius[rounding];
  const innerRadius = Math.max(4, outerRadius - 3);

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceSunken,
          borderRadius: outerRadius,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: 3,
          boxShadow: glow ? `${shadows.card}, ${shadows.glow}` : shadows.card,
        },
        style,
      ]}>
      <View
        style={[
          {
            backgroundColor: colors.surface,
            borderRadius: innerRadius,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.hairline,
            boxShadow: shadows.innerHighlight,
            padding: spacing[pad],
          },
          coreStyle,
        ]}>
        {children}
      </View>
    </View>
  );
}
