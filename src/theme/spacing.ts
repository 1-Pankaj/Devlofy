/**
 * One 4-point grid. Screen edge padding is `xl` (20) everywhere; a layout that
 * needs an in-between value uses the nearest step or gets a named step here.
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
  xxxl: 48,
} as const;

export type SpacingToken = keyof typeof spacing;
