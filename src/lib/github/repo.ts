/**
 * Repositories and their contents: reading files, and writing them back.
 *
 * The write path is the reason this module exists. A dashboard that can only
 * look is a window; a file you can fix from the tablet is the actual feature.
 * Two ways to write, and the choice is confidence, not convenience:
 *
 *  - `commitFile` — the Contents API, one file, one commit. GitHub does the
 *    tree work. It demands the *current* blob `sha`, which is also what makes it
 *    safe: if the file changed under us, GitHub answers `409` instead of
 *    clobbering someone's edit.
 *  - `commitFiles` — the Git Data API: blobs → tree → commit → move the ref, so
 *    four files land as **one** commit or not at all. Nothing is half-applied.
 *
 * ADR-020 bounds both: the commit message is always required, the branch is
 * always explicit, and nothing here can force a ref or delete one without the
 * caller asking for exactly that in words.
 */
import {
  type GithubRate,
  githubRequest,
  splitRepo,
  GithubError,
} from './api';
import { base64ToBytes, bytesToBase64, bytesToUtf8, looksBinary, utf8ToBytes } from '@/lib/base64';

/** A file this app will not pull into memory as text (≈8 MB of base64 + copy). */
const MAX_EDITABLE_BYTES = 400_000;
const CHILD_LIMIT = 100;

// ───────────────────────────── shapes ─────────────────────────────

export type RepoDetail = {
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  htmlUrl: string;
  /** What this token may do here — the honest answer to "can I edit?". */
  canPush: boolean;
  canAdmin: boolean;
  topics: string[];
  license: string | null;
  /** True when GitHub is still computing something about the repo. */
  archived: boolean;
};

export type TreeEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'submodule' | 'symlink';
  size: number | null;
  sha: string;
};

export type FileContent = {
  path: string;
  /** The blob sha at this ref — required to update the file later. */
  sha: string;
  name: string;
  text: string;
  size: number;
  isBinary: boolean;
  /** Too large (or too binary) to open in the editor; metadata only. */
  tooBig: boolean;
  htmlUrl: string;
};

export type Branch = {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
};

export type CommitSummary = {
  sha: string;
  shortSha: string;
  message: string;
  firstLine: string;
  author: string;
  authorLogin: string | null;
  date: string | null;
  htmlUrl: string;
};

export type Release = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string | null;
  htmlUrl: string;
};

export type CommitResult = {
  commitSha: string;
  htmlUrl: string;
  /** `compare` is GitHub's own view of what the commit changed. */
  changedFiles: number;
};

// ───────────────────────────── raw shapes ─────────────────────────────

type RawRepo = {
  full_name?: string;
  name?: string;
  owner?: { login?: string };
  description?: string | null;
  private?: boolean;
  default_branch?: string;
  language?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  pushed_at?: string | null;
  html_url?: string;
  archived?: boolean;
  topics?: string[];
  license?: { spdx_id?: string | null; name?: string | null } | null;
  permissions?: { push?: boolean; admin?: boolean; pull?: boolean };
};

type RawEntry = {
  name?: string;
  path?: string;
  type?: string;
  size?: number;
  sha?: string;
};

type RawContent = RawEntry & {
  content?: string;
  encoding?: string;
  html_url?: string;
};

type RawBranch = { name?: string; sha?: string; protected?: boolean; commit?: { sha?: string } };

type RawCommit = {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string } | null;
  };
  author?: { login?: string } | null;
};

// ───────────────────────────── helpers ─────────────────────────────

/** Keep `/` — it separates path segments, and GitHub reads it that way. */
function encodePath(path: string): string {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function toRepoDetail(raw: RawRepo): RepoDetail {
  const fullName = raw.full_name ?? '';
  const split = splitRepo(fullName);
  return {
    fullName,
    owner: raw.owner?.login ?? split.owner,
    name: raw.name ?? split.name,
    description: raw.description ?? null,
    isPrivate: raw.private === true,
    defaultBranch: raw.default_branch ?? 'main',
    language: raw.language ?? null,
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    pushedAt: raw.pushed_at ?? null,
    htmlUrl: raw.html_url ?? `https://github.com/${fullName}`,
    canPush: raw.permissions?.push === true,
    canAdmin: raw.permissions?.admin === true,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    license: raw.license?.spdx_id ?? raw.license?.name ?? null,
    archived: raw.archived === true,
  };
}

function toCommitSummary(raw: RawCommit): CommitSummary {
  const sha = raw.sha ?? '';
  const message = raw.commit?.message ?? '';
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    firstLine: message.split('\n')[0] ?? '',
    author: raw.commit?.author?.name ?? raw.author?.login ?? 'unknown',
    authorLogin: raw.author?.login ?? null,
    date: raw.commit?.author?.date ?? null,
    htmlUrl: raw.html_url ?? '',
  };
}

