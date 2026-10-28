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

/**
 * Which destination owns a pathname.
 *
 * Detail routes belong to the tab that opened them — a project is Work, a note
 * is Notes, and the three shelf destinations are More — so the rail always says
 * where you are instead of going blank on every pushed screen.
 */
export function activeNavPath(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/') return '/';

  const rules: [prefixes: string[], target: string][] = [
    [['/garden'], '/garden'],
    [['/work', '/project', '/client', '/invoice', '/github'], '/work'],
    [['/notes', '/note'], '/notes'],
    [['/more', '/bench', '/sentinel'], '/more'],
  ];

  for (const [prefixes, target] of rules) {
    if (prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return target;
  }
  return null;
}
