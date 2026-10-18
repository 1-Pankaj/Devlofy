/**
 * Motion tokens.
 *
 * The system is **precise**: motion states a change, then stops. Nothing
 * overshoots and nothing wobbles, so there is no spring with a damping ratio
 * below 1 anywhere in this app and no `springify()`. Where a value has to
 * settle we use a critically damped spring; where a duration is enough, a
 * strong ease-out curve.
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
  /** On-screen movement — symmetric ease-in-out. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Material 3 emphasised — slow to leave, slower to arrive. */
  emphasized: Easing.bezier(0.2, 0, 0, 1),
  /** iOS sheet curve. */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
} as const;

/**
 * Springs are used only where a physical settle reads better than a curve, and
 * they are **critically damped** (`dampingRatio: 1`) — the fastest arrival with
 * no overshoot.
 */
export const spring = {
  /** Default settle: no overshoot ever. */
  settle: { duration: 300, dampingRatio: 1 },
  /** Quick settle for position changes under the finger. */
  precise: { duration: 220, dampingRatio: 1 },
} as const;
