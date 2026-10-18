/**
 * Motion tokens.
 *
 * The system is **precise**: motion states a change, then stops. Nothing
 * overshoots and nothing wobbles, so there is no spring anywhere in this app and
 * no `springify()` — every transition is a duration against a strong curve.
 *
 * Curves come from the expo-animation skill tables — never `linear`, never a
 * bare default.
 */
import { Easing } from 'react-native-reanimated';

export const duration = {
  /** Press feedback. */
  press: 110,
  /** Small state change: toggle, chip, indicator. */
  fast: 160,
  /** Standard enter/exit of in-flow elements. */
  base: 220,
  /** Values that travel: rings, counters, growing bars. */
  slow: 320,
  /** Page-level choreography: the first paint of a screen. */
  page: 460,
} as const;

export const easing = {
  /** Entering/exiting — strong ease-out (quint). */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** Material 3 emphasised — slow to leave, slower to arrive. */
  emphasized: Easing.bezier(0.2, 0, 0, 1),
} as const;
