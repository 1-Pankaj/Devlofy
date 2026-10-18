/**
 * Persisted user settings. Storage resolves per platform via Metro
 * (expo-sqlite/kv-store on native, localStorage on web) — see `@/lib/storage`.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kv } from '@/lib/storage';

export type ThemeMode = 'system' | 'dark' | 'light';
export type DesktopMode = 'auto' | 'always' | 'never';

/** The day's focus target, in minutes. Drives the Today ring and "to go". */
export const GOAL_OPTIONS = [60, 90, 120, 180] as const;
export type DailyGoal = (typeof GOAL_OPTIONS)[number];

type SettingsState = {
  themeMode: ThemeMode;
  desktopMode: DesktopMode;
  userName: string;
  dailyGoalMinutes: number;
  /** Project the next focus session is attributed to. */
  focusProjectId: string | null;
  setThemeMode: (mode: ThemeMode) => void;
  setDesktopMode: (mode: DesktopMode) => void;
  setUserName: (name: string) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setFocusProjectId: (projectId: string | null) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      desktopMode: 'auto',
      userName: 'Developer',
      dailyGoalMinutes: 120,
      focusProjectId: null,
      setThemeMode: (themeMode) => set({ themeMode }),
      setDesktopMode: (desktopMode) => set({ desktopMode }),
      setUserName: (userName) => set({ userName }),
      setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
      setFocusProjectId: (focusProjectId) => set({ focusProjectId }),
    }),
    {
      name: 'devlofy.settings.v1',
      storage: createJSONStorage(() => kv),
    },
  ),
);
