/**
 * Shared navigation metadata — one source for tab bar and desktop rail.
 */
import {
  GearSix,
  Notebook,
  Plant,
  Sun,
  Briefcase,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType } from 'react';

export type NavItem = {
  /** Route path used by the desktop rail. */
  path: string;
  /** Route name used by the tab navigator. */
  name: string;
  label: string;
  icon: ComponentType<IconProps>;
};

export const NAV_ITEMS: NavItem[] = [
  { path: '/', name: 'index', label: 'Today', icon: Sun },
  { path: '/garden', name: 'garden', label: 'Garden', icon: Plant },
  { path: '/work', name: 'work', label: 'Work', icon: Briefcase },
  { path: '/notes', name: 'notes', label: 'Notes', icon: Notebook },
  { path: '/more', name: 'more', label: 'More', icon: GearSix },
];

export function navItemForRoute(name: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.name === name);
}