// ───────────────────────────── reads ─────────────────────────────

export async function getRepoDetail(token: string, fullName: string): Promise<RepoDetail> {
  const { value } = await githubRequest<RawRepo>(`/repos/${fullName}`, token);
  if (!value?.full_name) {
    throw new GithubError('not-found', 'GitHub would not describe that repository.');
  }
  return toRepoDetail(value);
}

/** A directory listing, folders first — how every file browser reads. */
export async function listDirectory(
  token: string,
  fullName: string,
  path: string,
  ref?: string,
): Promise<TreeEntry[]> {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const encoded = encodePath(path);
  const endpoint = encoded
    ? `/repos/${fullName}/contents/${encoded}${suffix}`
    : `/repos/${fullName}/contents${suffix}`;

  const { value } = await githubRequest<RawEntry[]>(endpoint, token);
  const entries = Array.isArray(value) ? value : [];
  return entries
    .map((entry) => ({
      name: entry.name ?? '',
      path: entry.path ?? entry.name ?? '',
      type: (entry.type === 'dir' || entry.type === 'submodule' || entry.type === 'symlink'
        ? entry.type
        : 'file') as TreeEntry['type'],
      size: typeof entry.size === 'number' ? entry.size : null,
      sha: entry.sha ?? '',
    }))
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) => {
      const aDir = a.type === 'dir' ? 0 : 1;
      const bDir = b.type === 'dir' ? 0 : 1;
      if (aDir !== bDir) return aDir - bDir;
      return a.name.localeCompare(b.name);
    })
    .slice(0, CHILD_LIMIT);
}

/**
 * One file, as text — or as the honest reason it is not text. The API hands back
 * base64 for anything under 1 MB and *nothing* above it, so a bigger file is
 * re-requested with the `raw` media type; past `MAX_EDITABLE_BYTES` the caller
 * gets metadata and `tooBig`, because opening a 40 MB lockfile in a TextInput is
 * not an edit, it is a freeze.
 */
export async function readFile(
  token: string,
  fullName: string,
  path: string,
  ref?: string,
): Promise<FileContent> {
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const endpoint = `/repos/${fullName}/contents/${encodePath(path)}${suffix}`;

  const { value } = await githubRequest<RawContent | RawContent[]>(endpoint, token);
  const meta = Array.isArray(value) ? value[0] : value;
  if (!meta?.path) {
    throw new GithubError('not-found', `GitHub has no file at ${path}.`);
  }

  const base = {
    path: meta.path,
    sha: meta.sha ?? '',
    name: meta.name ?? path.split('/').pop() ?? path,
    size: typeof meta.size === 'number' ? meta.size : 0,
    htmlUrl: meta.html_url ?? `https://github.com/${fullName}/blob/${ref ?? 'HEAD'}/${path}`,
  };

  if (meta.encoding === 'base64' && meta.content) {
    const bytes = base64ToBytes(meta.content);
    const isBinary = looksBinary(bytes);
    return {
      ...base,
      text: isBinary ? '' : bytesToUtf8(bytes),
      isBinary,
      tooBig: isBinary && base.size > MAX_EDITABLE_BYTES,
    };
  }

  if (base.size > MAX_EDITABLE_BYTES) {
    return { ...base, text: '', isBinary: false, tooBig: true };
  }

  // 1–100 MB, or `encoding: "none"`: ask for the bytes directly.
  const { value: raw } = await githubRequest<string>(endpoint, token, {
    accept: 'application/vnd.github.raw',
    parse: 'text',
  });
  const text = typeof raw === 'string' ? raw : '';
  const isBinary = looksBinary(utf8ToBytes(text));
  return { ...base, text: isBinary ? '' : text, isBinary, tooBig: false };
}

