/**
 * Pull requests: reading one properly, and doing the four things a reviewer
 * actually does — comment, approve, request changes, merge.
 *
 * A pull request is the only object in this app where a single tap changes
 * something on someone else's branch, so the reads here are deliberately rich:
 * the screen shows the mergeability GitHub computed, the checks on the exact
 * head commit, and the review history *before* it offers a Merge button. The
 * merge call passes the head `sha` it displayed, so a PR that moved while the
 * screen was open is refused rather than merged unseen.
 */
import { GithubError, githubRequest } from './api';

export type PullState = 'open' | 'closed' | 'merged';
export type MergeMethod = 'merge' | 'squash' | 'rebase';
export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export type PullSummary = {
  number: number;
  title: string;
  state: PullState;
  draft: boolean;
  author: string;
  updatedAt: string | null;
  headRef: string;
  baseRef: string;
  comments: number;
  htmlUrl: string;
  labels: string[];
};

export type PullDetail = PullSummary & {
  nodeId: string;
  body: string;
  createdAt: string | null;
  mergedAt: string | null;
  closedAt: string | null;
  headSha: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  /** `null` while GitHub is still working it out — never treat null as "yes". */
  mergeable: boolean | null;
  /** clean · dirty · blocked · behind · unstable · unknown */
  mergeableState: string;
  requestedReviewers: string[];
  isCrossRepo: boolean;
  reviewers: { login: string; state: string }[];
};

export type PullFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  /** GitHub's unified diff text; absent for binaries and very large diffs. */
  patch: string | null;
  previousFilename: string | null;
};

export type CheckState = 'passing' | 'failing' | 'running' | 'skipped' | 'neutral';

export type CheckItem = {
  name: string;
  state: CheckState;
  detail: string | null;
  url: string | null;
  /** Which system reported it, so two same-named checks stay distinguishable. */
  source: 'check-run' | 'status';
};

export type CheckSummary = {
  state: CheckState | 'none' | 'unknown';
  items: CheckItem[];
  passing: number;
  failing: number;
  running: number;
};

export type ReviewComment = {
  id: number;
  author: string;
  body: string;
  createdAt: string | null;
  htmlUrl: string;
  /** Present when this is a review submission rather than a conversation line. */
  state: string | null;
};

type RawPull = {
  number?: number;
  node_id?: string;
  title?: string;
  body?: string | null;
  state?: string;
  draft?: boolean;
  merged?: boolean;
  merged_at?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  html_url?: string;
  comments?: number;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  mergeable?: boolean | null;
  mergeable_state?: string;
  user?: { login?: string };
  head?: { ref?: string; sha?: string; repo?: { full_name?: string } | null };
  base?: { ref?: string; repo?: { full_name?: string } | null };
  requested_reviewers?: { login?: string }[];
  labels?: { name?: string }[];
};

function toSummary(raw: RawPull): PullSummary {
  const state: PullState = raw.merged ? 'merged' : raw.state === 'closed' ? 'closed' : 'open';
  return {
    number: raw.number ?? 0,
    title: raw.title ?? '(untitled)',
    state,
    draft: raw.draft === true,
    author: raw.user?.login ?? 'unknown',
    updatedAt: raw.updated_at ?? null,
    headRef: raw.head?.ref ?? '',
    baseRef: raw.base?.ref ?? '',
    comments: raw.comments ?? 0,
    htmlUrl: raw.html_url ?? '',
    labels: (raw.labels ?? []).map((label) => label.name ?? '').filter(Boolean),
  };
}

function toDetail(raw: RawPull): PullDetail {
  return {
    ...toSummary(raw),
    nodeId: raw.node_id ?? '',
    body: raw.body ?? '',
    createdAt: raw.created_at ?? null,
    mergedAt: raw.merged_at ?? null,
    closedAt: raw.closed_at ?? null,
    headSha: raw.head?.sha ?? '',
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    changedFiles: raw.changed_files ?? 0,
    commits: raw.commits ?? 0,
    mergeable: typeof raw.mergeable === 'boolean' ? raw.mergeable : null,
    mergeableState: raw.mergeable_state ?? 'unknown',
    requestedReviewers: (raw.requested_reviewers ?? [])
      .map((reviewer) => reviewer.login ?? '')
      .filter(Boolean),
    isCrossRepo:
      Boolean(raw.head?.repo?.full_name) &&
      Boolean(raw.base?.repo?.full_name) &&
      raw.head?.repo?.full_name !== raw.base?.repo?.full_name,
    reviewers: [],
  };
}

