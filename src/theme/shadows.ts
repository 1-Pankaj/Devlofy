/**
 * Shadows are CSS `boxShadow` strings (never legacy shadow/elevation props).
 * Two elevations + one ambient glow are enough for the whole system.
 */
import type { ThemeColors } from './colors';

export function makeShadows(colors: ThemeColors) {
  const isDark = colors.background === '#070A08';
  return {
    card: isDark
      ? '0 12px 32px rgba(0, 0, 0, 0.45)'
      : '0 10px 28px rgba(16, 24, 18, 0.10)',
    raised: isDark
      ? '0 20px 48px rgba(0, 0, 0, 0.55)'
      : '0 18px 40px rgba(16, 24, 18, 0.16)',
    /** Ambient accent glow, used very sparingly (hero panel, garden frame). */
    glow: `0 0 48px 0 ${colors.glowA}`,
    /** Inner hairline highlight for bezel cores. */
    innerHighlight: isDark
      ? 'inset 0 1px 1px rgba(255, 255, 255, 0.06)'
      : 'inset 0 1px 1px rgba(255, 255, 255, 0.7)',
  } as const;
}

export type AppShadows = ReturnType<typeof makeShadows>;
