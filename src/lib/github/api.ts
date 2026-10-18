/**
 * GitHub REST — the transport, the failures, and the dashboard.
 *
 * This module owns three things and delegates the rest to its neighbours:
 *
 *  1. **The request layer.** One `githubRequest` speaks every verb, keeps the
 *     pinned API version, meters the rate limit, and turns a refusal into a
 *     `GithubError` that carries GitHub's *own* sentence — so a screen can say
 *     "Required status check is expected" instead of "422".
 *  2. **The dashboard.** One question: *what on GitHub is waiting for me?* Every
 *     section is fetched independently, so a limited token loses a section and
 *     not the screen, and what could not be read is stated in `notes`.
 *  3. **The vocabulary.** The types the rest of `src/lib/github/` shares.
 *
 * Writes live next door (`repo.ts`, `pulls.ts`, `issues.ts`, `ci.ts`) and go
 * through the same transport. They are allowed — and bounded — by ADR-020: the
 * app never silently touches `main`, always shows the diff first, and never
 * force-pushes or deletes a branch.
 *
 * No response is trusted blindly: every field is narrowed with `??`, so a schema
 * change on GitHub's side degrades a row, not the screen.
 */
const API_BASE = 'https://api.github.com';
/** Pinned so a future default cannot change what these parsers mean. */
const API_VERSION = '2022-11-28';
const REPO_LIMIT = 12;
const ITEM_LIMIT = 8;
const RUN_LIMIT = 5;

export type GithubFailureKind =
  | 'auth'
  | 'rate-limit'
  | 'forbidden'
  /** A write was refused: the token can read but not write. */
  | 'read-only'
  /** 404 — wrong name, or a token that cannot see it. */
  | 'not-found'
  /** 409 — someone else moved the branch while we were holding an old `sha`. */
  | 'conflict'
  /** 422 — GitHub understood the request and rejected its content. */
  | 'validation'
  | 'network'
  | 'unknown';

export class GithubError extends Error {
  readonly kind: GithubFailureKind;
  readonly status: number | null;

  constructor(kind: GithubFailureKind, message: string, status: number | null = null) {
    super(message);
    this.name = 'GithubError';
    this.kind = kind;
    this.status = status;
  }
}

// ───────────────────────────── shapes (as returned) ─────────────────────────────

type RawUser = { login?: string; name?: string | null; avatar_url?: string };

type RawRepo = {
  full_name?: string;
  name?: string;
  description?: string | null;
  private?: boolean;
  language?: string | null;
  pushed_at?: string | null;
  open_issues_count?: number;
  stargazers_count?: number;
  html_url?: string;
};

type RawSearchItem = {
  number?: number;
  title?: string;
  state?: string;
  html_url?: string;
  updated_at?: string;
  comments?: number;
  draft?: boolean | null;
  pull_request?: unknown;
  repository_url?: string;
  user?: { login?: string };
  labels?: { name?: string }[];
};

type RawRun = {
  id?: number;
  name?: string;
  display_title?: string;
  status?: string;
  conclusion?: string | null;
  head_branch?: string | null;
  run_number?: number;
  html_url?: string;
  created_at?: string;
};

// ───────────────────────────── shapes (as we use them) ─────────────────────────────

export type GithubViewer = {
  login: string;
  name: string | null;
  avatarUrl: string;
};

export type GithubRepo = {
  fullName: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  language: string | null;
  pushedAt: string | null;
  openIssues: number;
  stars: number;
  htmlUrl: string;
};

export type GithubItem = {
  number: number;
  title: string;
  kind: 'pr' | 'issue';
  repo: string;
  htmlUrl: string;
  updatedAt: string | null;
  comments: number;
  draft: boolean;
  author: string;
  labels: string[];
};

export type GithubRun = {
  /** The run's id, so the dashboard can open it in the app rather than a browser. */
  id: number;
  repo: string;
  name: string;
  branch: string | null;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string | null;
  runNumber: number;
};

export type GithubRate = { limit: number; remaining: number; resetAt: string | null };