// ───────────────────────────── reads ─────────────────────────────

export async function listPulls(
  token: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
): Promise<PullSummary[]> {
  const { value } = await githubRequest<RawPull[]>(
    `/repos/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=30`,
    token,
  );
  return (Array.isArray(value) ? value : []).map(toSummary);
}

/** One call for the PR plus its reviews — the screen needs both to be useful. */
export async function getPull(
  token: string,
  repo: string,
  number: number,
): Promise<PullDetail> {
  const { value } = await githubRequest<RawPull>(`/repos/${repo}/pulls/${number}`, token);
  if (!value?.number) throw new GithubError('not-found', 'That pull request does not exist.');
  const detail = toDetail(value);

  try {
    const { value: reviews } = await githubRequest<
      { user?: { login?: string }; state?: string; submitted_at?: string | null }[]
    >(`/repos/${repo}/pulls/${number}/reviews?per_page=50`, token);

    // One row per reviewer, latest state wins.
    const latest = new Map<string, { login: string; state: string; at: string }>();
    for (const review of Array.isArray(reviews) ? reviews : []) {
      const login = review.user?.login ?? '';
      if (!login || !review.state) continue;
      const at = review.submitted_at ?? '';
      const existing = latest.get(login);
      if (!existing || at >= existing.at) latest.set(login, { login, state: review.state, at });
    }
    detail.reviewers = [...latest.values()]
      .sort((a, b) => a.login.localeCompare(b.login))
      .map(({ login, state }) => ({ login, state }));
  } catch {
    // Reviews are a nicety; the PR itself already loaded.
  }

  return detail;
}

export async function listPullFiles(
  token: string,
  repo: string,
  number: number,
): Promise<PullFile[]> {
  const { value } = await githubRequest<
    {
      filename?: string;
      previous_filename?: string | null;
      status?: string;
      additions?: number;
      deletions?: number;
      changes?: number;
      patch?: string | null;
    }[]
  >(`/repos/${repo}/pulls/${number}/files?per_page=100`, token);

  return (Array.isArray(value) ? value : []).map((file) => ({
    filename: file.filename ?? '',
    status: file.status ?? 'modified',
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    changes: file.changes ?? 0,
    patch: file.patch ?? null,
    previousFilename: file.previous_filename ?? null,
  }));
}

function checkRunState(status: string | undefined, conclusion: string | null | undefined): CheckState {
  if (status !== 'completed') return status === 'queued' || status === 'in_progress' ? 'running' : 'neutral';
  switch (conclusion) {
    case 'success':
      return 'passing';
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return 'failing';
    case 'skipped':
      return 'skipped';
    default:
      return 'neutral';
  }
}

/**
 * Checks on a commit: modern check runs *and* the legacy commit statuses, which
 * older CI setups still use. Both are read, because a repo usually has only one
 * of them and the screen cannot know which in advance.
 */