export async function listBranches(
  token: string,
  fullName: string,
  defaultBranch?: string,
): Promise<Branch[]> {
  const { value } = await githubRequest<RawBranch[]>(
    `/repos/${fullName}/branches?per_page=100`,
    token,
  );
  const branches = Array.isArray(value) ? value : [];
  return branches.map((branch) => ({
    name: branch.name ?? '',
    sha: branch.commit?.sha ?? branch.sha ?? '',
    isDefault: defaultBranch ? branch.name === defaultBranch : false,
    isProtected: branch.protected === true,
  }));
}

export async function listCommits(
  token: string,
  fullName: string,
  options: { ref?: string; path?: string; limit?: number } = {},
): Promise<CommitSummary[]> {
  const params = [`per_page=${options.limit ?? 15}`];
  if (options.ref) params.push(`sha=${encodeURIComponent(options.ref)}`);
  if (options.path) params.push(`path=${encodeURIComponent(options.path)}`);

  const { value } = await githubRequest<RawCommit[]>(
    `/repos/${fullName}/commits?${params.join('&')}`,
    token,
  );
  const commits = Array.isArray(value) ? value : [];
  return commits.map(toCommitSummary);
}

export async function listReleases(token: string, fullName: string): Promise<Release[]> {
  const { value } = await githubRequest<
    {
      id?: number;
      tag_name?: string;
      name?: string | null;
      body?: string | null;
      draft?: boolean;
      prerelease?: boolean;
      created_at?: string | null;
      html_url?: string;
    }[]
  >(`/repos/${fullName}/releases?per_page=10`, token);

  return (Array.isArray(value) ? value : []).map((release) => ({
    id: release.id ?? 0,
    tagName: release.tag_name ?? '',
    name: release.name ?? release.tag_name ?? '',
    body: release.body ?? '',
    draft: release.draft === true,
    prerelease: release.prerelease === true,
    createdAt: release.created_at ?? null,
    htmlUrl: release.html_url ?? '',
  }));
}

// ───────────────────────────── writes ─────────────────────────────

/**
 * One file, one commit, through the Contents API.
 *
 * `sha` is the blob we read. Pass it and a stale edit fails loudly (409) instead
 * of overwriting; omit it and the file must not exist yet.
 */
export async function commitFile(
  token: string,
  options: {
    repo: string;
    path: string;
    content: string;
    message: string;
    branch: string;
    /** Current blob sha for an update; omit for a new file. */
    sha?: string;
  },
): Promise<CommitResult> {
  const { value } = await githubRequest<{
    commit?: { sha?: string; html_url?: string };
    content?: { html_url?: string };
  }>(`/repos/${options.repo}/contents/${encodePath(options.path)}`, token, {
    method: 'PUT',
    body: {
      message: options.message,
      content: bytesToBase64(utf8ToBytes(options.content)),
      branch: options.branch,
      ...(options.sha ? { sha: options.sha } : {}),
    },
  });

  return {
    commitSha: value?.commit?.sha ?? '',
    htmlUrl: value?.commit?.html_url ?? value?.content?.html_url ?? '',
    changedFiles: 1,
  };
}

/**
 * Many files, one commit, or nothing at all — blobs → tree → commit → ref.
 *
 * The ref is updated with `PATCH` and no `force`, so a branch that moved while
 * the editor was open refuses the push rather than discarding the commits that
 * arrived in between.
 */
