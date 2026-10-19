/**
 * LatencyChart — the shape of a target's last checks, as bars.
 *
 * Bars rather than a line, deliberately: a response time has a hard floor at
 * zero, and a failed check *is* that floor — no answer arrived. A bar chart shows
 * a dip to nothing, which is what happened; a line would draw a slope through a
 * point that was never measured.
 *
 * Colour is the board's vocabulary, not decoration: `accent` answered fine,
 * `ember` answered slowly (the app's time colour), `danger` never answered. The
 * counts and figures sit in text beside the chart, so the chart is decorative and
 * is hidden from assistive tech.
 *
 * Two scaling rules make the strip readable at any age (both explained at the
 * constants): bars are measured against a fixed 250 ms reference so a fast target
 * reads calm instead of filling the card, and the strip is laid out against a
 * fixed number of slots from the left, so a young history *fills in* as it
 * accumulates (time reads left to right) instead of one check stretching across
 * the card.
 *
 * Drawn in a normalised 100-unit viewBox with `preserveAspectRatio="none"`, so it
 * fills whatever width its card has. That is why every mark is a rectangle — a
 * scaled stroke would lie about its own thickness.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { CheckLike } from '@/lib/sentinel/status';
import { spacing, useTheme } from '@/theme';

const VIEW_HEIGHT = 100;
const BAR_WIDTH = 1.6;
const STEP = 3;
/** A fast answer still needs a visible bar, or the chart looks broken. */
const MIN_BAR = 6;
/** A failure is a short block at the floor: no answer, no height. */
const FAILURE_HEIGHT = 10;
/**
 * Bars are scaled against a *reference*, not against the window's own peak, for
 * two reasons: a lone fast check should not draw a full-height bar (peak-of-one
 * means nothing), and two targets should be comparable at a glance — a 40 ms
 * server reads calm next to a 600 ms one instead of both filling the card.
 * Anything slower than the reference clips to full height, which is the point.
 */
const REFERENCE_MS = 250;
/**
 * How many checks the strip is wide. Bars are laid out against this capacity
 * from the left, so a young history grows into the space rather than one check
 * stretching across the whole card.
 */
const SLOTS = 30;

export type LatencyChartProps = {
  /** Oldest first. */
  checks: CheckLike[];
  height?: number;
};

export function LatencyChart({ checks, height = 36 }: LatencyChartProps) {
  const { colors } = useTheme();

  // A target with no checks gets no strip: an empty track is noise, and the
  // caption underneath already says it has not been checked.
  if (checks.length === 0) return null;

  const shown = checks.slice(-SLOTS);
  const peak = Math.max(...shown.map((check) => check.ms), REFERENCE_MS);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { height, borderBottomColor: colors.hairline }]}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${SLOTS * STEP} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none">
        {shown.map((check, index) => {
          const failed = check.verdict === 'down';
          const scaled = MIN_BAR + (check.ms / peak) * (VIEW_HEIGHT - MIN_BAR);
          const barHeight = failed ? FAILURE_HEIGHT : scaled;
          const fill = failed
            ? colors.danger
            : check.verdict === 'slow'
              ? colors.ember
              : colors.accent;
          return (
            <Rect
              key={index}
              x={index * STEP}
              y={VIEW_HEIGHT - barHeight}
              width={BAR_WIDTH}
              height={barHeight}
              fill={fill}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderBottomWidth: 1,
    marginTop: spacing.sm,
  },
});
