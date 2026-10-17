/**
 * Ambient radial glow — the only "gradient" in the system. Rendered as an SVG
 * radial gradient so it stays smooth and cheap on native and web.
 */
import { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function Glow({
  size = 360,
  color,
  intensity = 1,
  style,
}: {
  size?: number;
  color: string;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const gradientId = `glow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.5 * intensity} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.16 * intensity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}
