/**
 * Motion tokens.
 *
 * The system is **precise**: motion states a change, then stops. Nothing
 * overshoots and nothing wobbles, so there is no spring anywhere in this app and
 * no `springify()` — every transition is a duration against a strong curve.
 *
 * Redesign note: the durations are shorter and the differences between them are
 * wider than before. Fast feedback is 90ms, travel is 300ms, a page arrives in
 * 420ms — so a tap answers instantly while a whole screen still has time to
 * choreograph. The two curves are unchanged on purpose: one to arrive, one to
 * leave.
 */
import { Easing } from 'react-native-reanimated';

export const duration = {
  /** Press feedback. */
  press: 90,
  /** Small state change: toggle, chip, indicator. */
  fast: 140,
  /** Standard enter/exit of in-flow elements. */
  base: 200,
  /** Values that travel: rings, counters, growing bars. */
  slow: 300,
  /** Page-level choreography: the first paint of a screen. */
  page: 420,
  /** A scene change: a sheet, a big surface replacing another. */
  scene: 520,
} as const;

export const easing = {
  /** Entering/exiting — strong ease-out (quint). */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** Emphasised — slow to leave, slower to arrive. */
  emphasized: Easing.bezier(0.2, 0, 0, 1),
} as const;
