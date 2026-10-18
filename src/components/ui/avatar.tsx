/**
 * Avatar — a deterministic initials chip.
 *
 * The tint is derived from the name, so the same person or project keeps the
 * same colour on every screen without storing one. Only the sanctioned tint
 * pairs are used, so the accent never loses its meaning. Renders nothing
 * useful for an empty name — callers pass a real one.
 */
import { View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { AppText } from './app-text';

const TINTS = ['accent', 'info', 'ember'] as const;

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

function tintOf(name: string): (typeof TINTS)[number] {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return TINTS[sum % TINTS.length]!;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const tint = tintOf(name);
  const background = {
    accent: colors.accentSoft,
    info: colors.infoSoft,
    ember: colors.emberSoft,
  }[tint];
  const foreground = { accent: colors.accent, info: colors.info, ember: colors.ember }[tint];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText
        variant="captionMedium"
        // Scales with the chip: the avatar's own size is the token here.
        style={{ color: foreground, fontSize: Math.round(size * 0.36), lineHeight: size }}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}
