/**
 * Devlofy palette — Material 3 tonal roles.
 *
 * The scheme is built the way Material 3 builds one: a **primary** hue that
 * tints the whole neutral ramp, plus a **tertiary** hue reserved for one
 * meaning. Surfaces are tonal containers, not borders — a card reads as raised
 * because it sits a step lighter (light theme) or lighter-and-warmer (dark
 * theme) than the canvas, never because it has a 1px outline.
 *
 *   primary    indigo   — the brand: navigation, primary action, progress
 *   tertiary   amber    — time and focus: a running session, the timer
 *   error      red      — destructive and failure only
 *
 * Every value is a token. Components read them from `useTheme()`; nothing
 * hardcodes a colour.
 */

export type ColorScheme = 'dark' | 'light';

export type ThemeColors = {
  /** Canvas. The lowest tonal step. */
  background: string;
  /** Cards and sheets — one step above the canvas. */
  surface: string;
  /** Interactive fills and wells inside a card (chips, avatars, inputs). */
  surfaceElevated: string;
  /** Recessed tracks: segmented rails, progress troughs, insets. */
  surfaceSunken: string;
  /** Dividers between rows. */
  hairline: string;
  /** Stronger separators and control outlines. */
  hairlineStrong: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  /** The brand: active navigation, the one primary action, progress. */
  accent: string;
  /** Primary container — the soft brand fill (FAB, hero, icon wells). */
  accentSoft: string;
  /** The brand at outline strength. */
  accentBorder: string;
  /** Content sitting *on* `accent` (a solid brand fill). */
  accentContrast: string;
  /** Brand-tinted shadow. Shadows carry the hue of what casts them. */
  accentShadow: string;

  /** Focus and time. Warm amber, the palette's second hue. */
  ember: string;
  /** Tertiary container — the soft amber fill. */
  emberSoft: string;

  info: string;
  infoSoft: string;
  danger: string;
  dangerSoft: string;

  scrim: string;
};

const light: ThemeColors = {
  background: '#F5F2FB',
  surface: '#FFFFFF',
  surfaceElevated: '#EAE8F1',
  surfaceSunken: '#E4E1EB',
  hairline: '#E7E4EF',
  hairlineStrong: '#C6C5D0',

  text: '#1B1B22',
  textSecondary: '#46464F',
  textTertiary: '#767680',

  accent: '#4B5AA0',
  accentSoft: '#DFE0FF',
  accentBorder: '#B3B7E8',
  accentContrast: '#FFFFFF',
  accentShadow: 'rgba(75, 90, 160, 0.26)',

  ember: '#A85A08',
  emberSoft: '#FFDDB8',

  info: '#31628F',
  infoSoft: '#D6E4F7',
  danger: '#BA1A1A',
  dangerSoft: '#FFDAD6',

  scrim: 'rgba(27, 27, 34, 0.45)',
};

const dark: ThemeColors = {
  background: '#131318',
  surface: '#1F1F26',
  surfaceElevated: '#2A2931',
  surfaceSunken: '#35343D',
  hairline: '#2E2D35',
  hairlineStrong: '#46464F',

  text: '#E5E1EA',
  textSecondary: '#C6C5D0',
  textTertiary: '#90909A',

  accent: '#BCC2FF',
  accentSoft: '#33418A',
  accentBorder: '#5A66AE',
  accentContrast: '#16267B',
  accentShadow: 'rgba(0, 0, 0, 0.5)',

  ember: '#FFB870',
  emberSoft: '#6B3C00',

  info: '#A8CAF0',
  infoSoft: '#2A4257',
  danger: '#FFB4AB',
  dangerSoft: '#6E2420',

  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
