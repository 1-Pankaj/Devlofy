import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing } from '@/theme';
import { AppText } from './app-text';
import { Eyebrow } from './pill';
import { PressableScale } from './pressable-scale';

export function SectionHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: spacing.md,
        marginBottom: spacing.md,
      }}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <AppText variant="headline">{title}</AppText>
      </View>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} haptic="selection">
          <AppText variant="captionMedium" tone="accent">
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : (
        (trailing ?? null)
      )}
    </View>
  );
}
