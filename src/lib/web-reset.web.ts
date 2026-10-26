/**
 * Web-only document tweaks (see `web-reset.ts` for the why).
 *
 * Injected once at boot, from the root layout, so the dev server and the
 * exported bundle apply the same document tweaks. Idempotent.
 *
 * Focus policy: **fields own their focus state** (the app draws the accent
 * indicator), so the browser ring is removed from inputs. Everything else that
 * can take focus keeps a ring, because keyboard users need to see where they
 * are.
 */
const STYLE_ID = 'devlofy-web-reset';

const ACCENT = '#4B5AA0';
const ACCENT_DARK = '#BCC2FF';

const CSS = `
  * { -webkit-tap-highlight-color: transparent; }
  html, body { overscroll-behavior: none; }
  input:focus, textarea:focus, select:focus { outline: none; }
  a:focus-visible, button:focus-visible, [role='button']:focus-visible {
    outline: 2px solid ${ACCENT};
    outline-offset: 2px;
  }
  @media (prefers-color-scheme: dark) {
    a:focus-visible, button:focus-visible, [role='button']:focus-visible {
      outline-color: ${ACCENT_DARK};
    }
  }
`;

export function applyWebReset(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
