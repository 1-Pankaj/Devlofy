/**
 * ListRow — a row in a grouped list. Hairlines, not cards.
 *
 * The row is 50–56px tall, the icon well is 30px on a 6px radius, and the
 * separator starts where the *text* starts — so a column of rows reads as one
 * table rather than a stack of lightly separated lines.
 *
 * Identity reads before text: pass `avatar` for a person or project (tinted
 * initials) or `icon` for a glyph in a well. `tone` tints that well.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { Avatar } from './avatar';

export type RowTone = 'neutral' | 'accent' | 'ember' | 'info' | 'danger';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Name rendered as a tinted initials avatar. Takes precedence over `icon`. */
  avatar?: string;
  /** Tints the icon well (ignored when `avatar` is set). */
  tone?: RowTone;
  trailing?: ReactNode;
  /** Extra content under the subtitle (tag chips, links). */
  footer?: ReactNode;
  onPress?: () => void;
  /** True when this row is inside a group and more rows follow. */
  showSeparator?: boolean;
};

const WELL = 30;
const ROW_PAD = 14;

export function ListRow({
  title,
  subtitle,
  icon,
  avatar,
  tone = 'neutral',
  trailing,
  footer,
  onPress,
  showSeparator = false,
}: ListRowProps) {
  const { colors } = useTheme();

  const well = {
    neutral: { background: colors.surfaceElevated, ink: colors.textSecondary },
    accent: { background: colors.accentSoft, ink: colors.accent },
    ember: { background: colors.emberSoft, ink: colors.ember },
    info: { background: colors.infoSoft, ink: colors.info },
    danger: { background: colors.dangerSoft, ink: colors.danger },
  }[tone];

  const leading = avatar ? 'avatar' : icon ? 'icon' : 'none';
  const inset = leading === 'none' ? ROW_PAD : ROW_PAD + WELL + spacing.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        backgroundColor: pressed && onPress ? colors.surfaceElevated : 'transparent',
      })}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: ROW_PAD,
          paddingVertical: 11,
          minHeight: 52,
        }}>
        {leading === 'avatar' ? <Avatar name={avatar!} size={WELL} /> : null}
        {leading === 'icon' ? (
          <View
            style={{
              width: WELL,
              height: WELL,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: well.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {icon}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 1 }}>
          <AppText variant="subheadMedium" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
          {footer ? <View style={{ marginTop: 4 }}>{footer}</View> : null}
        </View>
        {trailing}
      </View>
      {showSeparator ? (
        <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.hairline }} />
      ) : null}
    </Pressable>
  );
}
