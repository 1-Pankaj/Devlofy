import * as SystemUI from 'expo-system-ui';
import { createContext, use, useEffect, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/state/settings';
import { palettes, type ColorScheme, type ThemeColors } from './colors';

type ThemeContextValue = {
  colors: ThemeColors;
  scheme: ColorScheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const themeMode = useSettings((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;
  const colors = palettes[scheme];

  useEffect(() => {
    if (process.env.EXPO_OS !== 'web') {
      SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
    }
  }, [colors.background]);

  const value = useMemo(() => ({ colors, scheme }), [colors, scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside AppThemeProvider');
  }
  return value;
}
