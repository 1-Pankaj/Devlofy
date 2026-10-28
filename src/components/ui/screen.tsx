/**
 * Screen — the page shell every route uses.
 *
 * Owns: the safe-area inset, the page header, a readable max width for tablets
 * and desktop, and the floating action slot.
 *
 * The header is a **page head**, not a Material app bar: a mono eyebrow, the
 * title, and a quiet subtitle, with the page's one trailing action aligned to
 * the first line. When the page scrolls, a compact bar takes over at the top of
 * the viewport — surface, hairline, the title in 17px — so the reader always
 * knows where they are without the header occupying the screen twice. The bar is
 * painted, never interactive (`pointerEvents="none"`), so it cannot swallow a
 * tap meant for the content underneath it.
 */
import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';
import { useBreakpoint, useDesktopMode } from '@/lib/layout/breakpoints';
import { AppText } from './app-text';

export const CONTENT_MAX_WIDTH = 920;

/**
 * The measure for prose that is being **written**, not scanned: a note, an
 * invoice letter. `CONTENT_MAX_WIDTH` is a page of lists and figures; a column
 * of body text at 880px runs to 110 characters a line, which is a magazine
 * spread, not a document.
 */
export const DOCUMENT_MAX_WIDTH = 760;

export type ScreenHeader = {
  /** Small mono label above the title. */
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

  const padTop = insets.top + spacing.md;
  const padBottom = insets.bottom + (desktopMode ? spacing.xxxl : spacing.xxl) + (fab ? 72 : 0);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [10, 56], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.get(), [10, 56], [-6, 0], 'clamp') }],
  }));

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
        <View style={{ paddingTop: spacing.xs, paddingBottom: spacing.xs }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              {header.eyebrow ? (
                <AppText variant="monoLabel" tone="tertiary">
                  {header.eyebrow}
                </AppText>
              ) : null}
              <AppText variant="display" numberOfLines={2}>
                {header.title}
              </AppText>
              {header.subtitle ? (
                <AppText variant="subhead" tone="secondary">
                  {header.subtitle}
                </AppText>
              ) : null}
            </View>
            {header.trailing ? (
              <View
                style={{
                  paddingTop: spacing.xxs,
                  // The trailing slot is for actions, but a caller can put anything
                  // in it — so it may never take more than half the row, or the
                  // title would be crushed to a column of single characters.
                  flexShrink: 1,
                  maxWidth: '55%',
                  alignItems: 'flex-end',
                }}>
                {header.trailing}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: padTop,
            paddingBottom: padBottom,
          }}>
          {inner}
        </Animated.ScrollView>
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

      {header && scroll ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              paddingTop: insets.top,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.hairline,
            },
            compactStyle,
          ]}>
          <View
            style={{
              height: 44,
              justifyContent: 'center',
              paddingHorizontal: spacing.lg,
              maxWidth: wide ? CONTENT_MAX_WIDTH : undefined,
              width: '100%',
              alignSelf: 'center',
            }}>
            <AppText variant="headline" numberOfLines={1}>
              {header.title}
            </AppText>
          </View>
        </Animated.View>
      ) : null}

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
