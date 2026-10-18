/**
 * Fab — the extended floating action button.
 *
 * Material 3's primary action: it floats above the content, bottom-end, and it
 * is the *only* accent-filled control on the screen. Every other action on a
 * screen is tonal, outlined, or plain text.
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
  const container = tone === 'brand' ? colors.accentSoft : colors.emberSoft;
  const onContainer = tone === 'brand' ? colors.accent : colors.ember;
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
          height: 56,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.full,
          backgroundColor: container,
          boxShadow: shadow,
        }}>
        <Icon size={22} color={onContainer} weight="fill" />
        <AppText variant="bodyMedium" style={{ color: onContainer }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
