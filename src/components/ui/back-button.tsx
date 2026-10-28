import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export function BackRow({ label = 'Back' }: { label?: string }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      style={{ alignSelf: 'flex-start' }}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <CaretLeft size={16} color={colors.text} weight="bold" />
        </View>
        <AppText variant="captionMedium" tone="secondary">
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
