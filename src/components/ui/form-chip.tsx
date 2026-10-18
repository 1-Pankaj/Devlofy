/**
 * FormChip — a selectable pill for choice rows (status, block length, project).
 * Tone carries the selection; there is no outline.
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
          height: 40,
          justifyContent: 'center',
          borderRadius: radius.full,
          backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
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
