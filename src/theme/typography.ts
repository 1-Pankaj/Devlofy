/**
 * Typography for Devlofy.
 *
 * Three voices:
 *  - `geist`    — UI body & labels (precise, neutral grotesque)
 *  - `grotesk`  — display: titles, big numbers, the brand voice
 *  - `mono`     — machine truth: metadata, eyebrows, timers, counts
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

  displayMedium: 'SpaceGrotesk_500Medium',
  displaySemibold: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',

  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/** Named text styles — components never touch raw fontSize. */
export const typeScale = {
  display: {
    fontFamily: fonts.displaySemibold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: fonts.displaySemibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  headline: {
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    lineHeight: 24,
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
    fontSize: 14,
    lineHeight: 20,
  },
  subheadMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  captionMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Machine metadata. */
  mono: {
    fontFamily: fonts.monoRegular,
    fontSize: 12.5,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  /** Uppercase micro-label ("FOCUS · 42M"). */
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  /** Big stat numbers. */
  numberXl: {
    fontFamily: fonts.displaySemibold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  numberLg: {
    fontFamily: fonts.displaySemibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typeScale;
