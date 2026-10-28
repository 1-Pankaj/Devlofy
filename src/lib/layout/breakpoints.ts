/**
 * Window size classes: compact < 600, medium 600–839, expanded ≥ 840.
 * `useDesktopMode` resolves the user setting ("auto" follows the breakpoint) and
 * gates the side-rail shell — tablets, desktop-class Android, and wide web.
 */
import { useWindowDimensions } from 'react-native';

import { useSettings } from '@/state/settings';

export type Breakpoint = 'compact' | 'medium' | 'expanded';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= 840) return 'expanded';
  if (width >= 600) return 'medium';
  return 'compact';
}

export function useDesktopMode(): boolean {
  const breakpoint = useBreakpoint();
  const desktopMode = useSettings((s) => s.desktopMode);
  if (desktopMode === 'always') return true;
  if (desktopMode === 'never') return false;
  return breakpoint === 'expanded';
}