export async function getChecksForRef(
  token: string,
  repo: string,
  ref: string,
): Promise<CheckSummary> {
  const items: CheckItem[] = [];

  try {
    const { value } = await githubRequest<{
      check_runs?: {
        name?: string;
        status?: string;
        conclusion?: string | null;
        details_url?: string | null;
        html_url?: string | null;
        output?: { title?: string | null; summary?: string | null } | null;
        app?: { name?: string } | null;
      }[];
    }>(`/repos/${repo}/commits/${ref}/check-runs?per_page=50`, token);

    for (const run of value?.check_runs ?? []) {
      const app = run.app?.name ? `${run.app.name} · ` : '';
      items.push({
        name: `${app}${run.name ?? 'check'}`,
        state: checkRunState(run.status, run.conclusion),
        detail: run.output?.title ?? run.output?.summary ?? null,
        url: run.details_url ?? run.html_url ?? null,
        source: 'check-run',
      });
    }
  } catch {
    // A token without Checks read, or a commit with none — same answer: no rows.
  }

  try {
    const { value } = await githubRequest<{
      state?: string;
      statuses?: { context?: string; state?: string; description?: string | null; target_url?: string | null }[];
    }>(`/repos/${repo}/commits/${ref}/status`, token);

    for (const status of value?.statuses ?? []) {
      const state = status.state;
      items.push({
        name: status.context ?? 'status',
        state:
          state === 'success'
            ? 'passing'
            : state === 'failure' || state === 'error'
              ? 'failing'
              : state === 'pending'
                ? 'running'
                : 'neutral',
        detail: status.description ?? null,
        url: status.target_url ?? null,
        source: 'status',
      });
    }
  } catch {
    // Legacy statuses are optional.
  }

  const passing = items.filter((item) => item.state === 'passing').length;
  const failing = items.filter((item) => item.state === 'failing').length;
  const running = items.filter((item) => item.state === 'running').length;

  return {
    state:
      items.length === 0
        ? 'none'
        : failing > 0
          ? 'failing'
          : running > 0
            ? 'running'
            : passing > 0
              ? 'passing'
              : 'unknown',
    items,
    passing,
    failing,
    running,
  };
}

