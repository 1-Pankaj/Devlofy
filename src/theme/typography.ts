/**
 * Typography — one grotesque, one mono, and a tight vertical rhythm.
 *
 * Geist still does the talking; JetBrains Mono is promoted from "code only" to
 * **the voice of metadata** — counters, labels, versions, timers, short hashes.
 * That split is what makes the interface read as an instrument: prose is Geist,
 * everything measured is mono.
 *
 * The scale is flatter than the register it replaced. A screen title is 31px,
 * not 34, and section headings are 17px, not 19 — hierarchy comes from weight,
 * colour and the mono label above a heading rather than from four display sizes.
 *
 * Static font files are loaded per weight, so the family name carries the weight
 * and styles never set `fontWeight`.
 */
import type { TextStyle } from 'react-native';

export const fonts = {
  bodyRegular: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemibold: 'Geist_600SemiBold',
  bodyBold: 'Geist_700Bold',

  displaySemibold: 'Geist_600SemiBold',

  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemibold: 'JetBrainsMono_600SemiBold',
} as const;

/** Named text styles — components never touch raw fontSize. */
export const typeScale = {
  /** Screen titles. Tight and confident. */
  display: {
    fontFamily: fonts.bodySemibold,
    fontSize: 31,
    lineHeight: 36,
    letterSpacing: -0.9,
  },
  /** Large statements inside a container. */
  title: {
    fontFamily: fonts.bodySemibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  /** Card and section titles. */
  headline: {
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
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
    lineHeight: 22,
  },
  subheadMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  captionMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  /** Numeric metadata — tabular figures in the body face. */
  mono: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  /** Machine truth: code, timers, versions, hashes. */
  code: {
    fontFamily: fonts.monoRegular,
    fontSize: 12.5,
    lineHeight: 18,
  },
  /** The micro-label above a section: mono, tracked, uppercase. */
  monoLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  /** The live timer. Mono, tabular, and wide enough that digits do not jitter. */
  timer: {
    fontFamily: fonts.monoMedium,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  /** Big stat numbers. */
  numberXl: {
    fontFamily: fonts.bodySemibold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
  },
  numberLg: {
    fontFamily: fonts.bodySemibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  /**
   * The phone size of a stat. Three figures with a currency symbol have to share
   * a 390px row; 28px is where "₹6,667" used to break in half.
   */
  numberMd: {
    fontFamily: fonts.bodySemibold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof typeScale;
