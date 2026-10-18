/**
 * GitHub REST — read-mostly, and honest about what it could not read.
 *
 * The dashboard answers one question: *what on GitHub is waiting for me?* So
 * everything here is a read: the viewer, the repos pushed most recently, the
 * pull requests and issues assigned to them, and the newest CI run per repo.
 * Nothing is ever written back to GitHub.
 *
 * Two rules make this module trustworthy:
 *
 *  1. **The token decides what you see.** Permissions are per-token, so a
 *     section can legitimately fail while the rest succeeds. Each section is
 *     fetched independently and a failure becomes a sentence in `notes` — never
 *     a blank screen, and never a silent zero.
 *  2. **No response is trusted blindly.** Every field is narrowed with `??`, so
 *     a schema change on GitHub's side degrades a row, not the screen.
 */
const API_BASE = 'https://api.github.com';
/** Pinned so a future default cannot change what these parsers mean. */
const API_VERSION = '2022-11-28';
const REPO_LIMIT = 12;
const ITEM_LIMIT = 8;
const RUN_LIMIT = 5;

export type GithubFailureKind = 'auth' | 'rate-limit' | 'forbidden' | 'network' | 'unknown';

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

function headers(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  };
}

async function failureFor(response: Response): Promise<GithubError> {
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (response.status === 401) {
    return new GithubError(
      'auth',
      'GitHub rejected that token — it may have been revoked, expired, or mistyped.',
      401,
    );
  }
  if (response.status === 403 && remaining === '0') {
    const reset = Number(response.headers.get('x-ratelimit-reset') ?? '');
    const when = Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null;
    return new GithubError(
      'rate-limit',
      when ? `GitHub's rate limit is spent; it refills at ${when}.` : "GitHub's rate limit is spent.",
      403,
    );
  }
  if (response.status === 403) {
    return new GithubError(
      'forbidden',
      'This token is missing a permission — Actions and Issues need read access.',
      403,
    );
  }
  if (response.status === 404) {
    return new GithubError('forbidden', 'This token cannot see that repository.', 404);
  }
  return new GithubError('unknown', `GitHub answered with ${response.status}.`, response.status);
}

async function request<T>(
  path: string,
  token: string,
): Promise<{ value: T; rate: GithubRate | null }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: headers(token) });
  } catch {
    throw new GithubError('network', 'GitHub could not be reached.');
  }
  if (!response.ok) throw await failureFor(response);

  const limit = Number(response.headers.get('x-ratelimit-limit') ?? '');
  const remaining = Number(response.headers.get('x-ratelimit-remaining') ?? '');
  const reset = Number(response.headers.get('x-ratelimit-reset') ?? '');
  const rate: GithubRate | null =
    Number.isFinite(limit) && limit > 0
      ? {
          limit,
          remaining: Number.isFinite(remaining) ? remaining : 0,
          resetAt: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
        }
      : null;

  return { value: (await response.json()) as T, rate };
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

/** Only used by the connect screen to prove a pasted token before keeping it. */
export function isAuthFailure(error: unknown): boolean {
  return error instanceof GithubError && error.kind === 'auth';
}

/** The sentence a screen shows when a refresh fails. */
export function failureMessage(error: unknown): string {
  if (error instanceof GithubError) return error.message;
  return 'Something went wrong talking to GitHub.';
}
