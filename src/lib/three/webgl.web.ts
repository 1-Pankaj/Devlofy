/**
 * Web WebGL probe — one throwaway context, released immediately, result cached.
 * Covers browsers with hardware acceleration disabled, locked-down webviews and
 * anywhere else the GPU is unavailable.
 */
let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;

  if (typeof document === 'undefined') {
    cached = false;
    return cached;
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    cached = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }

  return cached;
}
