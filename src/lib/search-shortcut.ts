/**
 * Platform anchor for the search keyboard shortcut. Native has no global key
 * handler, so this is deliberately a no-op — the shortcut is a web/desktop
 * affordance, exactly like `useHover`. See `search-shortcut.web.ts`.
 */
export function useSearchShortcut(_onTrigger: () => void): void {}
