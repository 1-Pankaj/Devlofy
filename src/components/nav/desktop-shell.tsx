/**
 * DesktopShell — the desktop mode.
 *
 * Expanded widths (tablets, desktop-class Android, wide web) get a side rail
 * instead of a bottom bar: brand block, navigation, and a local-first footer.
 * Screens render in the remaining space via <Slot />.
 */
import { Slot, usePathname, useRouter } from 'expo-router';
import { Leaf } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from '@/components/ui/app-text';
import { APP_VERSION } from '@/lib/version';
import { NAV_ITEMS } from './nav-items';

export function DesktopShell() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View
        style={{
          width: 260,
          backgroundColor: colors.surface,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.md,
        }}>
        {/* Brand */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.sm,
            marginBottom: spacing.xxl,
          }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Leaf size={19} color={colors.accent} weight="fill" />
          </View>
          <View style={{ gap: 1 }}>
            <AppText variant="headline">Devlofy</AppText>
            <AppText variant="caption" tone="tertiary">
              local-first
            </AppText>
          </View>
        </View>

        {/* Navigation */}
        <View style={{ gap: spacing.xxs }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path;
            const Icon = item.icon;
            const color = active ? colors.accent : colors.textSecondary;
            return (
              <Pressable
                key={item.path}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => router.navigate(item.path as never)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                  height: 44,
                  borderRadius: radius.full,
                  borderCurve: 'continuous',
                  backgroundColor: active
                    ? colors.accentSoft
                    : pressed
                      ? colors.surfaceElevated
                      : 'transparent',
                })}>
                <Icon size={19} color={color} weight={active ? 'fill' : 'regular'} />
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
        <View style={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
          <AppText variant="caption" tone="tertiary">
            v{APP_VERSION} · offline
          </AppText>
          <AppText variant="caption" tone="tertiary">
            All data lives on this device.
          </AppText>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );
}
