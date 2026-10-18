/**
 * GitHub configuration, from one place: `expo.extra.githubClientId` in app.json.
 *
 * The client ID is **public** by design (it is sent to the browser in a normal
 * OAuth web flow) — the device flow never needs a client secret, which is why
 * this app can use it without a backend. Read from the JSON rather than through
 * `expo-constants` for the same reason as the version: a running dev server
 * snapshots the manifest, so `Constants.expoConfig` goes stale after an edit.
 */
import appJson from '../../../app.json';

type GithubExtra = { githubClientId?: string };

const extra = (appJson.expo.extra ?? {}) as GithubExtra;

/** Empty until the user registers their own OAuth App (see docs/07-decisions.md, ADR-019). */
export const GITHUB_CLIENT_ID: string = (extra.githubClientId ?? '').trim();

/**
 * Whether on-device sign-in can be offered at all. It needs both:
 *  - a client ID to identify the app (`githubClientId` above), and
 *  - a platform that can reach GitHub's OAuth endpoints. Those endpoints send no
 *    CORS headers, so a browser cannot read their responses and the flow cannot
 *    complete on web; only a pasted token works there. See ADR-019.
 */
export const GITHUB_DEVICE_FLOW_AVAILABLE =
  GITHUB_CLIENT_ID.length > 0 && process.env.EXPO_OS !== 'web';

/** Where the user goes to make a token, and to approve a device code. */
export const GITHUB_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';
export const GITHUB_DEVICE_URL = 'https://github.com/login/device';

/**
 * Scopes requested by the device flow.
 *
 * OAuth Apps have no fine-grained scopes, so this is all-or-nothing: `repo`
 * grants **write** as well as read. That is why the device flow is the louder of
 * the two doors — the connect screen says so — and why a pasted fine-grained
 * token (Contents: Read for browsing only, `Contents: Read and write` to commit)
 * is the smaller-footprint way in. See ADR-020.
 */
export const GITHUB_DEVICE_SCOPES = 'repo read:org';
