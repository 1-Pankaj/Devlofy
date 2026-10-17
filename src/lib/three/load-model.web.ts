/**
 * Web GLB loading: the asset module resolves to a served URL, which three's
 * GLTFLoader fetches like any other resource.
 */
import { Asset } from 'expo-asset';
import type { Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { GltfAssetModule } from './load-model';

export async function loadGltf(module: GltfAssetModule): Promise<Group> {
  const uri = Asset.fromModule(module).uri;
  const gltf = await new GLTFLoader().loadAsync(uri);
  return gltf.scene as Group;
}
