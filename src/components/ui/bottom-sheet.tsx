/**
 * BottomSheet — the app's one sheet.
 *
 * A scrim, a surface that rises from the bottom, a title, and a close button.
 * Everything else is the caller's, because the three sheets that needed this
 * (link pickers, the block menu, note actions) were about to be three copies of
 * the same 40 lines. Rows come from `SheetRow` and the two-column type cards
 * from `SheetOption`, so a menu looks like a menu wherever it appears.
 */
import { X } from 'phosphor-react-native';
import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from 'phosphor-react-native';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { radius, spacing, useTheme } from '@/theme';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** One quiet line under the title — what this sheet will do, or why it cannot. */
  note?: string;
  children: ReactNode;
  /** Cap the body and let it scroll (long lists, notes pickers). */
  scroll?: boolean;
  /**
   * The sheet is gone — animation finished, focus handed back. Web only: it is
   * how a caller knows it may move the caret (see the note screen's jump).
   */
  onDismiss?: () => void;
};

export function BottomSheet({ visible, onClose, title, note, children, scroll, onDismiss }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <Pressable
        accessibilityLabel="Close sheet"
        style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
        onPress={onClose}>
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.hairline,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingBottom: spacing.md,
            }}>
            <View style={{ flex: 1 }}>
              <AppText variant="headline">{title}</AppText>
              {note ? (
                <AppText variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
                  {note}
                </AppText>
              ) : null}
            </View>
            <PressableScale haptic="light" hitSlop={8} accessibilityLabel="Close" onPress={onClose}>
              <X size={18} color={colors.textTertiary} weight="bold" />
            </PressableScale>
          </View>

          {scroll ? (
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type SheetRowProps = {
  label: string;
  icon?: ComponentType<IconProps>;
  /** A second line under the label. */
  detail?: string;
  tone?: 'default' | 'accent' | 'danger' | 'ember';
  disabled?: boolean;
  selected?: boolean;
  onPress: () => void;
};

export function SheetRow({
  label,
  icon: Icon,
  detail,
  tone = 'default',
  disabled = false,
  selected = false,
  onPress,
}: SheetRowProps) {
  const { colors } = useTheme();
  const tint = disabled
    ? colors.textTertiary
    : tone === 'danger'
      ? colors.danger
      : tone === 'accent'
        ? colors.accent
        : tone === 'ember'
          ? colors.ember
          : colors.text;

  return (
    <PressableScale
      haptic="selection"
      disabled={disabled}
      accessibilityLabel={label}
      onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          minHeight: 52,
        }}>
        {Icon ? <Icon size={18} color={tint} weight="regular" /> : null}
        <View style={{ flex: 1 }}>
          <AppText variant="subheadMedium" style={{ color: tint }}>
            {label}
          </AppText>
          {detail ? (
            <AppText variant="caption" tone="tertiary" style={{ marginTop: spacing.xxs }}>
              {detail}
            </AppText>
          ) : null}
        </View>
        {selected ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: colors.accent,
            }}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}

export type SheetOptionProps = {
  label: string;
  icon: ComponentType<IconProps>;
  active?: boolean;
  onPress: () => void;
};

/** A type card — the two-column grid of things a block can become. */
export function SheetOption({ label, icon: Icon, active = false, onPress }: SheetOptionProps) {
  const { colors } = useTheme();

  return (
    <PressableScale haptic="selection" accessibilityLabel={label} onPress={onPress} style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          height: 46,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : colors.hairline,
        }}>
        <Icon size={16} color={active ? colors.accent : colors.textSecondary} weight="regular" />
        <AppText
          variant="captionMedium"
          tone={active ? 'accent' : 'secondary'}
          numberOfLines={1}
          style={{ flex: 1 }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
