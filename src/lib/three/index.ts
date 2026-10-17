/**
 * Cross-platform three.js / React Three Fiber facade.
 *
 * Metro resolves per platform:
 *  - `index.native.ts` → `@react-three/fiber/native` (expo-gl renderer)
 *  - `index.web.ts`    → `@react-three/fiber`        (DOM/WebGL renderer)
 *
 * Scene code imports `{ Canvas, useFrame, ... }` from `@/lib/three` once and
 * runs unchanged on both runtimes.
 */
export * from '@react-three/fiber';
