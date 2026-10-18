/**
 * Issues, labels, and the notification inbox.
 *
 * The notification inbox is the one part of GitHub that is *pushed* at you
 * rather than pulled, so it belongs in an app like this: it is the honest
 * answer to "what changed while I was away?" — and it costs one request instead
 * of a search per repository.
 *
 * One caveat is built in rather than discovered later: GitHub does not expose
 * `/notifications` to fine-grained tokens at all. When a read fails for that
 * reason the caller gets a plain sentence (see `failureMessage`) and the screen
 * still shows its other sections.
 */
import { GithubError, githubRequest } from './api';

export type IssueState = 'open' | 'closed';

export type IssueSummary = {
  number: number;
  title: string;
  state: IssueState;
  body: string;
  author: string;
  createdAt: string | null;
  updatedAt: string | null;
  comments: number;
  labels: string[];
  assignees: string[];
  htmlUrl: string;
  /** GitHub lists pull requests on the issues endpoint too — they are marked. */
  isPullRequest: boolean;
};

export type IssueDetail = IssueSummary & {
  nodeId: string;
  locked: boolean;
  milestone: string | null;
  closedAt: string | null;
};

export type IssueComment = {
  id: number;
  author: string;
  body: string;
  createdAt: string | null;
  htmlUrl: string;
  /** `null` for a conversation comment; `APPROVED`/`CHANGES_REQUESTED` for a review. */
  state: string | null;
};

export type Label = {
  name: string;
  description: string | null;
};

export type Notification = {
  id: string;
  unread: boolean;
  reason: string;
  updatedAt: string | null;
  title: string;
  /** `PullRequest`, `Issue`, `Release`, `Discussion`, `Commit`, … */
  type: string;
  repo: string;
  /** The issue/PR number, when the subject has one. */
  number: number | null;
  htmlUrl: string;
};

type RawIssue = {
  number?: number;
  node_id?: string;
  title?: string;
  state?: string;
  body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  comments?: number;
  html_url?: string;
  locked?: boolean;
  user?: { login?: string };
  labels?: ({ name?: string } | string)[];
  assignees?: { login?: string }[] | null;
  milestone?: { title?: string } | null;
  pull_request?: unknown;
};

function toIssue(raw: RawIssue): IssueSummary {
  return {
    number: raw.number ?? 0,
    title: raw.title ?? '(untitled)',
    state: raw.state === 'closed' ? 'closed' : 'open',
    body: raw.body ?? '',
    author: raw.user?.login ?? 'unknown',
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    comments: raw.comments ?? 0,
    labels: (raw.labels ?? [])
      .map((label) => (typeof label === 'string' ? label : (label.name ?? '')))
      .filter(Boolean),
    assignees: (raw.assignees ?? []).map((assignee) => assignee.login ?? '').filter(Boolean),
    htmlUrl: raw.html_url ?? '',
    isPullRequest: raw.pull_request !== undefined && raw.pull_request !== null,
  };
}

// ───────────────────────────── reads ─────────────────────────────

export async function listIssues(
  token: string,
  repo: string,
  state: IssueState | 'all' = 'open',
  limit = 20,
): Promise<IssueSummary[]> {
  const { value } = await githubRequest<RawIssue[]>(
    `/repos/${repo}/issues?state=${state}&sort=updated&direction=desc&per_page=${limit}`,
    token,
  );
  return (Array.isArray(value) ? value : []).map(toIssue);
}

export async function getIssue(
  token: string,
  repo: string,
  number: number,
): Promise<IssueDetail> {
  const { value } = await githubRequest<RawIssue>(`/repos/${repo}/issues/${number}`, token);
  if (!value?.number) throw new GithubError('not-found', 'That issue does not exist.');
  return {
    ...toIssue(value),
    nodeId: value.node_id ?? '',
    locked: value.locked === true,
    milestone: value.milestone?.title ?? null,
    closedAt: value.closed_at ?? null,
  };
}

export async function listIssueComments(
  token: string,
  repo: string,
  number: number,
): Promise<IssueComment[]> {
  const { value } = await githubRequest<
    { id?: number; user?: { login?: string }; body?: string; created_at?: string; html_url?: string }[]
  >(`/repos/${repo}/issues/${number}/comments?per_page=50`, token);

  return (Array.isArray(value) ? value : []).map((comment) => ({
    id: comment.id ?? 0,
    author: comment.user?.login ?? 'unknown',
    body: comment.body ?? '',
    createdAt: comment.created_at ?? null,
    htmlUrl: comment.html_url ?? '',
    state: null,
  }));
}

