/**
 * Small type: the label above a section, and the status tag beside a row.
 *
 * `Eyebrow` is mono now — tracked, uppercase, 10.5px — because in this interface
 * every measured thing speaks in the machine voice. `StatusPill` is a **tag**,
 * not a chip: a 3px radius, 12px label, a soft ground and a matching ink, and an
 * optional 5px dot when the tag is reporting live state.
 */
import type { ReactNode } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { radius, useTheme, type ThemeColors } from '@/theme';
import { AppText, type TextTone } from './app-text';

/** Small mono section label. The connective tissue of the layout. */
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
    <AppText variant="monoLabel" tone={tone} style={style}>
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
  dot = false,
  style,
}: {
  label: string;
  tone?: StatusTone;
  /** A 5px dot in the tag's ink — use it when the tag reports the present. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const { background, foreground } = statusColors(colors, tone);

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          borderRadius: radius.xs,
          backgroundColor: background,
          paddingHorizontal: 6,
          paddingVertical: 2,
        },
        style,
      ]}>
      {dot ? (
        <View
          style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: foreground }}
        />
      ) : null}
      <AppText variant="captionMedium" style={{ color: foreground, fontSize: 12, lineHeight: 17 }}>
        {label}
      </AppText>
    </View>
  );
}
