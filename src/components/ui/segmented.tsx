/**
 * Segmented — a rail with a travelling thumb.
 *
 * One white thumb rides under the selected option; it does not fade in place.
 * The movement is the feedback — 200ms on the emphasised curve, measured from
 * the rail's own layout, so it lands exactly on any width. Options keep their
 * `accessibilityState`, so selection is never colour-only for a screen reader.
 */
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration, easing, makeShadows, radius, useTheme } from '@/theme';
import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

const PAD = 3;
const HEIGHT = 32;

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
  const { colors, scheme } = useTheme();
  const shadows = makeShadows(colors);
  const [width, setWidth] = useState(0);

  /**
   * The thumb must be the **lighter** plane in both schemes. On dark, `surface`
   * (#141419) is darker than the sunken rail (#24242C), so reusing the light
   * mapping would punch the selected option out of the rail instead of raising
   * it: the rail steps up to `surfaceElevated`, the thumb to `controlThumb`.
   */
  const track = scheme === 'dark' ? colors.surfaceElevated : colors.surfaceSunken;
  const thumb = colors.controlThumb;
  const thumbBorder = scheme === 'dark' ? colors.hairlineStrong : colors.hairline;

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const itemWidth = width > 0 ? (width - PAD * 2) / options.length : 0;
  const shift = useSharedValue(0);

  useEffect(() => {
    shift.set(
      withTiming(index * itemWidth, { duration: duration.base, easing: easing.emphasized }),
    );
  }, [index, itemWidth, shift]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        {
          flexDirection: 'row',
          padding: PAD,
          height: HEIGHT + PAD * 2,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: track,
        },
        style,
      ]}>
      {itemWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: PAD,
              left: PAD,
              width: itemWidth,
              height: HEIGHT,
              borderRadius: radius.sm,
              borderCurve: 'continuous',
              backgroundColor: thumb,
              borderWidth: 1,
              borderColor: thumbBorder,
              boxShadow: shadows.card,
            },
            thumbStyle,
          ]}
        />
      ) : null}

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
              accessibilityState={{ selected: active }}
              style={{
                height: HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                flexGrow: 1,
              }}>
              <AppText
                variant="captionMedium"
                style={{ color: active ? colors.text : colors.textSecondary }}>
                {option.label}
              </AppText>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