export type GithubSnapshot = {
  /** When this snapshot was taken, so the UI can date what it is showing. */
  fetchedAt: string;
  viewer: GithubViewer;
  rate: GithubRate | null;
  repos: GithubRepo[];
  /** Pull requests the viewer opened. */
  authoredPrs: GithubItem[];
  /** Pull requests someone asked the viewer to review. */
  reviewRequests: GithubItem[];
  /** Issues assigned to the viewer. */
  assignedIssues: GithubItem[];
  /** The newest workflow run on each of the most recently pushed repos. */
  runs: GithubRun[];
  /** What could not be read, in the app's own words. Empty when all was well. */
  notes: string[];
};

// ───────────────────────────── the request layer ─────────────────────────────

export type HttpVerb = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type GithubRequestInit = {
  method?: HttpVerb;
  /** Serialised here so a caller can never forget the content type. */
  body?: unknown;
  /** Overrides `Accept` — the Contents API needs `raw` to hand back bytes. */
  accept?: string;
  /** Bodies that are not JSON (nothing yet, but the shape is honest). */
  parse?: 'json' | 'text';
};

export type GithubResponse<T> = {
  value: T | null;
  rate: GithubRate | null;
  status: number;
  /** True when GitHub said there is another page behind this one. */
  hasMore: boolean;
};

function headers(token: string, accept = 'application/vnd.github+json'): Record<string, string> {
  return {
    Accept: accept,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  };
}

/**
 * GitHub's own explanation, when it sends one. A `422` on a pull request says
 * *which* field was wrong; a `409` says the ref moved. That sentence is worth
 * more than any wording we could invent, so it is folded into the error.
 */
async function bodyMessage(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    const parsed = JSON.parse(text) as { message?: unknown; errors?: unknown };
    const message = typeof parsed.message === 'string' ? parsed.message : null;
    const errors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const details = errors
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const record = entry as { message?: string; field?: string; code?: string };
          return [record.field, record.message ?? record.code].filter(Boolean).join(' ');
        }
        return null;
      })
      .filter((line): line is string => Boolean(line));
    if (message && details.length > 0) return `${message} (${details.join('; ')})`;
    return message;
  } catch {
    return null;
  }
}

function rateFrom(response: Response): GithubRate | null {
  const limit = Number(response.headers.get('x-ratelimit-limit') ?? '');
  const remaining = Number(response.headers.get('x-ratelimit-remaining') ?? '');
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? '');
  if (!Number.isFinite(limit) || limit <= 0) return null;
  return {
    limit,
    remaining: Number.isFinite(remaining) ? remaining : 0,
    resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
  };
}

async function failureFor(response: Response, writing: boolean): Promise<GithubError> {
  const detail = await bodyMessage(response);
  const remaining = response.headers.get('x-ratelimit-remaining');
  const spent = remaining === '0' || response.status === 429;

  if (response.status === 401) {
    return new GithubError(
      'auth',
      'GitHub rejected that token — it may have been revoked, expired, or mistyped.',
      401,
    );
  }
  if (spent) {
    const reset = Number(response.headers.get('x-ratelimit-reset') ?? '');
    const when = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null;
    return new GithubError(
      'rate-limit',
      when ? `GitHub's rate limit is spent; it refills at ${when}.` : "GitHub's rate limit is spent.",
      response.status,
    );
  }
  if (response.status === 403) {
    if (writing) {
      return new GithubError(
        'read-only',
        detail ??
          'This token cannot write to that repository. A fine-grained token needs Contents: write; a classic one needs the repo scope.',
        403,
      );
    }
    return new GithubError(
      'forbidden',
      detail ?? 'This token is missing a permission — Actions and Issues need read access.',
      403,
    );
  }
  if (response.status === 404) {
    return new GithubError(
      'not-found',
      detail ?? 'That repository, branch or file does not exist — or this token cannot see it.',
      404,
    );
  }
  if (response.status === 409) {
    return new GithubError(
      'conflict',
      detail ?? 'Someone changed that branch while you were editing. Refresh and try again.',
      409,
    );
  }
  if (response.status === 422) {
    return new GithubError(
      'validation',
      detail ?? 'GitHub rejected that request: it was valid JSON but not valid for this repository.',
      422,
    );
  }
  return new GithubError(
    'unknown',
    detail ?? `GitHub answered with ${response.status}.`,
    response.status,
  );
}

