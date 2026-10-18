/**
 * JWT: read one, and be honest that reading is all this can do.
 *
 * A JWT is base64url JSON with a signature this app cannot check — there is no
 * key, and there is deliberately no "verify" button that would lie. So the screen
 * shows the header, the payload, the standard claims with their times in words,
 * and says plainly that the signature is *not* verified. Base64url is decoded
 * with `src/lib/base64`, which already tolerates the URL-safe alphabet.
 */
import { base64ToBytes, bytesToUtf8 } from '../base64';
import { relativeTime } from './time';

export type JwtResult =
  | {
      ok: true;
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
      signatureBytes: number;
      headerText: string;
      payloadText: string;
    }
  | { ok: false; message: string };

function decodeSegment(segment: string): { json: Record<string, unknown>; text: string } | null {
  const text = bytesToUtf8(base64ToBytes(segment));
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { json: parsed as Record<string, unknown>, text };
    }
    return null;
  } catch {
    return null;
  }
}

export function decodeJwt(token: string): JwtResult {
  const trimmed = token.trim().replace(/^Bearer\s+/i, '');
  if (!trimmed) return { ok: false, message: 'Nothing to read yet.' };

  const segments = trimmed.split('.');
  if (segments.length !== 3) {
    return {
      ok: false,
      message: `A JWT has three dot-separated parts; this one has ${segments.length}.`,
    };
  }

  const header = decodeSegment(segments[0]);
  const payload = decodeSegment(segments[1]);
  if (!header) return { ok: false, message: 'The header is not base64url-encoded JSON.' };
  if (!payload) return { ok: false, message: 'The payload is not base64url-encoded JSON.' };

  return {
    ok: true,
    header: header.json,
    payload: payload.json,
    signatureBytes: base64ToBytes(segments[2]).length,
    headerText: header.text,
    payloadText: payload.text,
  };
}

const CLAIM_LABELS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires',
  nbf: 'Not before',
  iat: 'Issued',
  jti: 'JWT ID',
  scope: 'Scope',
  scopes: 'Scopes',
  azp: 'Authorised party',
  client_id: 'Client',
  alg: 'Algorithm',
  typ: 'Type',
  kid: 'Key ID',
};

export function claimLabel(key: string): string {
  return CLAIM_LABELS[key] ?? key;
}

const TIME_CLAIMS = new Set(['exp', 'nbf', 'iat']);

export type ClaimRow = { key: string; label: string; value: string; when: string | null };

export function claimRows(payload: Record<string, unknown>, now = Date.now()): ClaimRow[] {
  return Object.entries(payload).map(([key, value]) => {
    const seconds = typeof value === 'number' ? value : null;
    const isTime = TIME_CLAIMS.has(key) && seconds !== null;
    return {
      key,
      label: claimLabel(key),
      value: typeof value === 'string' ? value : JSON.stringify(value),
      when: isTime ? relativeTime(seconds * 1000, now) : null,
    };
  });
}

export type ExpiryState = 'expired' | 'not-yet-valid' | 'valid' | 'no-expiry';

export function expiryState(payload: Record<string, unknown>, now = Date.now()): ExpiryState {
  const exp = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf * 1000 : null;

  if (nbf !== null && now < nbf) return 'not-yet-valid';
  if (exp === null) return 'no-expiry';
  return now >= exp ? 'expired' : 'valid';
}
