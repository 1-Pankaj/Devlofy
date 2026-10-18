/**
 * Typography for Devlofy.
 *
 * One voice does the work: **Geist**. Hierarchy comes from weight and size, not
 * from switching typefaces. The scale follows Material 3's shape: a confident
 * display for screen titles, a clear title for statements inside a container,
 * and one quiet label style. JetBrains Mono survives only where text really is
 * machine output.
 *
 * Static font files are loaded per weight, so the family name carries the
 * weight and styles never set `fontWeight`.
 */
import type { TextStyle } from 'react-native';

export const fonts = {
  bodyRegular: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemibold: 'Geist_600SemiBold',
  bodyBold: 'Geist_700Bold',

  /** Display rides the same grotesque — only the weight changes. */
  displayMedium: 'Geist_500Medium',
  displaySemibold: 'Geist_600SemiBold',
  displayBold: 'Geist_700Bold',

  /** Machine truth only: code, timers, tabular figures. */
  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Named text styles — components never touch raw fontSize. */
export const typeScale = {
  /** Screen titles. Large, tight, and confident — this is the app's voice. */
  display: {
    fontFamily: fonts.bodyBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
  },
  /** Large statements inside a container. */
  title: {
    fontFamily: fonts.bodySemibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  /** Card and section titles. */
  headline: {
    fontFamily: fonts.bodySemibold,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.25,
  },
  body: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  subhead: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 21,
  },
  subheadMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  captionMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Numeric metadata — tabular figures, no monospace voice. */
  mono: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  /** Small tracked section label. */
  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  /** Big stat numbers. */
  numberXl: {
    fontFamily: fonts.bodyBold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
  },
  numberLg: {
    fontFamily: fonts.bodyBold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typeScale;
