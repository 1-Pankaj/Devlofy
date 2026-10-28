/**
 * Devlofy palette — Primer-grade neutrals, Devlofy violet.
 *
 * The old scheme was Material 3: a lavender canvas tinted by the brand, and
 * cards that read as raised because they sat a tone lighter than the page. This
 * one is the opposite discipline, borrowed from the language of developer
 * tools — the website's language, not GitHub's identity:
 *
 *   - a **neutral** canvas (#F6F6F8) that the brand never tints;
 *   - **white surfaces held by a 1px hairline**, not by elevation;
 *   - near-black ink, a muted secondary, and one quiet tertiary for metadata;
 *   - **one** brand hue — the violet of the app icon — and two reserved
 *     meanings: amber for time, red for failure.
 *
 * Nothing here copies GitHub's values (no #f6f8fa, no #0969da, no #1a7f37) and
 * no GitHub mark is used: the shape of the interface is "tool", the colour is
 * Devlofy's own.
 */

export type ColorScheme = 'dark' | 'light';

export type ThemeColors = {
  /** Canvas. Neutral, never tinted by the brand. */
  background: string;
  /** Cards and sheets — white, held by a hairline. */
  surface: string;
  /** Interactive fills and wells inside a card (chips, avatars, inputs). */
  surfaceElevated: string;
  /** Recessed tracks: progress troughs, insets, segmented rails. */
  surfaceSunken: string;
  /**
   * The plate that travels under the selected option of a segmented control.
   * Its own token because it must sit **above** the rail in both schemes, and
   * the neutral ladder is only eight levels a step: `surface` is not the raised
   * plane when the page is near-black.
   */
  controlThumb: string;
  /** Dividers between rows. */
  hairline: string;
  /** Stronger separators and control outlines. */
  hairlineStrong: string;

  text: string;
  textSecondary: string;
  textTertiary: string;

  /** The brand: active navigation, the one primary action, progress. */
  accent: string;
  /** Soft brand fill — the icon well, a selected row, a focus ring. */
  accentSoft: string;
  /** The brand at outline strength. */
  accentBorder: string;
  /** Content sitting *on* `accent` (a solid brand fill). */
  accentContrast: string;
  /** Brand-tinted shadow. */
  accentShadow: string;

  /** Focus and time. Warm amber, the palette's second hue. */
  ember: string;
  /** Soft amber fill. */
  emberSoft: string;

  info: string;
  infoSoft: string;
  danger: string;
  dangerSoft: string;

  scrim: string;
};

const light: ThemeColors = {
  background: '#F6F6F8',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F1F4',
  surfaceSunken: '#E9E9EE',
  controlThumb: '#FFFFFF',
  hairline: '#E4E4EA',
  hairlineStrong: '#CFCFD8',

  text: '#15151A',
  textSecondary: '#4B4B57',
  textTertiary: '#797985',

  accent: '#5B3DF5',
  accentSoft: '#EFEBFF',
  accentBorder: '#CFC4FF',
  accentContrast: '#FFFFFF',
  accentShadow: 'rgba(91, 61, 245, 0.22)',

  ember: '#8F5A06',
  emberSoft: '#FDF0DA',

  info: '#0B5FA5',
  infoSoft: '#E3F0FB',
  danger: '#C0322A',
  dangerSoft: '#FDECE9',

  scrim: 'rgba(17, 17, 22, 0.44)',
};

const dark: ThemeColors = {
  background: '#0C0C10',
  surface: '#141419',
  surfaceElevated: '#1C1C23',
  surfaceSunken: '#24242C',
  controlThumb: '#2E2E38',
  hairline: '#26262F',
  hairlineStrong: '#3A3A46',

  text: '#ECECF1',
  textSecondary: '#B7B7C2',
  textTertiary: '#85858F',

  accent: '#A794FF',
  accentSoft: '#241D4D',
  accentBorder: '#40357A',
  accentContrast: '#120C33',
  accentShadow: 'rgba(0, 0, 0, 0.55)',

  ember: '#F0B45E',
  emberSoft: '#33240D',

  info: '#7FB8E8',
  infoSoft: '#12293D',
  danger: '#FF8A80',
  dangerSoft: '#3D1512',

  scrim: 'rgba(0, 0, 0, 0.62)',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
