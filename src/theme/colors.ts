/**
 * Devlofy palette — "Ink & Sprout".
 *
 * Dark is the canonical surface: OLED-grade ink with a green undertone and a
 * single living accent (sprout) that carries the growth/garden metaphor. Ember
 * is reserved for focus/time moments. Light is the same system on paper.
 *
 * Never hardcode these values outside `src/theme`. Components read them from
 * `useTheme()`.
 */

export type ColorScheme = 'dark' | 'light';

export type ThemeColors = {
  /** App background — near-black with a green undertone. */
  background: string;
  /** Default panel core. */
  surface: string;
  /** Elevated surfaces (list rows, pills, inputs). */
  surfaceElevated: string;
  /** Recessed wells (bezel outer shells, insets). */
  surfaceSunken: string;
  /** Hairlines. */
  hairline: string;
  hairlineStrong: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  /** The living accent. Used sparingly: active nav, key actions, growth. */
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentContrast: string;

  /** Focus / time / warmth. */
  ember: string;
  emberSoft: string;

  info: string;
  infoSoft: string;
  danger: string;
  dangerSoft: string;

  /** Ambient radial glows behind screen content. */
  glowA: string;
  glowB: string;

  scrim: string;
};

const dark: ThemeColors = {
  /** App background — near-black with a green undertone. */
  background: '#070A08',
  /** Default panel core. */
  surface: '#0D1210',
  /** Elevated surfaces (list rows, pills, inputs). */
  surfaceElevated: '#131A17',
  /** Recessed wells (bezel outer shells, insets). */
  surfaceSunken: '#050806',
  /** Hairlines. */
  hairline: 'rgba(233, 255, 244, 0.08)',
  hairlineStrong: 'rgba(233, 255, 244, 0.16)',

  text: '#EAF3EE',
  textSecondary: '#A3B0A9',
  textTertiary: '#6E7A73',

  /** The living accent. Used sparingly: active nav, key actions, growth. */
  accent: '#3EE08F',
  accentSoft: 'rgba(62, 224, 143, 0.14)',
  accentBorder: 'rgba(62, 224, 143, 0.32)',
  accentContrast: '#052012',

  /** Focus / time / warmth. */
  ember: '#FFB25E',
  emberSoft: 'rgba(255, 178, 94, 0.14)',

  info: '#7CC4FF',
  infoSoft: 'rgba(124, 196, 255, 0.14)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',

  /** Ambient radial glows behind screen content. */
  glowA: 'rgba(62, 224, 143, 0.22)',
  glowB: 'rgba(124, 196, 255, 0.10)',

  scrim: 'rgba(3, 5, 4, 0.72)',
};

const light: ThemeColors = {
  background: '#F3F5F1',
  surface: '#FBFCFA',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#E9EDE7',
  hairline: 'rgba(12, 20, 15, 0.08)',
  hairlineStrong: 'rgba(12, 20, 15, 0.16)',

  text: '#0E1410',
  textSecondary: '#5A655E',
  textTertiary: '#8A948D',

  accent: '#0EA86B',
  accentSoft: 'rgba(14, 168, 107, 0.12)',
  accentBorder: 'rgba(14, 168, 107, 0.30)',
  accentContrast: '#FFFFFF',

  ember: '#D9822B',
  emberSoft: 'rgba(217, 130, 43, 0.14)',

  info: '#2F7FD1',
  infoSoft: 'rgba(47, 127, 209, 0.12)',
  danger: '#D64545',
  dangerSoft: 'rgba(214, 69, 69, 0.10)',

  glowA: 'rgba(14, 168, 107, 0.14)',
  glowB: 'rgba(47, 127, 209, 0.08)',

  scrim: 'rgba(15, 20, 16, 0.40)',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