export async function listLabels(token: string, repo: string): Promise<Label[]> {
  const { value } = await githubRequest<{ name?: string; description?: string | null }[]>(
    `/repos/${repo}/labels?per_page=100`,
    token,
  );
  return (Array.isArray(value) ? value : [])
    .map((label) => ({ name: label.name ?? '', description: label.description ?? null }))
    .filter((label) => label.name.length > 0);
}

export async function listAssignableUsers(token: string, repo: string): Promise<string[]> {
  const { value } = await githubRequest<{ login?: string }[]>(
    `/repos/${repo}/assignees?per_page=50`,
    token,
  );
  return (Array.isArray(value) ? value : []).map((user) => user.login ?? '').filter(Boolean);
}

// ───────────────────────────── writes ─────────────────────────────

export async function createIssue(
  token: string,
  options: { repo: string; title: string; body?: string; labels?: string[]; assignees?: string[] },
): Promise<IssueSummary> {
  const title = options.title.trim();
  if (!title) throw new GithubError('validation', 'An issue needs a title.');

  const { value } = await githubRequest<RawIssue>(`/repos/${options.repo}/issues`, token, {
    method: 'POST',
    body: {
      title,
      ...(options.body ? { body: options.body } : {}),
      ...(options.labels?.length ? { labels: options.labels } : {}),
      ...(options.assignees?.length ? { assignees: options.assignees } : {}),
    },
  });
  return toIssue(value ?? {});
}

export async function addIssueComment(
  token: string,
  options: { repo: string; number: number; body: string },
): Promise<IssueComment> {
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

/** Close, reopen, relabel, reassign — all one `PATCH` on the issue. */
export async function updateIssue(
  token: string,
  options: {
    repo: string;
    number: number;
    state?: IssueState;
    title?: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (options.state !== undefined) body.state = options.state;
  if (options.title !== undefined) body.title = options.title;
  if (options.body !== undefined) body.body = options.body;
  if (options.labels !== undefined) body.labels = options.labels;
  if (options.assignees !== undefined) body.assignees = options.assignees;

  await githubRequest(`/repos/${options.repo}/issues/${options.number}`, token, {
    method: 'PATCH',
    body,
  });
}

// ───────────────────────────── notifications ─────────────────────────────

export async function listNotifications(token: string): Promise<Notification[]> {
  const { value } = await githubRequest<
    {
      id?: string;
      unread?: boolean;
      reason?: string;
      updated_at?: string | null;
      subject?: { title?: string; type?: string; url?: string | null };
      repository?: { full_name?: string };
    }[]
  >('/notifications?all=false&participating=false&per_page=50', token);

  return (Array.isArray(value) ? value : [])
    .map((entry) => {
      // The API's subject.url is an API URL; the human URL is the same path.
      const apiUrl = entry.subject?.url ?? '';
      const htmlUrl = apiUrl
        ? apiUrl.replace('https://api.github.com/repos/', 'https://github.com/')
        : `https://github.com/${entry.repository?.full_name ?? ''}/notifications`;
      const match = /\/issues\/(\d+)|\/pulls\/(\d+)/.exec(apiUrl);
      const number = match ? Number(match[1] ?? match[2]) : null;

      return {
        id: entry.id ?? '',
        unread: entry.unread === true,
        reason: entry.reason ?? 'subscribed',
        updatedAt: entry.updated_at ?? null,
        title: entry.subject?.title ?? '(untitled)',
        type: entry.subject?.type ?? 'Issue',
        repo: entry.repository?.full_name ?? '',
        number: Number.isFinite(number) ? number : null,
        htmlUrl,
      };
    })
    .filter((entry) => entry.id.length > 0);
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await githubRequest(`/notifications/threads/${id}`, token, { method: 'PATCH' });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await githubRequest('/notifications', token, { method: 'PUT', body: { last_read_at: new Date().toISOString() } });
}

/**
 * Notification reasons are API slugs (`review_requested`, `state_change`). The
 * screen shows words, so they are translated here once.
 */
export function notificationReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    assign: 'assigned to you',
    author: 'you wrote it',
    ci_activity: 'CI on your run',
    comment: 'a new comment',
    invitation: 'an invitation',
    manual: 'you subscribed',
    mention: 'you were mentioned',
    review_requested: 'review wanted',
    security_alert: 'a security alert',
    state_change: 'a state change',
    subscribed: 'you are watching',
    team_mention: 'your team was mentioned',
  };
  return labels[reason] ?? reason.replace(/_/g, ' ');
}
