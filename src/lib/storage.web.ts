import type { KVStorage } from './storage';

const hasWindow = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const memory = new Map<string, string>();

export const kv: KVStorage = hasWindow
  ? {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => {
        window.localStorage.setItem(key, value);
      },
      removeItem: async (key) => {
        window.localStorage.removeItem(key);
      },
    }
  : {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => {
        memory.set(key, value);
      },
      removeItem: async (key) => {
        memory.delete(key);
      },
    };
