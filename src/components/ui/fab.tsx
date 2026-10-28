/**
 * Fab — the extended floating action.
 *
 * The one solid brand control on a screen: a 48px box with an 8px radius, a
 * 6px/20px brand shadow, and the icon in front of the label. It is deliberately
 * not a Material pill — it belongs to the same geometry as every card behind it.
 *
 * `ember` marks the live-session action. On amber, the label uses the surface
 * colour, which is white in light mode and near-black in dark — correct in both
 * without a fourth token.
 */
import type { ComponentType } from 'react';
import { View } from 'react-native';
import type { IconProps } from 'phosphor-react-native';

import { makeShadows, radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export type FabProps = {
  label: string;
  icon: ComponentType<IconProps>;
  onPress?: () => void;
  disabled?: boolean;
  /** `ember` marks the live session action. */
  tone?: 'brand' | 'ember';
};

export function Fab({ label, icon: Icon, onPress, disabled = false, tone = 'brand' }: FabProps) {
  const { colors } = useTheme();
  const shadows = makeShadows(colors);
  const background = tone === 'brand' ? colors.accent : colors.ember;
  const foreground = tone === 'brand' ? colors.accentContrast : colors.surface;
  const shadow = tone === 'brand' ? shadows.brand : shadows.raised;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="medium"
      accessibilityLabel={label}
      style={{ opacity: disabled ? 0.5 : 1, alignSelf: 'flex-end' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          height: 48,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: background,
          boxShadow: shadow,
        }}>
        <Icon size={18} color={foreground} weight="fill" />
        <AppText variant="subheadMedium" style={{ color: foreground }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
