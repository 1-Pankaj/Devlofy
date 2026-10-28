/**
 * FormChip — a selectable box for choice rows (status, block length, project).
 *
 * 6px radius, 1px hairline, 36px tall. Selection is ground + border + ink
 * together, never colour alone: the chip you chose is the one with a brand
 * border, not just brand text.
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
    <PressableScale
      haptic="selection"
      accessibilityLabel={label}
      onPress={onPress}>
      <View
        accessibilityState={{ selected: active }}
        style={{
          paddingHorizontal: spacing.md + 2,
          height: 36,
          justifyContent: 'center',
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : colors.hairline,
          backgroundColor: active ? colors.accentSoft : colors.surface,
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
