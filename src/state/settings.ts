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

/**
 * Money is shown with a symbol the user picks — the app has no idea what
 * currency their clients pay in, and guessing would be worse than asking once.
 */
export const CURRENCY_OPTIONS = ['₹', '$', '€', '£'] as const;

type SettingsState = {
  themeMode: ThemeMode;
  desktopMode: DesktopMode;
  userName: string;
  dailyGoalMinutes: number;
  /** Prefix for every amount on the invoice screen. */
  currency: string;
  /** Project the next focus session is attributed to. */
  focusProjectId: string | null;
  setThemeMode: (mode: ThemeMode) => void;
  setDesktopMode: (mode: DesktopMode) => void;
  setUserName: (name: string) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setCurrency: (symbol: string) => void;
  setFocusProjectId: (projectId: string | null) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      desktopMode: 'auto',
      userName: 'Developer',
      dailyGoalMinutes: 120,
      currency: '₹',
      focusProjectId: null,
      setThemeMode: (themeMode) => set({ themeMode }),
      setDesktopMode: (desktopMode) => set({ desktopMode }),
      setUserName: (userName) => set({ userName }),
      setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
      setCurrency: (currency) => set({ currency }),
      setFocusProjectId: (focusProjectId) => set({ focusProjectId }),
    }),
    {
      name: 'devlofy.settings.v1',
      storage: createJSONStorage(() => kv),
    },
  ),
);
