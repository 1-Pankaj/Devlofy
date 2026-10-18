/**
 * Shape scale — Material 3.
 *
 * Radii are deliberately *varied*: tight on small elements, generous on the
 * containers that hold them, so nesting reads as concentric curves rather than
 * one uniform rounding everywhere.
 */
export const radius = {
  /** Hairline bars, tiny indicators. */
  xs: 4,
  /** Small controls, rail rows. */
  sm: 8,
  /** Inputs, list wells, inner elements. */
  md: 12,
  /** Cards, containers. */
  lg: 16,
  /** Hero surfaces, sheets, the large statement blocks. */
  xl: 28,
  /** Pills: buttons, chips, the FAB. */
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;
