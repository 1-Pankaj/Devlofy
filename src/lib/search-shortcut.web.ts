/**
 * Cmd/Ctrl-K opens search on web — the one keyboard affordance a developer
 * expects in an app like this, and it costs nothing when a keyboard is absent.
 *
 * The cap must name the key the user actually has: a Windows or Linux browser
 * has no ⌘, so it shows `Ctrl K` there. `navigator.platform` is deprecated in
 * favour of `userAgentData`, which Safari and Firefox do not expose yet — the
 * user agent is the one string every browser still answers.
 */
import { useEffect } from 'react';

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent);

export const searchShortcutLabel = isApple ? '⌘K' : 'Ctrl K';

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