/**
 * Every call to GitHub goes through here. Reads and writes differ only in the
 * verb, which is what keeps the failure handling honest: the one place that
 * knows whether a `403` means "read-only token" or "missing permission" is the
 * one place that saw the request.
 */
export async function githubRequest<T>(
  path: string,
  token: string,
  init: GithubRequestInit = {},
): Promise<GithubResponse<T>> {
  const method = init.method ?? 'GET';
  const hasBody = init.body !== undefined;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...headers(token, init.accept),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new GithubError('network', 'GitHub could not be reached.');
  }

  if (!response.ok) throw await failureFor(response, method !== 'GET');

  const rate = rateFrom(response);
  const link = response.headers.get('link') ?? '';
  const hasMore = /rel="next"/.test(link);

  if (response.status === 204) return { value: null, rate, status: 204, hasMore };

  const text = await response.text();
  if (!text) return { value: null, rate, status: response.status, hasMore };

  if (init.parse === 'text') {
    return { value: text as unknown as T, rate, status: response.status, hasMore };
  }

  try {
    return { value: JSON.parse(text) as T, rate, status: response.status, hasMore };
  } catch {
    return { value: null, rate, status: response.status, hasMore };
  }
}

/** The GET shorthand the dashboard below uses. */
async function request<T>(
  path: string,
  token: string,
): Promise<{ value: T; rate: GithubRate | null }> {
  const { value, rate } = await githubRequest<T>(path, token);
  return { value: value as T, rate };
}

// ───────────────────────────── parsers ─────────────────────────────

/** `https://api.github.com/repos/owner/name` → `owner/name`. */
function repoFromApiUrl(url: string | undefined): string {
  if (!url) return 'unknown';
  const parts = url.split('/repos/');
  return parts.length === 2 ? parts[1] : 'unknown';
}

function toRepo(raw: RawRepo): GithubRepo {
  const fullName = raw.full_name ?? raw.name ?? 'unknown';
  return {
    fullName,
    name: raw.name ?? fullName.split('/').pop() ?? fullName,
    description: raw.description ?? null,
    isPrivate: raw.private === true,
    language: raw.language ?? null,
    pushedAt: raw.pushed_at ?? null,
    openIssues: raw.open_issues_count ?? 0,
    stars: raw.stargazers_count ?? 0,
    htmlUrl: raw.html_url ?? `https://github.com/${fullName}`,
  };
}

function toItem(raw: RawSearchItem, kind: GithubItem['kind']): GithubItem {
  return {
    number: raw.number ?? 0,
    title: raw.title ?? '(untitled)',
    kind,
    repo: repoFromApiUrl(raw.repository_url),
    htmlUrl: raw.html_url ?? '',
    updatedAt: raw.updated_at ?? null,
    comments: raw.comments ?? 0,
    draft: raw.draft === true,
    author: raw.user?.login ?? 'unknown',
    labels: (raw.labels ?? []).map((label) => label.name ?? '').filter(Boolean),
  };
}

function toRun(raw: RawRun, repo: string): GithubRun {
  return {
    id: raw.id ?? 0,
    repo,
    name: raw.display_title ?? raw.name ?? 'Workflow',
    branch: raw.head_branch ?? null,
    status: raw.status ?? 'unknown',
    conclusion: raw.conclusion ?? null,
    htmlUrl: raw.html_url ?? '',
    createdAt: raw.created_at ?? null,
    runNumber: raw.run_number ?? 0,
  };
}

// ───────────────────────────── reads ─────────────────────────────

/**
 * The identity a token belongs to. Deliberately fatal: everything else on the
 * dashboard is meaningless without it, and a bad token should fail loudly at
 * connect time rather than quietly later.
 */
export async function fetchViewer(token: string): Promise<GithubViewer> {
  const { value } = await request<RawUser>('/user', token);
  if (!value.login) {
    throw new GithubError('unknown', 'GitHub accepted the token but would not say who it belongs to.');
  }
  return {
    login: value.login,
    name: value.name ?? null,
    avatarUrl: value.avatar_url ?? '',
  };
}

