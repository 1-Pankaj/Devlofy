/**
 * KV storage facade. Metro picks the platform file:
 *  - `storage.native.ts` — expo-sqlite/kv-store (SQLite-backed, sync + async)
 *  - `storage.web.ts`    — window.localStorage
 * This base file is only a type anchor and in-memory fallback.
 */

export type KVStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory = new Map<string, string>();

export const kv: KVStorage = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => {
    memory.set(key, value);
  },
  removeItem: async (key) => {
    memory.delete(key);
  },
};
