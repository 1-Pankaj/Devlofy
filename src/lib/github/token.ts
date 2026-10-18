/**
 * Where the GitHub token lives: on this device, and nowhere else.
 *
 * It goes through the app's KV adapter — `expo-sqlite/kv-store` on native,
 * `localStorage` on web — which is the same store the settings use. That is a
 * deliberate trade: it costs no new dependency and cannot break Expo Go, and it
 * is honest for a single-user app with no backend. It is *not* the OS keychain,
 * so the UI says plainly where the token is and offers to forget it.
 *
 * The scope the flow requests is read-mostly (`repo read:org`); a pasted token
 * should be read-only too. The app never writes to GitHub.
 */
import { kv } from '@/lib/storage';

const AUTH_KEY = 'devlofy.github.auth';

export type StoredAuth = {
  token: string;
  /** What the token was granted, when GitHub told us. Empty for pasted tokens. */
  scopes: string[];
};

export async function getAuth(): Promise<StoredAuth | null> {
  const raw = await kv.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';
    if (!token) return null;
    return { token, scopes: Array.isArray(parsed.scopes) ? parsed.scopes : [] };
  } catch {
    return null;
  }
}

export async function setAuth(auth: StoredAuth): Promise<void> {
  await kv.setItem(AUTH_KEY, JSON.stringify({ token: auth.token.trim(), scopes: auth.scopes }));
}

export async function clearAuth(): Promise<void> {
  await kv.removeItem(AUTH_KEY);
}
