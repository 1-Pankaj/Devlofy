import { Text, type TextProps, type TextStyle } from 'react-native';

import { typeScale, type TypeVariant, useTheme } from '@/theme';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'ember'
  | 'info'
  | 'danger'
  | 'contrast';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
};

export function AppText({ variant = 'body', tone = 'default', style, ...rest }: AppTextProps) {
  const { colors } = useTheme();

  const toneColor: Record<TextTone, string> = {
    default: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accent,
    ember: colors.ember,
    info: colors.info,
    danger: colors.danger,
    contrast: colors.accentContrast,
  };

  return (
    <Text
      style={[typeScale[variant] as TextStyle, { color: toneColor[tone] }, style]}
      {...rest}
    />
  );
}
