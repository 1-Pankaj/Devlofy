/**
 * Where the GitHub token lives: on this device, and nowhere else.
 *
 * It goes through the app's KV adapter — `expo-sqlite/kv-store` on native,
 * `localStorage` on web — which is the same store the settings use. That is a
 * deliberate trade: it costs no new dependency and cannot break Expo Go, and it
 * is honest for a single-user app with no backend. It is *not* the OS keychain,
 * so the UI says plainly where the token is and offers to forget it.
 *
 * The device flow asks for classic `repo read:org`, which writes as well as
 * reads; a pasted fine-grained token can be narrower (Contents: Read for
 * browsing, and only add write if you want to commit). Whatever the token can
 * do, the app's own rule is stricter: a commit only ever lands on a branch, and
 * never on the default branch. See ADR-020.
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