async function fetchRepos(token: string): Promise<GithubRepo[]> {
  const { value } = await request<RawRepo[]>(
    `/user/repos?sort=pushed&direction=desc&per_page=${REPO_LIMIT}&affiliation=owner,collaborator`,
    token,
  );
  const repos = Array.isArray(value) ? value.map(toRepo) : [];
  return repos.filter((repo) => repo.fullName !== 'unknown');
}

async function search(token: string, query: string, kind: GithubItem['kind']): Promise<GithubItem[]> {
  const { value } = await request<{ items?: RawSearchItem[] }>(
    `/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${ITEM_LIMIT}`,
    token,
  );
  return (value.items ?? []).map((item) => toItem(item, kind));
}

/** A repo with no workflows is normal, not an error — so this one never throws. */
async function latestRun(token: string, repo: string): Promise<GithubRun | null> {
  try {
    const { value } = await request<{ workflow_runs?: RawRun[] }>(
      `/repos/${repo}/actions/runs?per_page=1`,
      token,
    );
    const run = (value.workflow_runs ?? [])[0];
    return run ? toRun(run, repo) : null;
  } catch {
    return null;
  }
}

/** Try a section; keep the dashboard alive when it fails. */
async function section<T>(
  notes: string[],
  what: string,
  run: () => Promise<T>,
  empty: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    notes.push(`${what}: ${failureMessage(error)}`);
    return empty;
  }
}

/**
 * Everything the dashboard shows, in one pass. The viewer is fetched first (a
 * bad token must fail the whole refresh), then repos and the three searches go
 * out together, then the newest runs for the repos most recently pushed.
 */
export async function loadDashboard(token: string): Promise<GithubSnapshot> {
  const viewer = await fetchViewer(token);
  const notes: string[] = [];

  const [repos, authoredPrs, reviewRequests, assignedIssues] = await Promise.all([
    section(notes, 'Repositories', () => fetchRepos(token), [] as GithubRepo[]),
    section(
      notes,
      'Your pull requests',
      () => search(token, `is:open is:pr author:${viewer.login}`, 'pr'),
      [],
    ),
    section(
      notes,
      'Review requests',
      () => search(token, `is:open is:pr review-requested:${viewer.login}`, 'pr'),
      [],
    ),
    section(
      notes,
      'Assigned issues',
      () => search(token, `is:open is:issue assignee:${viewer.login}`, 'issue'),
      [],
    ),
  ]);

  const watched = repos.slice(0, RUN_LIMIT);
  const runs: GithubRun[] = [];
  if (watched.length > 0) {
    const settled = await Promise.all(watched.map((repo) => latestRun(token, repo.fullName)));
    settled.forEach((run) => {
      if (run) runs.push(run);
    });
    if (runs.length === 0) {
      notes.push('Checks: no workflow runs found — or this token cannot read Actions.');
    }
  }

  // `/rate_limit` is free (it does not spend the allowance it reports).
  const rate = await section<GithubRate | null>(
    notes,
    'Rate limit',
    async () => {
      const { value } = await request<{
        resources?: { core?: { limit?: number; remaining?: number; reset?: number } };
      }>('/rate_limit', token);
      const core = value.resources?.core;
      if (!core?.limit) return null;
      return {
        limit: core.limit,
        remaining: core.remaining ?? 0,
        resetAt: core.reset ? new Date(core.reset * 1000).toISOString() : null,
      };
    },
    null,
  );

  return {
    fetchedAt: new Date().toISOString(),
    viewer,
    rate,
    repos,
    authoredPrs,
    reviewRequests,
    assignedIssues,
    runs,
    notes,
  };
}

/** `owner/name` → its halves, with a safe answer for anything odd. */
export function splitRepo(fullName: string): { owner: string; name: string } {
  const [owner, ...rest] = fullName.split('/');
  return { owner: owner ?? '', name: rest.join('/') || fullName };
}

/** The sentence a screen shows when a refresh fails. */
export function failureMessage(error: unknown): string {
  if (error instanceof GithubError) return error.message;
  return 'Something went wrong talking to GitHub.';
}
