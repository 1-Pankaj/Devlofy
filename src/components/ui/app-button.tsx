/**
 * AppButton — a drawn button, not a pill.
 *
 * 6px radius, 40/46px tall, label-led with the icon in front. `filled` is the
 * only brand-solid control on a screen; everything else is tonal, outlined or
 * plain text. There is no gradient, no elevation and no pill radius: the button
 * is a box on the page, the same way a card is.
 */
import type { ComponentType } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { IconProps } from 'phosphor-react-native';

import { radius, spacing, useTheme } from '@/theme';
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

  // A disabled control is a **quiet box, not a faded one**: at 45% opacity a
  // white-on-violet label becomes a lavender smudge with no readable text. It
  // keeps its shape and loses its voice instead.
  const background = disabled
    ? colors.surfaceSunken
    : variant === 'filled'
      ? colors.accent
      : variant === 'tonal'
        ? colors.accentSoft
        : 'transparent';
  const foreground = disabled
    ? colors.textTertiary
    : variant === 'filled'
      ? colors.accentContrast
      : variant === 'outlined'
        ? colors.text
        : colors.accent;
  const height = size === 'lg' ? 46 : 40;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      haptic="light"
      // The drawn control is 40/46; four points of slop keep a small button a
      // 48/54px finger target without changing the drawing.
      hitSlop={4}
      style={[{ alignSelf: full ? 'stretch' : 'flex-start' }, style]}>
      <View
        style={{
          height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: full ? 'center' : 'flex-start',
          gap: spacing.sm,
          paddingHorizontal: size === 'lg' ? spacing.lg + 2 : spacing.md + 2,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: background,
          borderWidth: disabled || variant === 'outlined' ? 1 : 0,
          borderColor: disabled ? colors.hairline : colors.hairlineStrong,
        }}>
        {Icon ? (
          <Icon
            size={size === 'lg' ? 18 : 16}
            color={foreground}
            weight={variant === 'filled' ? 'fill' : 'regular'}
          />
        ) : null}
        <AppText
          variant={size === 'lg' ? 'bodyMedium' : 'subheadMedium'}
          style={{ color: foreground }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
