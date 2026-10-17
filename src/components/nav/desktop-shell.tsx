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
import { NAV_ITEMS } from './nav-items';

const APP_VERSION = '0.1.0';

export function DesktopShell() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View
        style={{
          width: 264,
          borderRightWidth: 1,
          borderColor: colors.hairline,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.lg,
          paddingHorizontal: spacing.lg,
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
              width: 38,
              height: 38,
              borderRadius: radius.md,
              backgroundColor: colors.accentSoft,
              borderWidth: 1,
              borderColor: colors.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Leaf size={20} color={colors.accent} weight="fill" />
          </View>
          <View style={{ gap: 1 }}>
            <AppText variant="headline">Devlofy</AppText>
            <AppText variant="eyebrow" tone="tertiary">
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
                  paddingHorizontal: spacing.md,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: active
                    ? colors.accentSoft
                    : pressed
                      ? colors.surfaceElevated
                      : 'transparent',
                })}>
                <Icon size={20} color={color} weight={active ? 'fill' : 'regular'} />
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
          <AppText variant="mono" tone="tertiary">
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
