/**
 * ListRow — grouped-list row (hairlines, not cards). Rows highlight rather
 * than scale; use PressableScale only for standalone buttons.
 *
 * Identity reads before text: pass `avatar` for a person or project (tinted
 * initials) or `icon` for a glyph in a tinted well. `tone` tints that well —
 * match the icon's colour to it.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { Avatar } from './avatar';

export type RowTone = 'neutral' | 'accent' | 'ember' | 'info';

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
    neutral: { background: colors.surfaceElevated },
    accent: { background: colors.accentSoft },
    ember: { background: colors.emberSoft },
    info: { background: colors.infoSoft },
  }[tone];

  const leading = avatar ? 'avatar' : icon ? 'icon' : 'none';

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
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}>
        {leading === 'avatar' ? <Avatar name={avatar!} /> : null}
        {leading === 'icon' ? (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: well.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {icon}
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subheadMedium" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
          {footer ? <View style={{ marginTop: 3 }}>{footer}</View> : null}
        </View>
        {trailing}
      </View>
      {showSeparator ? (
        <View
          style={{
            height: 1,
            marginLeft: leading === 'none' ? spacing.lg : spacing.lg + 36 + spacing.md,
            backgroundColor: colors.hairline,
          }}
        />
      ) : null}
    </Pressable>
  );
}
