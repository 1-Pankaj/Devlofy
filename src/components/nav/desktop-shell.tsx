/**
 * DesktopRail — the side navigation for expanded widths.
 *
 * A brand block, a search affordance, the five destinations, and a local-first
 * footer. The rail is white, held by a hairline, 248px wide — the same drawing
 * rules as every card on the page.
 *
 * It sits at the **root** of the app, not inside the tabs: a pushed screen (a
 * project, a pull request, the invoice) must live beside the rail rather than
 * over it, or every detail page would centre itself on the window and slide
 * under the navigation. The active destination carries a 2px brand rule on the
 * rail's edge *and* the soft brand ground, so it reads in a glance and in
 * peripheral vision; a detail route keeps its parent lit rather than clearing
 * the selection.
 */
import { usePathname, useRouter } from 'expo-router';
import { Leaf, MagnifyingGlass } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { APP_VERSION } from '@/lib/version';
import { activeNavPath, NAV_ITEMS } from './nav-items';

export function DesktopRail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const current = activeNavPath(pathname);

  return (
    <View
      style={{
        width: 248,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.hairline,
        paddingTop: insets.top + spacing.lg,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.sm,
      }}>
      {/* Brand */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm + 2,
          paddingHorizontal: spacing.sm,
          marginBottom: spacing.lg,
        }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Leaf size={16} color={colors.accentContrast} weight="fill" />
        </View>
        <View style={{ gap: 1, flex: 1 }}>
          <AppText variant="headline">Devlofy</AppText>
          <AppText variant="monoLabel" tone="tertiary">
            local-first
          </AppText>
        </View>
        <AppText variant="code" tone="tertiary" style={{ fontSize: 10.5 }}>
          v{APP_VERSION}
        </AppText>
      </View>

      {/* Search */}
      <PressableScale
        haptic="selection"
        accessibilityLabel="Search everything"
        onPress={() => router.push('/search')}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: 32,
            paddingHorizontal: spacing.sm + 2,
            marginHorizontal: spacing.xs,
            marginBottom: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.surfaceElevated,
          }}>
          <MagnifyingGlass size={13} color={colors.textTertiary} weight="bold" />
          <AppText variant="caption" tone="tertiary" style={{ flex: 1 }}>
            Search
          </AppText>
        </View>
      </PressableScale>

      <AppText
        variant="monoLabel"
        tone="tertiary"
        style={{ paddingHorizontal: spacing.sm + 2, marginBottom: spacing.xs }}>
        workspace
      </AppText>

      {/* Navigation */}
      <View style={{ gap: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = current === item.path;
          const Icon = item.icon;
          return (
            <Pressable
              key={item.path}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.navigate(item.path as never)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm + 2,
                paddingHorizontal: spacing.sm + 2,
                height: 36,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: active
                  ? colors.accentSoft
                  : pressed
                    ? colors.surfaceElevated
                    : 'transparent',
              })}>
              {active ? (
                <View
                  style={{
                    position: 'absolute',
                    left: -spacing.sm,
                    top: 9,
                    bottom: 9,
                    width: 2,
                    borderTopRightRadius: 2,
                    borderBottomRightRadius: 2,
                    backgroundColor: colors.accent,
                  }}
                />
              ) : null}
              <Icon
                size={17}
                color={active ? colors.accent : colors.textSecondary}
                weight={active ? 'fill' : 'regular'}
              />
              <AppText
                variant="subheadMedium"
                style={{ color: active ? colors.accent : colors.text }}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* Footer */}
      <View
        style={{
          gap: 4,
          paddingHorizontal: spacing.sm + 2,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          marginTop: spacing.md,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: colors.accent,
            }}
          />
          <AppText variant="monoLabel" tone="secondary">
            on this device
          </AppText>
        </View>
        <AppText variant="code" tone="tertiary" style={{ fontSize: 10.5 }}>
          expo · sqlite · three
        </AppText>
      </View>
    </View>
  );
}
