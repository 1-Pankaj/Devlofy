/**
 * GitHub Device Flow — "sign in on this device", for the tablet.
 *
 * The app has no backend, and an OAuth web redirect needs one (a callback URL
 * that is not `localhost`). Device flow is the grant that exists for exactly
 * this situation: GitHub shows a short code, the user approves it in any
 * browser they already have, and this app polls until the token appears. No
 * client secret, no server, nothing to host.
 *
 * **Native only.** `github.com/login/device/code` and `/login/oauth/access_token`
 * send no `Access-Control-Allow-Origin` header (verified by hand), so a browser
 * cannot read their responses and the flow cannot be completed on web. The web
 * build uses a pasted token instead — see ADR-019.
 */
import { GITHUB_CLIENT_ID, GITHUB_DEVICE_SCOPES, GITHUB_DEVICE_URL } from './config';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

export type DeviceStart = {
  deviceCode: string;
  /** The code the human types at github.com/login/device. */
  userCode: string;
  verificationUri: string;
  /** The same page with the code pre-filled, when GitHub offers it. */
  verificationUriComplete: string | null;
  expiresInSeconds: number;
  /** GitHub's minimum poll interval — honour it, or the poll is throttled. */
  intervalSeconds: number;
};

export type DevicePoll =
  | { status: 'pending' }
  | { status: 'slow-down' }
  | { status: 'granted'; token: string; scopes: string[] }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'error'; message: string };

type RawDeviceCode = {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
};

type RawToken = {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

/**
 * Form-encoded POSTs (these two endpoints are OAuth 2.0, not REST). The body is
 * built by hand rather than with `URLSearchParams`, whose RN implementation
 * varies by version.
 */
async function postForm<T>(url: string, fields: Record<string, string>): Promise<T> {
  const body = Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Devlofy',
      },
      body,
    });
  } catch {
    throw new Error('GitHub could not be reached.');
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`GitHub answered with something unreadable (${response.status}).`);
  }
}

/** Step one: ask GitHub for a code to show the user. */
export async function startDeviceFlow(): Promise<DeviceStart> {
  if (!GITHUB_CLIENT_ID) {
    throw new Error('No GitHub client ID is configured.');
  }
  const data = await postForm<RawDeviceCode>(DEVICE_CODE_URL, {
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_DEVICE_SCOPES,
  });
  if (!data.device_code || !data.user_code) {
    throw new Error(data.error_description ?? 'GitHub would not start a sign-in.');
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri ?? GITHUB_DEVICE_URL,
    verificationUriComplete: data.verification_uri_complete ?? null,
    expiresInSeconds: data.expires_in ?? 900,
    intervalSeconds: data.interval ?? 5,
  };
}

/** Step two: ask whether the user has approved it yet. One poll per call. */
export async function pollDeviceFlow(deviceCode: string): Promise<DevicePoll> {
  const data = await postForm<RawToken>(ACCESS_TOKEN_URL, {
    client_id: GITHUB_CLIENT_ID,
    device_code: deviceCode,
    grant_type: DEVICE_GRANT,
  });

  if (data.access_token) {
    return {
      status: 'granted',
      token: data.access_token,
      scopes: (data.scope ?? '').split(/[ ,]+/).filter(Boolean),
    };
  }

  switch (data.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return { status: 'slow-down' };
    case 'access_denied':
      return { status: 'denied' };
    case 'expired_token':
      return { status: 'expired' };
    default:
      return {
        status: 'error',
        message: data.error_description ?? data.error ?? 'GitHub would not finish the sign-in.',
      };
  }
}
