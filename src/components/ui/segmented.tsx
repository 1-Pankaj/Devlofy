import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';
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

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: 3,
          padding: 3,
          borderRadius: radius.full,
          backgroundColor: colors.surfaceSunken,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        style,
      ]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <PressableScale
            key={option.value}
            haptic="selection"
            onPress={() => onChange(option.value)}
            style={{ flex: 1 }}
            contentStyle={{ flexGrow: 1 }}>
            <View
              style={{
                height: 36,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.accentSoft : 'transparent',
                borderWidth: active ? 1 : 0,
                borderColor: colors.accentBorder,
              }}>
              <AppText variant="captionMedium" style={{ color: active ? colors.accent : colors.textSecondary }}>
                {option.label}
              </AppText>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
