/**
 * AppButton — pill button with the button-in-button trailing icon.
 * Primary is the only accent-colored action on a screen; everything else is
 * soft or ghost. Scale feedback comes from PressableScale.
 */
import type { ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { IconProps } from 'phosphor-react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export type ButtonVariant = 'primary' | 'soft' | 'ghost';
export type ButtonSize = 'md' | 'lg';

type IconComponent = ComponentType<IconProps>;

export type AppButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconComponent;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
}: AppButtonProps) {
  const { colors } = useTheme();

  const background =
    variant === 'primary' ? colors.accent : variant === 'soft' ? colors.surfaceElevated : 'transparent';
  const labelColor =
    variant === 'primary' ? colors.accentContrast : variant === 'soft' ? colors.text : colors.text;
  const borderColor = variant === 'primary' ? 'transparent' : colors.hairlineStrong;
  const iconWellBackground =
    variant === 'primary'
      ? 'rgba(4, 32, 19, 0.18)'
      : variant === 'soft'
        ? colors.surfaceSunken
        : colors.surfaceElevated;
  const iconColor = variant === 'primary' ? colors.accentContrast : colors.accent;

  const height = size === 'lg' ? 56 : 48;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      haptic="light"
      style={[{ opacity: disabled ? 0.45 : 1, alignSelf: 'flex-start' }, style]}>
      <View
        style={{
          height,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingLeft: size === 'lg' ? spacing.xxl : spacing.xl,
          paddingRight: Icon ? spacing.sm : size === 'lg' ? spacing.xxl : spacing.xl,
          borderRadius: radius.full,
          backgroundColor: background,
          borderWidth: variant === 'primary' ? 0 : 1,
          borderColor,
        }}>
        <AppText variant={size === 'lg' ? 'headline' : 'subheadMedium'} style={{ color: labelColor }}>
          {label}
        </AppText>
        {Icon ? (
          <View
            style={{
              width: size === 'lg' ? 40 : 32,
              height: size === 'lg' ? 40 : 32,
              borderRadius: radius.full,
              backgroundColor: iconWellBackground,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon size={size === 'lg' ? 20 : 17} color={iconColor} weight="regular" />
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
