/**
 * FeatureCard — a destination, drawn as a product rather than a preference.
 *
 * Bench and Sentinel are the two features this app builds its own tools for, and
 * they used to be two `ListRow`s in the More tab: same height, same hairline,
 * same 17px glyph as "Your name" and "Theme". A reader scans rows and sees
 * settings, so the two biggest things in the app read as the two smallest.
 *
 * What makes this a card instead of a row, in order of how much it matters:
 *
 *   - an icon well on the accent/ember/danger soft tones, not the neutral one;
 *   - a **live** line — the pill carries the feature's present state ("1 down ·
 *     3 up", "11 tools · 3 kept"), so the card answers before you tap it;
 *   - a taller, more padded body, which on its own breaks the scan pattern of a
 *     settings list.
 *
 * The card never decides its own status: the caller passes the pill's text and
 * tone, and both callers (More, Today) get them from the same pure function
 * (`standingLine`), so the card and the strip can never disagree.
 */
import { CaretRight, type IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';
import { Panel } from './panel';
import { statusColors, StatusPill, type StatusTone } from './pill';
import { PressableScale } from './pressable-scale';

export type FeatureCardProps = {
  icon: ComponentType<IconProps>;
  title: string;
  /** What it does, in one line. */
  promise: string;
  /** What it is doing right now — the pill. Omitted when there is nothing true to say. */
  stat?: string;
  /** Tints the icon well and the pill together. Defaults to the brand accent. */
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
          }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: background,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon size={22} color={foreground} weight="light" />
          </View>

          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="subheadMedium" numberOfLines={1}>
              {title}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={2}>
              {promise}
            </AppText>
            {stat ? <StatusPill label={stat} tone={tone} style={{ marginTop: spacing.xs }} /> : null}
          </View>

          <CaretRight size={14} color={colors.textTertiary} weight="bold" />
        </View>
      </PressableScale>
    </Panel>
  );
}
