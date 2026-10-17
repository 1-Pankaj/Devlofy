/**
 * Persisted user settings. Storage resolves per platform via Metro
 * (expo-sqlite/kv-store on native, localStorage on web) — see `@/lib/storage`.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kv } from '@/lib/storage';

export type ThemeMode = 'system' | 'dark' | 'light';
export type DesktopMode = 'auto' | 'always' | 'never';

type SettingsState = {
  themeMode: ThemeMode;
  desktopMode: DesktopMode;
  userName: string;
  setThemeMode: (mode: ThemeMode) => void;
  setDesktopMode: (mode: DesktopMode) => void;
  setUserName: (name: string) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      desktopMode: 'auto',
      userName: 'Developer',
      setThemeMode: (themeMode) => set({ themeMode }),
      setDesktopMode: (desktopMode) => set({ desktopMode }),
      setUserName: (userName) => set({ userName }),
    }),
    {
      name: 'devlofy.settings.v1',
      storage: createJSONStorage(() => kv),
    },
  ),
);