export async function commitFiles(
  token: string,
  options: {
    repo: string;
    branch: string;
    message: string;
    /** Text files to write. `sha: null` in a tree entry deletes the path. */
    files: { path: string; content: string }[];
    /** Paths to remove in the same commit. */
    deletes?: string[];
  },
): Promise<CommitResult> {
  const { files, deletes = [], repo, branch, message } = options;
  if (files.length === 0 && deletes.length === 0) {
    throw new GithubError('validation', 'There is nothing to commit.');
  }

  // 1. Where is the branch now?
  const { value: ref } = await githubRequest<{ object?: { sha?: string } }>(
    `/repos/${repo}/git/ref/heads/${branch}`,
    token,
  );
  const parentSha = ref?.object?.sha;
  if (!parentSha) throw new GithubError('not-found', `That branch (${branch}) does not exist.`);

  // 2. The tree it points at, so untouched files stay untouched.
  const { value: parentCommit } = await githubRequest<{ tree?: { sha?: string } }>(
    `/repos/${repo}/git/commits/${parentSha}`,
    token,
  );
  const baseTree = parentCommit?.tree?.sha;
  if (!baseTree) throw new GithubError('unknown', 'GitHub would not describe that commit.');

  // 3. One blob per file. These are independent, so they go out together.
  const blobs = await Promise.all(
    files.map(async (file) => {
      const { value } = await githubRequest<{ sha?: string }>(`/repos/${repo}/git/blobs`, token, {
        method: 'POST',
        body: { content: bytesToBase64(utf8ToBytes(file.content)), encoding: 'base64' },
      });
      if (!value?.sha) throw new GithubError('unknown', `GitHub refused the blob for ${file.path}.`);
      return { path: file.path, sha: value.sha };
    }),
  );

  // 4. One tree: the new blobs, plus a null sha for anything being removed.
  const { value: tree } = await githubRequest<{ sha?: string }>(`/repos/${repo}/git/trees`, token, {
    method: 'POST',
    body: {
      base_tree: baseTree,
      tree: [
        ...blobs.map((blob) => ({
          path: blob.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        })),
        ...deletes.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
      ],
    },
  });
  if (!tree?.sha) throw new GithubError('unknown', 'GitHub refused the tree.');

  // 5. The commit.
  const { value: commit } = await githubRequest<{ sha?: string; html_url?: string }>(
    `/repos/${repo}/git/commits`,
    token,
    { method: 'POST', body: { message, tree: tree.sha, parents: [parentSha] } },
  );
  if (!commit?.sha) throw new GithubError('unknown', 'GitHub refused the commit.');

  // 6. Move the branch — without force, so a moved ref is a refusal.
  await githubRequest(`/repos/${repo}/git/refs/heads/${branch}`, token, {
    method: 'PATCH',
    body: { sha: commit.sha },
  });

  return {
    commitSha: commit.sha,
    htmlUrl: commit.html_url ?? `https://github.com/${repo}/commit/${commit.sha}`,
    changedFiles: files.length + deletes.length,
  };
}

export async function createBranch(
  token: string,
  options: { repo: string; name: string; fromSha: string },
): Promise<Branch> {
  const { value } = await githubRequest<{ ref?: string; object?: { sha?: string } }>(
    `/repos/${options.repo}/git/refs`,
    token,
    { method: 'POST', body: { ref: `refs/heads/${options.name}`, sha: options.fromSha } },
  );
  return {
    name: (value?.ref ?? `refs/heads/${options.name}`).replace('refs/heads/', ''),
    sha: value?.object?.sha ?? options.fromSha,
    isDefault: false,
    isProtected: false,
  };
}

export async function createRelease(
  token: string,
  options: {
    repo: string;
    tagName: string;
    name?: string;
    body?: string;
    targetCommitish?: string;
    draft?: boolean;
    prerelease?: boolean;
    /** Ask GitHub to write the notes from the merged pull requests. */
    generateNotes?: boolean;
  },
): Promise<Release> {
  const { value } = await githubRequest<{
    id?: number;
    tag_name?: string;
    name?: string | null;
    body?: string | null;
    draft?: boolean;
    prerelease?: boolean;
    created_at?: string | null;
    html_url?: string;
  }>(`/repos/${options.repo}/releases`, token, {
    method: 'POST',
    body: {
      tag_name: options.tagName,
      ...(options.name ? { name: options.name } : {}),
      ...(options.body ? { body: options.body } : {}),
      ...(options.targetCommitish ? { target_commitish: options.targetCommitish } : {}),
      draft: options.draft ?? false,
      prerelease: options.prerelease ?? false,
      generate_release_notes: options.generateNotes ?? false,
    },
  });

  return {
    id: value?.id ?? 0,
    tagName: value?.tag_name ?? options.tagName,
    name: value?.name ?? options.tagName,
    body: value?.body ?? '',
    draft: value?.draft === true,
    prerelease: value?.prerelease === true,
    createdAt: value?.created_at ?? null,
    htmlUrl: value?.html_url ?? '',
  };
}

/** Exposed so a screen can show the rate it just spent, not a stale one. */
export type { GithubRate };
