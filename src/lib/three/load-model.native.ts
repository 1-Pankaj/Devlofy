/**
 * Native GLB loading: expo-asset resolves the module to a local file, the new
 * expo-file-system API reads raw bytes, and three parses them in memory.
 * (three's FileLoader cannot fetch file:// URLs on native.)
 *
 * The polyfill import is load-bearing: GLTFLoader pulls `three`, whose CJS
 * build calls `process.emitWarning` on Hermes — see ./polyfill.ts.
 */
import './polyfill';

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { GltfAssetModule } from './load-model';

function parseGlb(buffer: ArrayBuffer): Promise<Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer,
      '',
      (gltf) => resolve(gltf.scene as Group),
      (error) => reject(error),
    );
  });
}

export async function loadGltf(module: GltfAssetModule): Promise<Group> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const bytes = await new File(uri).bytes();
  return parseGlb(bytes.buffer);
}
