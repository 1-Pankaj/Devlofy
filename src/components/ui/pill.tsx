import type { ReactNode } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText, type TextTone } from './app-text';

/** Uppercase mono micro-label. The connective tissue of the layout. */
export function Eyebrow({
  children,
  tone = 'tertiary',
  style,
}: {
  children: ReactNode;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <AppText variant="eyebrow" tone={tone} style={style}>
      {children}
    </AppText>
  );
}

export type StatusTone = 'accent' | 'ember' | 'info' | 'danger' | 'neutral';

export function StatusPill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  const toneMap: Record<StatusTone, { background: string; foreground: string }> = {
    accent: { background: colors.accentSoft, foreground: colors.accent },
    ember: { background: colors.emberSoft, foreground: colors.ember },
    info: { background: colors.infoSoft, foreground: colors.info },
    danger: { background: colors.dangerSoft, foreground: colors.danger },
    neutral: { background: colors.surfaceElevated, foreground: colors.textSecondary },
  };
  const { background, foreground } = toneMap[tone];

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: radius.full,
          backgroundColor: background,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: 3,
        },
        style,
      ]}>
      <AppText variant="captionMedium" style={{ color: foreground }}>
        {label}
      </AppText>
    </View>
  );
}
