/**
 * Elevation — barely there, and only where something truly floats.
 *
 * A Primer-shaped interface separates surfaces with a **hairline**, not with a
 * shadow: a card is white on a neutral canvas, outlined by `hairline`, and
 * casts nothing. Shadows survive in exactly two places — the action button that
 * floats over content, and a sheet or popover that leaves the page plane.
 *
 * The old tinted, double-layer card shadows were doing the layering work that
 * borders now do; keeping them would have re-introduced the soft Material look
 * the new palette was chosen to remove.
 */
import { palettes, type ThemeColors } from './colors';

export function makeShadows(colors: ThemeColors) {
  const isDark = colors.background === palettes.dark.background;
  return {
    /** Resting cards: a whisper, only to stop a white card vibrating on white. */
    card: isDark ? '0 1px 2px rgba(0, 0, 0, 0.35)' : '0 1px 2px rgba(21, 21, 26, 0.04)',
    /** A surface that has left the page plane (sheet, menu, popover). */
    raised: isDark
      ? '0 16px 40px rgba(0, 0, 0, 0.6), 0 1px 0 rgba(255, 255, 255, 0.04)'
      : '0 16px 40px rgba(21, 21, 26, 0.14), 0 2px 6px rgba(21, 21, 26, 0.06)',
    /** The floating action button — the one brand-tinted shadow in the app. */
    brand: isDark
      ? '0 10px 24px rgba(0, 0, 0, 0.55)'
      : `0 8px 20px ${colors.accentShadow}`,
  } as const;
}
