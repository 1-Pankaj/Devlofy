/**
 * Cross-platform three.js / React Three Fiber facade — the type anchor.
 *
 * Metro resolves per platform:
 *  - `index.native.ts` → `@react-three/fiber/native` (expo-gl renderer)
 *  - `index.web.ts`    → `@react-three/fiber`        (DOM/WebGL renderer)
 *
 * Scene code imports `{ Canvas, useFrame, THREE }` from `@/lib/three` once and
 * runs unchanged on both runtimes. Types for three classes come straight from
 * `import type { ... } from 'three'` (erased at runtime, so it never affects
 * the polyfill-before-three evaluation order).
 */
import * as THREE from 'three';

export { THREE };
export * from '@react-three/fiber';
