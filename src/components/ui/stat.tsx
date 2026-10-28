/**
 * Stat — a figure and its mono label.
 *
 * The pairing is the point: a counted value in tabular figures over a 10.5px
 * mono label, with no unit word in the number itself. Screens compose three or
 * four of these instead of drawing their own number blocks, so the rhythm of a
 * stat row is identical everywhere.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { spacing, useTheme, type TypeVariant } from '@/theme';
import { AnimatedNumber } from './animated-number';
import { AppText } from './app-text';

export function Stat({
  label,
  value,
  format,
  precision,
  variant = 'numberLg',
  color,
  style,
}: {
  label: string;
  value: number;
  format?: (value: number) => string;
  /** Decimal places for the count. Money needs 2; most figures need none. */
  precision?: number;
  variant?: TypeVariant;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View style={[{ gap: 2 }, style]}>
      <AnimatedNumber
        value={value}
        format={format}
        precision={precision}
        variant={variant}
        color={color ?? colors.text}
      />
      <AppText variant="monoLabel" tone="tertiary">
        {label}
      </AppText>
    </View>
  );
}

/** A stat row with hairline dividers between the figures. */
export function StatRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const items = Array.isArray(children) ? children : [children];

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'stretch' }, style]}>
      {items.map((item, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            gap: spacing.xxs,
            paddingLeft: index === 0 ? 0 : spacing.lg,
            borderLeftWidth: index === 0 ? 0 : 1,
            borderLeftColor: colors.hairline,
            marginLeft: index === 0 ? 0 : spacing.lg,
          }}>
          {item}
        </View>
      ))}
    </View>
  );
}
