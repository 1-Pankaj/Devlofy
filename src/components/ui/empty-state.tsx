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
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
      {image ? (
        <Image
          source={image}
          style={{ width: 104, height: 104, marginBottom: spacing.xs }}
          resizeMode="contain"
        />
      ) : Icon ? (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xs,
          }}>
          <Icon size={22} color={colors.textTertiary} weight="regular" />
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
