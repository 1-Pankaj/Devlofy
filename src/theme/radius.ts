/**
 * Radii are oversized squircle-leaning values (`borderCurve: 'continuous'` on
 * every non-capsule corner). The `bezel` pair keeps the Double-Bezel card
 * concentric: inner = outer - shell padding (see `Panel`).
 */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
