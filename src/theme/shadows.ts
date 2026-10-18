/**
 * Elevation — Material 3 levels, expressed as CSS `boxShadow` strings (never
 * legacy shadow/elevation props).
 *
 * Shadows are *tinted*, not black: in light they carry the primary hue, in dark
 * they stay neutral because the canvas is already near-black. Tone does most of
 * the layering work; elevation is the second signal, never the first.
 */
import { palettes, type ThemeColors } from './colors';

export function makeShadows(colors: ThemeColors) {
  const isDark = colors.background === palettes.dark.background;
  return {
    /** Level 1 — resting cards. */
    card: isDark
      ? '0 1px 2px rgba(0, 0, 0, 0.4)'
      : '0 1px 2px rgba(30, 27, 75, 0.06), 0 1px 3px rgba(30, 27, 75, 0.09)',
    /** Level 3 — the thing being interacted with. */
    raised: isDark
      ? '0 4px 12px rgba(0, 0, 0, 0.5)'
      : '0 2px 6px rgba(30, 27, 75, 0.10), 0 1px 2px rgba(30, 27, 75, 0.06)',
    /** The floating action button — brand-tinted, level 3. */
    brand: isDark ? `0 6px 18px ${colors.accentShadow}` : `0 6px 16px ${colors.accentShadow}`,
  } as const;
}
