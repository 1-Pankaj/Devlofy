/**
 * Cmd/Ctrl-K opens search on web — the one keyboard affordance a developer
 * expects in an app like this, and it costs nothing when a keyboard is absent.
 */
import { useEffect } from 'react';

export function useSearchShortcut(onTrigger: () => void): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      onTrigger();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onTrigger]);
}
