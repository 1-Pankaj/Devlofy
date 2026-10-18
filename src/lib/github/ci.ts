/**
 * GitHub Actions: which workflow ran, how it went, and the three things worth
 * doing from a tablet — re-run it, cancel it, or start one.
 *
 * Dispatch is the interesting one. `POST …/workflows/{id}/dispatches` answers
 * `204`, which means *accepted*, not *started*: nothing comes back, and the run
 * takes a few seconds to appear. So `dispatchWorkflow` resolves with nothing and
 * the screen says exactly that, instead of pretending a run exists and showing a
 * spinner over an empty list.
 *
 * The workflow must declare `workflow_dispatch` in its trigger block or GitHub
 * answers `422`; that sentence is passed through verbatim, because it is the
 * only thing that tells the user what to change.
 */
import { GithubError, githubRequest } from './api';

export type RunState = 'queued' | 'running' | 'passing' | 'failing' | 'cancelled' | 'skipped' | 'neutral';

export type Workflow = {
  id: number;
  name: string;
  path: string;
  state: string;
  /** Whether GitHub will accept a manual dispatch for it. */
  dispatchable: boolean;
};

export type WorkflowRun = {
  id: number;
  name: string;
  runNumber: number;
  event: string;
  branch: string | null;
  state: RunState;
  status: string | null;
  conclusion: string | null;
  actor: string;
  createdAt: string | null;
  updatedAt: string | null;
  htmlUrl: string;
  headSha: string;
  attempt: number;
  /** The newest run for a workflow is the only one whose status is interesting. */
  workflowId: number;
};

export type RunJob = {
  id: number;
  name: string;
  state: RunState;
  startedAt: string | null;
  completedAt: string | null;
  steps: { name: string; state: RunState }[];
};

export type RunDetail = WorkflowRun & {
  jobs: RunJob[];
  /** 0 while GitHub is still counting. */
  jobCount: number;
};

type RawRun = {
  id?: number;
  name?: string | null;
  run_number?: number;
  event?: string;
  head_branch?: string | null;
  status?: string | null;
  conclusion?: string | null;
  actor?: { login?: string };
  created_at?: string | null;
  updated_at?: string | null;
  html_url?: string;
  head_sha?: string;
  run_attempt?: number;
  workflow_id?: number;
  jobs?: {
    id?: number;
    name?: string;
    status?: string | null;
    conclusion?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    steps?: { name?: string; status?: string | null; conclusion?: string | null }[];
  }[];
};

function runState(status: string | null | undefined, conclusion: string | null | undefined): RunState {
  if (status && status !== 'completed') {
    return status === 'queued' || status === 'requested' || status === 'waiting' || status === 'pending'
      ? 'queued'
      : 'running';
  }
  switch (conclusion) {
    case 'success':
      return 'passing';
    case 'failure':
    case 'timed_out':
    case 'action_required':
    case 'startup_failure':
      return 'failing';
    case 'cancelled':
      return 'cancelled';
    case 'skipped':
      return 'skipped';
    default:
      return 'neutral';
  }
}

function toRun(raw: RawRun): WorkflowRun {
  return {
    id: raw.id ?? 0,
    name: raw.name ?? 'workflow',
    runNumber: raw.run_number ?? 0,
    event: raw.event ?? '',
    branch: raw.head_branch ?? null,
    state: runState(raw.status, raw.conclusion),
    status: raw.status ?? null,
    conclusion: raw.conclusion ?? null,
    actor: raw.actor?.login ?? 'unknown',
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    htmlUrl: raw.html_url ?? '',
    headSha: raw.head_sha ?? '',
    attempt: raw.run_attempt ?? 1,
    workflowId: raw.workflow_id ?? 0,
  };
}

// ───────────────────────────── reads ─────────────────────────────

export async function listWorkflows(token: string, repo: string): Promise<Workflow[]> {
  const { value } = await githubRequest<{
    workflows?: { id?: number; name?: string; path?: string; state?: string }[];
  }>(`/repos/${repo}/actions/workflows?per_page=50`, token);

  // Whether a workflow accepts a manual dispatch is not in this response — it
  // depends on `on: workflow_dispatch` inside the file. So every active workflow
  // is offered and GitHub's own `422` explains a refusal, in its own words.
  return (value?.workflows ?? []).map((workflow) => ({
    id: workflow.id ?? 0,
    name: workflow.name ?? 'workflow',
    path: workflow.path ?? '',
    state: workflow.state ?? 'active',
    dispatchable: (workflow.state ?? 'active') !== 'disabled_manually',
  }));
}

export async function listRuns(
  token: string,
  repo: string,
  options: { workflowId?: number; branch?: string; limit?: number } = {},
): Promise<WorkflowRun[]> {
  const params = [`per_page=${options.limit ?? 15}`];
  if (options.branch) params.push(`branch=${encodeURIComponent(options.branch)}`);

  const endpoint = options.workflowId
    ? `/repos/${repo}/actions/workflows/${options.workflowId}/runs?${params.join('&')}`
    : `/repos/${repo}/actions/runs?${params.join('&')}`;

  const { value } = await githubRequest<{ workflow_runs?: RawRun[] }>(endpoint, token);
  return (value?.workflow_runs ?? []).map(toRun);
}

export async function getRun(token: string, repo: string, runId: number): Promise<RunDetail> {
  const [{ value: run }, jobs] = await Promise.all([
    githubRequest<RawRun>(`/repos/${repo}/actions/runs/${runId}`, token),
    githubRequest<{ jobs?: RawRun['jobs'] }>(
      `/repos/${repo}/actions/runs/${runId}/jobs?per_page=50`,
      token,
    ).catch(() => null),
  ]);

  if (!run?.id) throw new GithubError('not-found', 'That run does not exist.');

  const base = toRun(run);
  const rows: RunJob[] = (jobs?.value?.jobs ?? []).map((job) => ({
    id: job.id ?? 0,
    name: job.name ?? 'job',
    state: runState(job.status, job.conclusion),
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    steps: (job.steps ?? []).map((step) => ({
      name: step.name ?? 'step',
      state: runState(step.status, step.conclusion),
    })),
  }));

  return { ...base, jobs: rows, jobCount: rows.length };
}

// ───────────────────────────── writes ─────────────────────────────

export async function dispatchWorkflow(
  token: string,
  options: { repo: string; workflowId: number; ref: string; inputs?: Record<string, string> },
): Promise<void> {
  if (!options.ref.trim()) {
    throw new GithubError('validation', 'A dispatch needs a branch or tag to run on.');
  }
  await githubRequest(`/repos/${options.repo}/actions/workflows/${options.workflowId}/dispatches`, token, {
    method: 'POST',
    body: {
      ref: options.ref,
      ...(options.inputs && Object.keys(options.inputs).length > 0 ? { inputs: options.inputs } : {}),
    },
  });
}

export async function rerunRun(
  token: string,
  options: { repo: string; runId: number; failedOnly?: boolean },
): Promise<void> {
  const suffix = options.failedOnly ? 'rerun-failed-jobs' : 'rerun';
  await githubRequest(`/repos/${options.repo}/actions/runs/${options.runId}/${suffix}`, token, {
    method: 'POST',
  });
}

export async function cancelRun(
  token: string,
  options: { repo: string; runId: number },
): Promise<void> {
  await githubRequest(`/repos/${options.repo}/actions/runs/${options.runId}/cancel`, token, {
    method: 'POST',
  });
}
