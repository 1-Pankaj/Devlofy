import type { ReactNode } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme, type ThemeColors } from '@/theme';
import { AppText, type TextTone } from './app-text';

/** Small uppercase section label. The connective tissue of the layout. */
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

/**
 * Soft container + ink for a status tone — one map, so a pill and the icon well
 * above it can never disagree about what "danger" looks like.
 */
export function statusColors(
  colors: ThemeColors,
  tone: StatusTone,
): { background: string; foreground: string } {
  return {
    accent: { background: colors.accentSoft, foreground: colors.accent },
    ember: { background: colors.emberSoft, foreground: colors.ember },
    info: { background: colors.infoSoft, foreground: colors.info },
    danger: { background: colors.dangerSoft, foreground: colors.danger },
    neutral: { background: colors.surfaceElevated, foreground: colors.textSecondary },
  }[tone];
}

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
  const { background, foreground } = statusColors(colors, tone);

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          borderRadius: radius.full,
          backgroundColor: background,
          paddingHorizontal: spacing.sm + 2,
          paddingVertical: spacing.xs,
        },
        style,
      ]}>
      <AppText variant="captionMedium" style={{ color: foreground }}>
        {label}
      </AppText>
    </View>
  );
}
