/**
 * FormChip — a selectable pill for form choice rows (status, due window,
 * client). One accent at a time: the active chip only.
 */
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { radius, spacing, useTheme } from '@/theme';

export function FormChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale haptic="selection" accessibilityLabel={label} onPress={onPress}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : colors.hairline,
        }}>
        <AppText
          variant="captionMedium"
          style={{ color: active ? colors.accent : colors.textSecondary }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