/** The conversation: comments and review submissions, oldest first. */
export async function listConversation(
  token: string,
  repo: string,
  number: number,
): Promise<ReviewComment[]> {
  const [comments, reviews] = await Promise.all([
    githubRequest<
      { id?: number; user?: { login?: string }; body?: string; created_at?: string; html_url?: string }[]
    >(`/repos/${repo}/issues/${number}/comments?per_page=50`, token).catch(() => null),
    githubRequest<
      {
        id?: number;
        user?: { login?: string };
        body?: string;
        submitted_at?: string | null;
        html_url?: string;
        state?: string;
      }[]
    >(`/repos/${repo}/pulls/${number}/reviews?per_page=50`, token).catch(() => null),
  ]);

  const rows: ReviewComment[] = [
    ...(comments?.value ?? []).map((comment) => ({
      id: comment.id ?? 0,
      author: comment.user?.login ?? 'unknown',
      body: comment.body ?? '',
      createdAt: comment.created_at ?? null,
      htmlUrl: comment.html_url ?? '',
      state: null,
    })),
    ...(reviews?.value ?? [])
      .filter((review) => (review.body ?? '').trim().length > 0)
      .map((review) => ({
        id: review.id ?? 0,
        author: review.user?.login ?? 'unknown',
        body: review.body ?? '',
        createdAt: review.submitted_at ?? null,
        htmlUrl: review.html_url ?? '',
        state: review.state ?? null,
      })),
  ];

  return rows
    .filter((row) => row.body.trim().length > 0)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

// ───────────────────────────── writes ─────────────────────────────

export async function createPull(
  token: string,
  options: {
    repo: string;
    title: string;
    head: string;
    base: string;
    body?: string;
    draft?: boolean;
  },
): Promise<PullSummary> {
  const { value } = await githubRequest<RawPull>(`/repos/${options.repo}/pulls`, token, {
    method: 'POST',
    body: {
      title: options.title,
      head: options.head,
      base: options.base,
      ...(options.body ? { body: options.body } : {}),
      draft: options.draft ?? false,
    },
  });
  return toSummary(value ?? {});
}

export async function updatePull(
  token: string,
  options: {
    repo: string;
    number: number;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    base?: string;
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.title !== undefined) body.title = options.title;
  if (options.body !== undefined) body.body = options.body;
  if (options.state !== undefined) body.state = options.state;
  if (options.base !== undefined) body.base = options.base;

  await githubRequest(`/repos/${options.repo}/pulls/${options.number}`, token, {
    method: 'PATCH',
    body,
  });
}

export async function requestReviewers(
  token: string,
  options: { repo: string; number: number; reviewers: string[] },
): Promise<void> {
  await githubRequest(`/repos/${options.repo}/pulls/${options.number}/requested_reviewers`, token, {
    method: 'POST',
    body: { reviewers: options.reviewers },
  });
}

export async function submitReview(
  token: string,
  options: {
    repo: string;
    number: number;
    event: ReviewEvent;
    body?: string;
    /** Review the commit that was on screen, not whatever arrived since. */
    commitId?: string;
  },
): Promise<void> {
  const body = options.body?.trim() ?? '';
  if (options.event !== 'APPROVE' && body.length === 0) {
    throw new GithubError(
      'validation',
      options.event === 'REQUEST_CHANGES'
        ? 'Requesting changes needs a sentence saying what to change.'
        : 'A comment needs something in it.',
    );
  }

  await githubRequest(`/repos/${options.repo}/pulls/${options.number}/reviews`, token, {
    method: 'POST',
    body: {
      event: options.event,
      ...(body ? { body } : {}),
      ...(options.commitId ? { commit_id: options.commitId } : {}),
    },
  });
}

/**
 * Merge. `sha` is the head commit the screen showed a moment ago — sending it
 * means GitHub refuses (409) rather than merging a head the user never saw.
 */
export async function mergePull(
  token: string,
  options: {
    repo: string;
    number: number;
    method: MergeMethod;
    sha?: string;
    commitTitle?: string;
  },
): Promise<{ merged: boolean; message: string; sha: string }> {
  const { value } = await githubRequest<{ merged?: boolean; message?: string; sha?: string }>(
    `/repos/${options.repo}/pulls/${options.number}/merge`,
    token,
    {
      method: 'PUT',
      body: {
        merge_method: options.method,
        ...(options.sha ? { sha: options.sha } : {}),
        ...(options.commitTitle ? { commit_title: options.commitTitle } : {}),
      },
    },
  );

  return {
    merged: value?.merged === true,
    message: value?.message ?? (value?.merged ? 'Merged.' : 'GitHub would not merge that.'),
    sha: value?.sha ?? '',
  };
}

/**
 * Draft → ready is GraphQL-only; there is no REST endpoint for it. It needs the
 * node id, which `getPull` already carries.
 */
export async function markReadyForReview(
  token: string,
  nodeId: string,
): Promise<void> {
  if (!nodeId) throw new GithubError('validation', 'That pull request has no node id to address.');
  const { value } = await githubRequest<{ data?: { markPullRequestReadyForReview?: { pullRequest?: { id?: string } } }; errors?: { message?: string }[] }>(
    '/graphql',
    token,
    {
      method: 'POST',
      body: {
        query:
          'mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { id isDraft } } }',
        variables: { id: nodeId },
      },
    },
  );

  const problem = value?.errors?.[0]?.message;
  if (problem) throw new GithubError('validation', problem);
  if (!value?.data?.markPullRequestReadyForReview) {
    throw new GithubError('unknown', 'GitHub did not answer the mark-ready request.');
  }
}

/** A conversation line on a pull request (the same endpoint issues use). */
export async function addPullComment(
  token: string,
  options: { repo: string; number: number; body: string },
): Promise<ReviewComment> {
  const body = options.body.trim();
  if (!body) throw new GithubError('validation', 'Write something first.');

  const { value } = await githubRequest<{
    id?: number;
    user?: { login?: string };
    body?: string;
    created_at?: string;
    html_url?: string;
  }>(`/repos/${options.repo}/issues/${options.number}/comments`, token, {
    method: 'POST',
    body: { body },
  });

  return {
    id: value?.id ?? 0,
    author: value?.user?.login ?? 'you',
    body: value?.body ?? body,
    createdAt: value?.created_at ?? new Date().toISOString(),
    htmlUrl: value?.html_url ?? '',
    state: null,
  };
}

/** Words for the merge panel, so "blocked" is never shown raw. */
export function mergeableLabel(state: string): { label: string; tone: 'accent' | 'danger' | 'neutral' | 'info' } {
  switch (state) {
    case 'clean':
      return { label: 'ready to merge', tone: 'accent' };
    case 'dirty':
      return { label: 'conflicts', tone: 'danger' };
    case 'blocked':
      return { label: 'blocked by checks or review', tone: 'danger' };
    case 'behind':
      return { label: 'behind the base branch', tone: 'info' };
    case 'unstable':
      return { label: 'checks still running', tone: 'neutral' };
    case 'draft':
      return { label: 'a draft', tone: 'neutral' };
    case 'unknown':
      return { label: 'mergeability unknown', tone: 'neutral' };
    default:
      return { label: state, tone: 'neutral' };
  }
}
