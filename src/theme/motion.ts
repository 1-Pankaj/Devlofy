/**
 * Motion tokens. Curves and spring configs come from the expo-animation skill
 * tables — never `linear`, never `ease-in`, never a raw default spring.
 */
import { Easing } from 'react-native-reanimated';

export const duration = {
  /** Press feedback. */
  press: 120,
  /** Small state change: toggle, chip, indicator. */
  fast: 180,
  /** Standard enter/exit of in-flow elements. */
  base: 240,
  /** Large surfaces: sheets, big entrances. */
  slow: 420,
} as const;

export const easing = {
  /** Entering/exiting — strong ease-out. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** On-screen movement — ease-in-out. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  /** iOS sheet curve. */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/** Apple-style spring params (duration + dampingRatio), Reanimated 4 form. */
export const spring = {
  /** Default settle, no overshoot. */
  settle: { duration: 400, dampingRatio: 1 },
  /** Reposition / snap back after touch. */
  snappy: { duration: 300, dampingRatio: 0.85 },
  /** Momentum was carried — allowed to overshoot slightly. */
  bouncy: { duration: 380, dampingRatio: 0.7 },
} as const;
