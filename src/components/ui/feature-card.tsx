/**
 * FeatureCard — a destination, drawn as a product rather than a preference.
 *
 * Bench and Sentinel are the two features this app builds its own tools for, and
 * they used to be two `ListRow`s in the More tab: same height, same hairline,
 * same 17px glyph as "Your name" and "Theme". A reader scans rows and sees
 * settings, so the two biggest things in the app read as the two smallest.
 *
 * The card answers before you tap it: the icon well carries the feature's tone,
 * and the footer is a **live line** — a dot and the present state, in mono —
 * never a decorative subtitle. The card never decides its own status: the caller
 * passes the text and tone, both derived from the same pure function that feeds
 * the Today strip.
 */
import { CaretRight, type IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { Panel } from './panel';
import { statusColors, type StatusTone } from './pill';
import { PressableScale } from './pressable-scale';

export type FeatureCardProps = {
  icon: ComponentType<IconProps>;
  title: string;
  /** What it does, in one line. */
  promise: string;
  /** What it is doing right now — the live footer. Omitted when there is nothing true to say. */
  stat?: string;
  /** Tints the icon well and the live dot together. Defaults to the brand accent. */
  tone?: StatusTone;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function FeatureCard({
  icon: Icon,
  title,
  promise,
  stat,
  tone = 'accent',
  onPress,
  accessibilityLabel,
}: FeatureCardProps) {
  const { colors } = useTheme();
  const { background, foreground } = statusColors(colors, tone);

  return (
    <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
      <PressableScale
        haptic="light"
        accessibilityLabel={accessibilityLabel ?? `${title}: ${promise}`}
        onPress={onPress}>
        <View style={{ padding: spacing.md + 2, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: background,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon size={17} color={foreground} weight="regular" />
            </View>
            <AppText variant="headline" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </AppText>
            <CaretRight size={13} color={colors.textTertiary} weight="bold" />
          </View>

          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            {promise}
          </AppText>

          {stat ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.hairline,
              }}>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: foreground,
                }}
              />
              <AppText variant="code" style={{ color: foreground, fontSize: 11.5 }}>
                {stat}
              </AppText>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </Panel>
  );
}
