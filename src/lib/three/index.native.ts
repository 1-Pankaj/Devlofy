/**
 * Native facade: the polyfill must evaluate before `three` (whose CommonJS
 * build calls `process.emitWarning` on Hermes — see ./polyfill.ts), and both
 * before the expo-gl renderer. Import order below is load-bearing.
 */
import './polyfill';

import * as THREE from 'three';

export { THREE };
export * from '@react-three/fiber/native';
