/**
 * AppButton — Material 3 button.
 *
 * Fully rounded, label-led, with the icon in front of the text. Exactly one
 * `filled` button belongs on a screen; everything else is tonal, outlined, or
 * plain text so the interface stays quiet.
 */
import type { ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { IconProps } from 'phosphor-react-native';

import { makeShadows, radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';
export type ButtonSize = 'md' | 'lg';

type IconComponent = ComponentType<IconProps>;

export type AppButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconComponent;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Stretch to the container width and centre the content. */
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  onPress,
  icon: Icon,
  variant = 'filled',
  size = 'md',
  disabled = false,
  full = false,
  style,
}: AppButtonProps) {
  const { colors } = useTheme();
  const shadows = makeShadows(colors);

  const background =
    variant === 'filled'
      ? colors.accent
      : variant === 'tonal'
        ? colors.accentSoft
        : 'transparent';
  const foreground =
    variant === 'filled'
      ? colors.accentContrast
      : variant === 'tonal'
        ? colors.accent
        : colors.accent;
  const height = size === 'lg' ? 52 : 44;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      haptic="light"
      style={[{ opacity: disabled ? 0.45 : 1, alignSelf: full ? 'stretch' : 'flex-start' }, style]}>
      <View
        style={{
          height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: full ? 'center' : 'flex-start',
          gap: spacing.sm,
          paddingHorizontal: size === 'lg' ? spacing.xl : spacing.lg,
          borderRadius: radius.full,
          backgroundColor: background,
          boxShadow: variant === 'filled' ? shadows.brand : undefined,
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: colors.hairlineStrong,
        }}>
        {Icon ? (
          <Icon size={size === 'lg' ? 20 : 18} color={foreground} weight="fill" />
        ) : null}
        <AppText variant={size === 'lg' ? 'bodyMedium' : 'subheadMedium'} style={{ color: foreground }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
