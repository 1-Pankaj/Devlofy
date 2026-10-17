import Storage from 'expo-sqlite/kv-store';

import type { KVStorage } from './storage';

export const kv: KVStorage = Storage;
