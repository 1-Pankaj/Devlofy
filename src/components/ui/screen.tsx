/**
 * Screen — the page shell every route uses.
 *
 * Owns: safe-area top inset, background, the Material 3 large top app bar
 * (tracked label, display title, subtitle, trailing action on the same line),
 * a readable max-width for tablet/desktop (≈ 920), and the floating action slot.
 *
 * The FAB lives *outside* the scroll view so it floats over content, and the
 * scroll padding grows to clear it.
 */
import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';
import { useBreakpoint, useDesktopMode } from '@/lib/layout/breakpoints';
import { AppText } from './app-text';

export const CONTENT_MAX_WIDTH = 920;

export type ScreenHeader = {
  /** Small tracked label above the title. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
};

export type ScreenProps = PropsWithChildren<{
  header?: ScreenHeader;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement;
  /** Floats bottom-end over the content. One per screen. */
  fab?: ReactNode;
}>;

export function Screen({
  children,
  header,
  scroll = true,
  contentStyle,
  refreshControl,
  fab,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const breakpoint = useBreakpoint();
  const desktopMode = useDesktopMode();
  const wide = breakpoint !== 'compact';

  const padTop = insets.top + spacing.sm;
  const padBottom = insets.bottom + (desktopMode ? spacing.xxxl : spacing.xxl) + (fab ? 72 : 0);

  const inner = (
    <View
      style={[
        {
          width: '100%',
          maxWidth: wide ? CONTENT_MAX_WIDTH : undefined,
          alignSelf: 'center',
          gap: spacing.lg,
        },
        contentStyle,
      ]}>
      {header ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
          }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
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
          </View>
          {header.trailing ? <View style={{ paddingTop: spacing.xs }}>{header.trailing}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: padTop,
            paddingBottom: padBottom,
          }}>
          {inner}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            paddingTop: padTop,
            paddingBottom: padBottom,
          }}>
          {inner}
        </View>
      )}

      {fab ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: spacing.lg,
            right: spacing.lg,
            bottom: spacing.lg,
            alignItems: 'flex-end',
          }}>
          {fab}
        </View>
      ) : null}
    </View>
  );
}
