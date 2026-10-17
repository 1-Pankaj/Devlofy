/**
 * GLB loading — the type anchor.
 *
 * Metro resolves the platform implementation:
 *  - `load-model.native.ts` → expo-asset + expo-file-system bytes + parse
 *  - `load-model.web.ts`    → expo-asset URL + GLTFLoader
 *
 * Neither the core nor this file ever imports platform-only libraries.
 */
import type { Group } from 'three';

/** Numeric asset id (native) or bundled URL (web). */
export type GltfAssetModule = number | string;

/** Loads a self-contained GLB and resolves its scene graph. */
export declare function loadGltf(module: GltfAssetModule): Promise<Group>;
