/**
 * Shape scale — small, deliberate, engineered.
 *
 * Containers are nearly rectangular. A 6px radius on a card and an 8px radius on
 * the surface that holds it is what makes a tool look *drawn* rather than
 * inflated; the old 16/28px radii are what made it look like a Material app.
 *
 * `full` still exists for pills and chips — but it is now the exception, used
 * for a status tag or a truncated avatar, never for a button or a panel.
 */
export const radius = {
  /** Hairline bars, tags, tiny indicators. */
  xs: 3,
  /** Small controls, inline chips. */
  sm: 4,
  /** Inputs, list wells, buttons, icon wells. */
  md: 6,
  /** Cards, containers, the action button. */
  lg: 8,
  /** Hero surfaces, sheets, the large statement blocks. */
  xl: 12,
  /** Pills: status tags, avatars, the running-session dot. */
  full: 999,
} as const;

export type RadiusToken = keyof typeof radius;
