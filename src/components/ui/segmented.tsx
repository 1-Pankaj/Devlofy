/**
 * Segmented — Material 3 segmented button.
 *
 * A recessed rail holding pill segments; the selected segment lifts onto the
 * card surface and earns a check mark, so selection reads by *meaning* rather
 * than by colour alone.
 */
import { Check } from 'phosphor-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { makeShadows, radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const shadows = makeShadows(colors);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: spacing.xs,
          padding: spacing.xs,
          borderRadius: radius.full,
          backgroundColor: colors.surfaceSunken,
        },
        style,
      ]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            haptic="selection"
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{ flex: 1 }}
            contentStyle={{ flexGrow: 1 }}>
            <View
              style={{
                height: 34,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: active ? colors.surface : 'transparent',
                boxShadow: active ? shadows.card : undefined,
              }}>
              {active ? <Check size={12} color={colors.accent} weight="bold" /> : null}
              <AppText
                variant="captionMedium"
                style={{ color: active ? colors.accent : colors.textSecondary }}>
                {option.label}
              </AppText>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
