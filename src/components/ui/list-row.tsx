/**
 * ListRow — grouped-list row (hairlines, not cards). Rows highlight rather
 * than scale; use PressableScale only for standalone buttons.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { AppText } from './app-text';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
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
  trailing,
  footer,
  onPress,
  showSeparator = false,
}: ListRowProps) {
  const { colors } = useTheme();

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
        {icon ? (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: colors.surfaceElevated,
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
            marginLeft: icon ? spacing.lg + 36 + spacing.md : spacing.lg,
            backgroundColor: colors.hairline,
          }}
        />
      ) : null}
    </Pressable>
  );
}
