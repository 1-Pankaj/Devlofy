import type { ComponentType } from 'react';
import { Image, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { IconProps } from 'phosphor-react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';

type IconComponent = ComponentType<IconProps>;

export function EmptyState({
  icon: Icon,
  image,
  title,
  message,
}: {
  icon?: IconComponent;
  /** Rendered still of a 3D prop — takes precedence over the icon mark. */
  image?: ImageSourcePropType;
  title: string;
  message?: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
      {image ? (
        <Image
          source={image}
          style={{ width: 144, height: 144, marginBottom: spacing.xs }}
          resizeMode="contain"
        />
      ) : Icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xs,
          }}>
          <Icon size={24} color={colors.textTertiary} weight="light" />
        </View>
      ) : null}
      <AppText variant="headline">{title}</AppText>
      {message ? (
        <AppText variant="subhead" tone="secondary" style={{ textAlign: 'center', maxWidth: 300 }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}
