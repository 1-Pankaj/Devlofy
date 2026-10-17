/**
 * Screen — the page shell every route uses.
 *
 * Owns: safe-area top inset, background, ambient glows, header block
 * (eyebrow + display title), content max-width for tablet/desktop (≈ 920),
 * and bottom padding that clears the floating tab bar. On desktop mode
 * content is centered; the side rail lives in the tab layout, not here.
 */
import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';
import { useBreakpoint, useDesktopMode } from '@/lib/layout/breakpoints';
import { AppText } from './app-text';
import { Glow } from './glow';

export const CONTENT_MAX_WIDTH = 920;

/** Clears the floating tab bar (≈ 60) plus a breath of air. */
const TAB_BAR_CLEARANCE = 96;

export type ScreenHeader = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
};

export type ScreenProps = PropsWithChildren<{
  header?: ScreenHeader;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Set false on screens that render their own glows or a full-bleed scene. */
  ambient?: boolean;
  refreshControl?: ReactElement;
}>;

export function Screen({
  children,
  header,
  scroll = true,
  contentStyle,
  ambient = true,
  refreshControl,
}: ScreenProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const breakpoint = useBreakpoint();
  const desktopMode = useDesktopMode();
  const wide = breakpoint !== 'compact';

  const padTop = insets.top + spacing.md;
  const padBottom = (desktopMode ? spacing.xxxl : TAB_BAR_CLEARANCE) + insets.bottom;

  const inner = (
    <View
      style={[
        {
          width: '100%',
          maxWidth: wide ? CONTENT_MAX_WIDTH : undefined,
          alignSelf: 'center',
          gap: spacing.xxl,
        },
        contentStyle,
      ]}>
      {header ? (
        <View style={{ gap: spacing.xs, paddingTop: spacing.sm }}>
          {header.eyebrow ? (
            <AppText variant="eyebrow" tone="tertiary">
              {header.eyebrow}
            </AppText>
          ) : null}
          <AppText variant="display">{header.title}</AppText>
          {header.subtitle ? (
            <AppText variant="subhead" tone="secondary">
              {header.subtitle}
            </AppText>
          ) : null}
          {header.trailing ? <View style={{ marginTop: spacing.lg }}>{header.trailing}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {ambient && scheme === 'dark' ? (
        <>
          <Glow size={420} color={colors.accent} intensity={0.5} style={{ top: -160, right: -140 }} />
          <Glow size={360} color={colors.info} intensity={0.35} style={{ top: 360, left: -180 }} />
        </>
      ) : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: padTop,
            paddingBottom: padBottom,
          }}>
          {inner}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.xl,
            paddingTop: padTop,
            paddingBottom: padBottom,
          }}>
          {inner}
        </View>
      )}
    </View>
  );
}
