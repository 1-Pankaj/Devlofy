/**
 * WebGL capability probe.
 *
 * The garden is the only thing in the app that needs a GPU context, and when a
 * platform cannot give one the scene must degrade to a still — not take the
 * whole app down with it. Native always reports true: expo-gl ships with the
 * build, so the only real question is the browser.
 *
 * Web resolves the real probe in `webgl.web.ts`.
 */
export function hasWebGL(): boolean {
  return true;
}
