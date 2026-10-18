/**
 * Typed repository over the local SQLite database. Every screen reads and
 * writes through these functions — no SQL in components.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { createId } from '../ids';
import { splitTags } from '../tags';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── Notes ───────────────────────────

export type NoteListRow = {
  id: string;
  title: string;
  preview: string;
  tags: string | null;
  client_name: string | null;
  project_name: string | null;
  pinned: number;
  updated_at: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  project_id: string | null;
  client_id: string | null;
  tags: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
};

export async function listNotes(db: SQLiteDatabase, search?: string): Promise<NoteListRow[]> {
  const query = search?.trim();
  if (query) {
    const like = `%${query}%`;
    return db.getAllAsync<NoteListRow>(
      `SELECT n.id, n.title, substr(n.body, 1, 140) AS preview, n.tags, n.pinned, n.updated_at,
              c.name AS client_name, p.name AS project_name
       FROM notes n
       LEFT JOIN clients c ON c.id = n.client_id AND c.deleted_at IS NULL
       LEFT JOIN projects p ON p.id = n.project_id AND p.deleted_at IS NULL
       WHERE n.deleted_at IS NULL AND (n.title LIKE ? OR n.body LIKE ? OR n.tags LIKE ?)
       ORDER BY n.pinned DESC, n.updated_at DESC`,
      [like, like, like],
    );
  }
  return db.getAllAsync<NoteListRow>(
    `SELECT n.id, n.title, substr(n.body, 1, 140) AS preview, n.tags, n.pinned, n.updated_at,
            c.name AS client_name, p.name AS project_name
     FROM notes n
     LEFT JOIN clients c ON c.id = n.client_id AND c.deleted_at IS NULL
     LEFT JOIN projects p ON p.id = n.project_id AND p.deleted_at IS NULL
     WHERE n.deleted_at IS NULL
     ORDER BY n.pinned DESC, n.updated_at DESC`,
  );
}

export async function getNote(db: SQLiteDatabase, id: string): Promise<Note | null> {
  return db.getFirstAsync<Note>(
    'SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
}

export async function createNote(db: SQLiteDatabase): Promise<string> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO notes (id, title, body, created_at, updated_at)
     VALUES (?, 'Untitled note', '', ?, ?)`,
    [id, now, now],
  );
  return id;
}

export async function updateNote(
  db: SQLiteDatabase,
  id: string,
  patch: {
    title?: string;
    body?: string;
    pinned?: boolean;
    tags?: string | null;
    client_id?: string | null;
    project_id?: string | null;
  },
) {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.body !== undefined) {
    sets.push('body = ?');
    params.push(patch.body);
  }
  if (patch.pinned !== undefined) {
    sets.push('pinned = ?');
    params.push(patch.pinned ? 1 : 0);
  }
  if (patch.tags !== undefined) {
    sets.push('tags = ?');
    params.push(patch.tags);
  }
  if (patch.client_id !== undefined) {
    sets.push('client_id = ?');
    params.push(patch.client_id);
  }
  if (patch.project_id !== undefined) {
    sets.push('project_id = ?');
    params.push(patch.project_id);
  }
  if (sets.length === 0) return;
  params.push(nowIso(), id);
  await db.runAsync(`UPDATE notes SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, params);
}

export async function deleteNote(db: SQLiteDatabase, id: string) {
  const now = nowIso();
  await db.runAsync('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

/** Every tag in use across live notes — feeds the tag editor's suggestions. */
export async function listExistingTags(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ tags: string }>(
    `SELECT tags FROM notes WHERE deleted_at IS NULL AND tags IS NOT NULL AND tags != ''`,
  );
  const seen = new Set<string>();
  for (const row of rows) {
    for (const tag of splitTags(row.tags)) seen.add(tag);
  }
  return [...seen].sort();
}

// ─────────────────────────── Clients ───────────────────────────

export type ClientRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  hourly_rate: number | null;
  project_count: number;
};

export async function listClients(db: SQLiteDatabase): Promise<ClientRow[]> {
  return db.getAllAsync<ClientRow>(
    `SELECT c.id, c.name, c.company, c.email, c.status, c.hourly_rate,
            (SELECT COUNT(*) FROM projects p
              WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS project_count
     FROM clients c
     WHERE c.deleted_at IS NULL
     ORDER BY c.name COLLATE NOCASE ASC`,
  );
}

export async function createClient(
  db: SQLiteDatabase,
  input: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    notes?: string;
    status?: string;
    hourlyRate?: number | null;
  },
) {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO clients (id, name, company, email, phone, notes, status, hourly_rate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.company?.trim() || null,
      input.email?.trim() || null,
      input.phone?.trim() || null,
      input.notes?.trim() || null,
      input.status ?? 'lead',
      input.hourlyRate ?? null,
      now,
      now,
    ],
  );
  return id;
}

export async function updateClient(
  db: SQLiteDatabase,
  id: string,
  patch: {
    name?: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    status?: string;
    hourlyRate?: number | null;
  },
) {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const text = (value: string | null | undefined) => value?.trim() || null;
  if (patch.name !== undefined && patch.name.trim()) {
    sets.push('name = ?');
    params.push(patch.name.trim());
  }
  if (patch.company !== undefined) {
    sets.push('company = ?');
    params.push(text(patch.company));
  }
  if (patch.email !== undefined) {
    sets.push('email = ?');
    params.push(text(patch.email));
  }
  if (patch.phone !== undefined) {
    sets.push('phone = ?');
    params.push(text(patch.phone));
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?');
    params.push(text(patch.notes));
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.hourlyRate !== undefined) {
    sets.push('hourly_rate = ?');
    params.push(patch.hourlyRate);
  }
  if (sets.length === 0) return;

  // Setting a rate for the first time is the moment the client's past time
  // becomes billable ("typing a rate once prices the work you already did"),
  // but only blocks that were never deliberately taken off the bill — an
  // exclusion is a decision, and a later edit must not quietly reverse it.
  const wasUnrated =
    patch.hourlyRate != null
      ? (
          await db.getFirstAsync<{ hourly_rate: number | null }>(
            'SELECT hourly_rate FROM clients WHERE id = ?',
            [id],
          )
        )?.hourly_rate == null
      : false;

  params.push(nowIso(), id);
  await db.runAsync(`UPDATE clients SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, params);

  if (wasUnrated) {
    await backfillBillableSessionsForClient(db, id);
  }
}

/**
 * Mark a client's existing blocks billable, for projects that do not carry a
 * rate of their own (those inherit the client's) — the retrofit case.
 */
async function backfillBillableSessionsForClient(db: SQLiteDatabase, clientId: string) {
  await db.runAsync(
    `UPDATE sessions SET billable = 1, updated_at = ?
     WHERE billable = 0 AND deleted_at IS NULL
       AND project_id IN (SELECT id FROM projects WHERE client_id = ? AND hourly_rate IS NULL)`,
    [nowIso(), clientId],
  );
}

/** The same retrofit for a single project. */
async function backfillBillableSessionsForProject(db: SQLiteDatabase, projectId: string) {
  await db.runAsync(
    `UPDATE sessions SET billable = 1, updated_at = ?
     WHERE billable = 0 AND deleted_at IS NULL AND project_id = ?`,
    [nowIso(), projectId],
  );
}

export type ClientDetail = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  hourly_rate: number | null;
  created_at: string;
};

export async function getClient(db: SQLiteDatabase, id: string): Promise<ClientDetail | null> {
  return db.getFirstAsync<ClientDetail>(
    `SELECT id, name, company, email, phone, notes, status, hourly_rate, created_at
     FROM clients
     WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
}

export async function listClientProjects(
  db: SQLiteDatabase,
  clientId: string,
): Promise<ProjectRow[]> {
  return db.getAllAsync<ProjectRow>(
    `SELECT p.id, p.client_id, c.name AS client_name, c.hourly_rate AS client_rate,
            p.name, p.description, p.status,
            p.repo_url, p.stack_tags, p.due_date, p.hourly_rate,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) AS done_count,
            (SELECT COALESCE(SUM(s.minutes), 0) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS focus_minutes,
            (SELECT COALESCE(SUM(s.minutes), 0) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL AND s.billable = 1) AS billable_minutes,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS focus_sessions,
            (SELECT MAX(s.started_at) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS last_session_at
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.deleted_at IS NULL AND p.client_id = ?
     ORDER BY CASE p.status
                WHEN 'active' THEN 0
                WHEN 'maintenance' THEN 1
                WHEN 'planning' THEN 2
                ELSE 3
              END,
              p.due_date IS NULL, p.due_date ASC`,
    [clientId],
  );
}

export type ClientStats = {
  projects: number;
  activeProjects: number;
  tasks: number;
  doneTasks: number;
};

export async function getClientStats(db: SQLiteDatabase, clientId: string): Promise<ClientStats> {
  const row = await db.getFirstAsync<ClientStats>(
    `SELECT
       (SELECT COUNT(*) FROM projects p
         WHERE p.client_id = ? AND p.deleted_at IS NULL) AS projects,
       (SELECT COUNT(*) FROM projects p
         WHERE p.client_id = ? AND p.status = 'active' AND p.deleted_at IS NULL) AS activeProjects,
       (SELECT COUNT(*) FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE p.client_id = ? AND t.deleted_at IS NULL) AS tasks,
       (SELECT COUNT(*) FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE p.client_id = ? AND t.status = 'done' AND t.deleted_at IS NULL) AS doneTasks`,
    [clientId, clientId, clientId, clientId],
  );
  return row ?? { projects: 0, activeProjects: 0, tasks: 0, doneTasks: 0 };
}

// ─────────────────────────── Projects ───────────────────────────

export type ProjectRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  name: string;
  description: string | null;
  status: string;
  repo_url: string | null;
  stack_tags: string | null;
  due_date: string | null;
  /** Overrides the client's rate when set; both null = not billable. */
  hourly_rate: number | null;
  /** Falls back to this when the project has none. */
  client_rate: number | null;
  task_count: number;
  done_count: number;
  /** Minutes of finished focus sessions logged against this project. */
  focus_minutes: number;
  /** Of those, the minutes flagged billable. */
  billable_minutes: number;
  focus_sessions: number;
  last_session_at: string | null;
};

export type MilestoneRow = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  order_index: number;
};

export async function listProjects(db: SQLiteDatabase): Promise<ProjectRow[]> {
  return db.getAllAsync<ProjectRow>(
    `SELECT p.id, p.client_id, c.name AS client_name, c.hourly_rate AS client_rate,
            p.name, p.description, p.status,
            p.repo_url, p.stack_tags, p.due_date, p.hourly_rate,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) AS done_count,
            (SELECT COALESCE(SUM(s.minutes), 0) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS focus_minutes,
            (SELECT COALESCE(SUM(s.minutes), 0) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL AND s.billable = 1) AS billable_minutes,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS focus_sessions,
            (SELECT MAX(s.started_at) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS last_session_at
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.deleted_at IS NULL
     ORDER BY CASE p.status
                WHEN 'active' THEN 0
                WHEN 'maintenance' THEN 1
                WHEN 'planning' THEN 2
                ELSE 3
              END,
              p.due_date IS NULL, p.due_date ASC`,
  );
}

export async function getProject(db: SQLiteDatabase, id: string): Promise<ProjectRow | null> {
  return db.getFirstAsync<ProjectRow>(
    `SELECT p.id, p.client_id, c.name AS client_name, c.hourly_rate AS client_rate,
            p.name, p.description, p.status,
            p.repo_url, p.stack_tags, p.due_date, p.hourly_rate,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) AS done_count,
            (SELECT COALESCE(SUM(s.minutes), 0) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS focus_minutes,
            (SELECT COALESCE(SUM(s.minutes), 0) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL AND s.billable = 1) AS billable_minutes,
            (SELECT COUNT(*) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS focus_sessions,
            (SELECT MAX(s.started_at) FROM sessions s
              WHERE s.project_id = p.id AND s.minutes IS NOT NULL
                AND s.deleted_at IS NULL) AS last_session_at
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    [id],
  );
}

export async function listMilestones(db: SQLiteDatabase, projectId: string): Promise<MilestoneRow[]> {
  return db.getAllAsync<MilestoneRow>(
    `SELECT id, title, due_date, status, order_index
     FROM milestones
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY order_index ASC`,
    [projectId],
  );
}

export async function listProjectTasks(db: SQLiteDatabase, projectId: string): Promise<TaskRow[]> {
  return db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY status = 'done' ASC, priority DESC, created_at ASC`,
    [projectId],
  );
}

export async function createProject(
  db: SQLiteDatabase,
  input: {
    name: string;
    clientId?: string | null;
    dueDate?: string | null;
    description?: string;
    status?: string;
    repoUrl?: string;
    stackTags?: string;
    hourlyRate?: number | null;
  },
) {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO projects (id, client_id, name, description, status, repo_url, stack_tags, due_date, hourly_rate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.clientId ?? null,
      input.name.trim(),
      input.description?.trim() || null,
      input.status ?? 'active',
      input.repoUrl?.trim() || null,
      input.stackTags?.trim() || null,
      input.dueDate ?? null,
      input.hourlyRate ?? null,
      now,
      now,
    ],
  );
  return id;
}

export async function updateProject(
  db: SQLiteDatabase,
  id: string,
  patch: {
    name?: string;
    client_id?: string | null;
    description?: string | null;
    status?: string;
    repo_url?: string | null;
    stack_tags?: string | null;
    due_date?: string | null;
    hourly_rate?: number | null;
  },
) {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  const text = (value: string | null | undefined) => value?.trim() || null;
  if (patch.name !== undefined && patch.name.trim()) {
    sets.push('name = ?');
    params.push(patch.name.trim());
  }
  if (patch.client_id !== undefined) {
    sets.push('client_id = ?');
    params.push(patch.client_id);
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    params.push(text(patch.description));
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.repo_url !== undefined) {
    sets.push('repo_url = ?');
    params.push(text(patch.repo_url));
  }
  if (patch.stack_tags !== undefined) {
    sets.push('stack_tags = ?');
    params.push(text(patch.stack_tags));
  }
  if (patch.due_date !== undefined) {
    sets.push('due_date = ?');
    params.push(patch.due_date);
  }
  if (patch.hourly_rate !== undefined) {
    sets.push('hourly_rate = ?');
    params.push(patch.hourly_rate);
  }
  if (sets.length === 0) return;

  // Same retrofit as a client's: a rate typed for the first time makes the
  // project's existing blocks billable, without resurrecting any the user
  // deliberately excluded.
  const wasUnrated =
    patch.hourly_rate != null
      ? (
          await db.getFirstAsync<{ hourly_rate: number | null }>(
            'SELECT hourly_rate FROM projects WHERE id = ?',
            [id],
          )
        )?.hourly_rate == null
      : false;

  params.push(nowIso(), id);
  await db.runAsync(`UPDATE projects SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, params);

  if (wasUnrated) {
    await backfillBillableSessionsForProject(db, id);
  }
}

// ─────────────────────────── Tasks ───────────────────────────

export type TaskRow = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
  priority: number;
  energy: string;
  est_minutes: number | null;
  due_at: string | null;
  created_at: string;
  project_name?: string | null;
};

export async function listTodayTasks(db: SQLiteDatabase, limit = 8): Promise<TaskRow[]> {
  // The queue is a day view: dated work first, soonest first (overdue on top),
  // then the undated backlog by priority.
  return db.getAllAsync<TaskRow>(
    `SELECT t.*, p.name AS project_name
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.deleted_at IS NULL AND t.status != 'done'
     ORDER BY
       CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END,
       t.due_at ASC,
       t.priority DESC,
       t.created_at ASC
     LIMIT ?`,
    [limit],
  );
}

export async function createTask(
  db: SQLiteDatabase,
  input: {
    title: string;
    projectId?: string | null;
    priority?: number;
    estMinutes?: number | null;
    dueAt?: string | null;
  },
): Promise<string> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO tasks (id, project_id, title, status, priority, est_minutes, due_at, created_at, updated_at)
     VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId ?? null,
      input.title.trim(),
      input.priority ?? 1,
      input.estMinutes ?? null,
      input.dueAt ?? null,
      now,
      now,
    ],
  );
  return id;
}

export async function countDoneToday(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM tasks
     WHERE deleted_at IS NULL AND status = 'done'
       AND date(completed_at) = date('now')`,
  );
  return row?.count ?? 0;
}

export async function setTaskDone(db: SQLiteDatabase, id: string, done: boolean) {
  const now = nowIso();
  await db.runAsync(
    'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
    [done ? 'done' : 'todo', done ? now : null, now, id],
  );
}

// ─────────────────────────── Sessions ───────────────────────────

export type SessionRow = {
  id: string;
  kind: string;
  started_at: string;
  ended_at: string | null;
  minutes: number | null;
  note: string | null;
  task_id: string | null;
  project_id: string | null;
  project_name: string | null;
  billable: number;
  rate?: number | null;
};

/**
 * Start a focus session, optionally attributed to a project and/or a task.
 * Attribution is what makes the project page able to answer "how much time did
 * this actually take?" — and, if the project resolves to a rate, the block is
 * marked billable the moment it starts, so nothing has to be remembered later.
 */
export async function startFocusSession(
  db: SQLiteDatabase,
  projectId?: string | null,
  taskId?: string | null,
): Promise<string> {
  const id = createId();
  const now = nowIso();

  let billable = 0;
  if (projectId) {
    const rate = await resolveProjectRate(db, projectId);
    billable = rate === null ? 0 : 1;
  }

  await db.runAsync(
    `INSERT INTO sessions (id, task_id, project_id, kind, started_at, billable, created_at, updated_at)
     VALUES (?, ?, ?, 'focus', ?, ?, ?, ?)`,
    [id, taskId ?? null, projectId ?? null, now, billable, now, now],
  );
  return id;
}

/** The project's own rate, else its client's, else null (not billable). */
async function resolveProjectRate(
  db: SQLiteDatabase,
  projectId: string,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ rate: number | null }>(
    `SELECT COALESCE(p.hourly_rate, c.hourly_rate) AS rate
     FROM projects p
     LEFT JOIN clients c ON c.id = p.client_id
     WHERE p.id = ?`,
    [projectId],
  );
  return row?.rate ?? null;
}

export async function endFocusSession(db: SQLiteDatabase, id: string): Promise<number> {
  const row = await db.getFirstAsync<{ started_at: string }>(
    'SELECT started_at FROM sessions WHERE id = ?',
    [id],
  );
  const startedAt = row ? new Date(row.started_at).getTime() : Date.now();
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const now = nowIso();
  await db.runAsync(
    'UPDATE sessions SET ended_at = ?, minutes = ?, updated_at = ? WHERE id = ?',
    [now, minutes, now, id],
  );
  return minutes;
}

export async function getActiveSession(db: SQLiteDatabase): Promise<SessionRow | null> {
  return db.getFirstAsync<SessionRow>(
    `SELECT s.*, p.name AS project_name FROM sessions s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.kind = 'focus' AND s.ended_at IS NULL AND s.deleted_at IS NULL
     ORDER BY s.started_at DESC LIMIT 1`,
  );
}

export async function todayFocusMinutes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(minutes) AS total FROM sessions
     WHERE kind = 'focus' AND deleted_at IS NULL AND date(started_at) = date('now')`,
  );
  return row?.total ?? 0;
}

export async function totalFocusMinutes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(minutes) AS total FROM sessions
     WHERE kind = 'focus' AND deleted_at IS NULL AND minutes IS NOT NULL`,
  );
  return row?.total ?? 0;
}

export async function listRecentSessions(db: SQLiteDatabase, limit = 6): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>(
    `SELECT s.*, p.name AS project_name FROM sessions s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.kind = 'focus' AND s.deleted_at IS NULL AND s.minutes IS NOT NULL
     ORDER BY s.started_at DESC LIMIT ?`,
    [limit],
  );
}

export async function getFocusStreakDays(db: SQLiteDatabase): Promise<number> {
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT date(started_at) AS d FROM sessions
     WHERE kind = 'focus' AND deleted_at IS NULL AND minutes IS NOT NULL
     ORDER BY d DESC`,
  );
  if (rows.length === 0) return 0;

  const dayKey = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const days = new Set(rows.map((r) => r.d));
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let streak = 0;
  let cursor = days.has(dayKey(today)) ? today : days.has(dayKey(yesterday)) ? yesterday : null;
  while (cursor && days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export type DayFocus = { day: string; minutes: number; isToday: boolean };

/** Focus minutes per local day for the trailing window, zero-filled. */
export async function focusMinutesByDay(db: SQLiteDatabase, days = 7): Promise<DayFocus[]> {
  const dayKey = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const rows = await db.getAllAsync<{ started_at: string; minutes: number }>(
    `SELECT started_at, minutes FROM sessions
     WHERE kind = 'focus' AND deleted_at IS NULL AND minutes IS NOT NULL AND started_at >= ?`,
    [start.toISOString()],
  );

  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(new Date(row.started_at));
    buckets.set(key, (buckets.get(key) ?? 0) + (row.minutes ?? 0));
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dayKey(date);
    return { day: key, minutes: buckets.get(key) ?? 0, isToday: index === days - 1 };
  });
}

// ─────────────────────────── Stats ───────────────────────────

export type DataStats = {
  notes: number;
  projects: number;
  clients: number;
  sessions: number;
};

export async function getDataStats(db: SQLiteDatabase): Promise<DataStats> {
  const row = await db.getFirstAsync<DataStats>(
    `SELECT
       (SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL) AS notes,
       (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL) AS projects,
       (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL) AS clients,
       (SELECT COUNT(*) FROM sessions WHERE deleted_at IS NULL) AS sessions`,
  );
  return row ?? { notes: 0, projects: 0, clients: 0, sessions: 0 };
}

export async function exportAll(db: SQLiteDatabase) {
  // Every table the user owns. A new table must be added here in the same change
  // that creates it — the export promise is only as good as this list.
  const tables = [
    'clients',
    'projects',
    'milestones',
    'tasks',
    'sessions',
    'notes',
    'bench_snippets',
  ] as const;
  const dump: Record<string, unknown[]> = {};
  for (const table of tables) {
    dump[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  return {
    app: 'devlofy',
    // Bumped to 2 when `bench_snippets` joined the dump: a newer export carries a
    // table an older reader has never seen, and a format number is how it says so.
    version: 2,
    exported_at: nowIso(),
    data: dump,
  };
}

// ────────────────────────── The Engine (local analysis) ──────────────────────────
//
// Every input the Engine reads is *already* the product's own data: what you
// said matters (tasks), what you actually did (sessions), and where the time
// went (projects). No model, no network — just the user's own record, scored.

/**
 * The whole open backlog, not just today's page — the Engine ranks everything.
 * `listTodayTasks` stays for the Today list; this is for "what next?".
 */
export async function listOpenTasks(db: SQLiteDatabase, limit = 200): Promise<TaskRow[]> {
  return db.getAllAsync<TaskRow>(
    `SELECT t.*, p.name AS project_name
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.deleted_at IS NULL AND t.status != 'done'
     ORDER BY t.priority DESC, t.created_at ASC
     LIMIT ?`,
    [limit],
  );
}

/** Finished blocks since a date — the raw material for rhythm and drift. */
export async function listSessionsSince(
  db: SQLiteDatabase,
  sinceIso: string,
): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>(
    `SELECT s.*, p.name AS project_name FROM sessions s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.kind = 'focus' AND s.deleted_at IS NULL AND s.minutes IS NOT NULL
       AND s.started_at >= ?
     ORDER BY s.started_at DESC`,
    [sinceIso],
  );
}

export type EstimateSample = {
  task_id: string;
  title: string;
  est_minutes: number;
  actual_minutes: number;
  sessions: number;
};

/**
 * Where an estimate met reality: tasks that were estimated *and* actually
 * focused on. This is what lets the app say "you plan 45m, it takes 70m".
 */
export async function listEstimateSamples(
  db: SQLiteDatabase,
  limit = 60,
): Promise<EstimateSample[]> {
  return db.getAllAsync<EstimateSample>(
    `SELECT t.id AS task_id, t.title, t.est_minutes,
            SUM(s.minutes) AS actual_minutes, COUNT(*) AS sessions
     FROM sessions s
     JOIN tasks t ON t.id = s.task_id
     WHERE s.minutes IS NOT NULL AND s.deleted_at IS NULL
       AND t.deleted_at IS NULL AND t.est_minutes IS NOT NULL AND t.est_minutes > 0
     GROUP BY t.id
     ORDER BY MAX(s.started_at) DESC
     LIMIT ?`,
    [limit],
  );
}

// ─────────────────────────────── Money ───────────────────────────────

export type BillableSession = {
  id: string;
  started_at: string;
  minutes: number;
  billable: number;
  project_id: string | null;
  project_name: string | null;
  client_id: string | null;
  client_name: string | null;
  task_title: string | null;
  /** Project rate, else client rate. Null only for unattributed blocks. */
  rate: number | null;
};

/**
 * Every finished block in a window with its resolved rate — the invoice draft is
 * this list, grouped. Nothing is stored: a draft is a *view* of your own record,
 * so it can never go stale against the time it describes.
 */
export async function listSessionsInWindow(
  db: SQLiteDatabase,
  fromIso: string,
  toIso: string,
  clientId?: string | null,
): Promise<BillableSession[]> {
  const params: (string | null)[] = [fromIso, toIso];
  let clientFilter = '';
  if (clientId) {
    clientFilter = 'AND p.client_id = ?';
    params.push(clientId);
  }
  return db.getAllAsync<BillableSession>(
    `SELECT s.id, s.started_at, s.minutes, s.billable,
            s.project_id, p.name AS project_name,
            p.client_id, c.name AS client_name,
            t.title AS task_title,
            COALESCE(p.hourly_rate, c.hourly_rate) AS rate
     FROM sessions s
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN clients c ON c.id = p.client_id
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.kind = 'focus' AND s.deleted_at IS NULL AND s.minutes IS NOT NULL
       AND s.started_at >= ? AND s.started_at < ?
       ${clientFilter}
     ORDER BY s.started_at DESC`,
    params,
  );
}

/** Include or drop one block from the bill. */
export async function setSessionBillable(
  db: SQLiteDatabase,
  id: string,
  billable: boolean,
): Promise<void> {
  await db.runAsync('UPDATE sessions SET billable = ?, updated_at = ? WHERE id = ?', [
    billable ? 1 : 0,
    nowIso(),
    id,
  ]);
}

// ─────────────────────────────── Search ───────────────────────────────

export type SearchHit = {
  kind: 'project' | 'client' | 'note' | 'task';
  id: string;
  title: string;
  subtitle: string | null;
  /** Set for tasks: the project it belongs to, if any. */
  project_id?: string | null;
  /** Set for tasks: 1 when already done. */
  done?: number;
};

/**
 * One pass over everything the user has written. LIKE rather than FTS so the
 * same code path works on native and the wasm web build (ADR — FTS5 is native
 * only); the datasets are personal-sized, so it is instant either way.
 */
export async function searchEverything(
  db: SQLiteDatabase,
  rawQuery: string,
  perKind = 6,
): Promise<SearchHit[]> {
  // LIKE wildcards typed by the user would change the meaning of the query.
  const needle = rawQuery.trim().replace(/[%_]/g, '');
  if (needle.length < 2) return [];
  const like = `%${needle}%`;

  const [projects, clients, notes, tasks] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; client_name: string | null; status: string }>(
      `SELECT p.id, p.name, c.name AS client_name, p.status
       FROM projects p LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.deleted_at IS NULL AND (p.name LIKE ? OR p.description LIKE ? OR p.stack_tags LIKE ?)
       ORDER BY p.name COLLATE NOCASE ASC LIMIT ?`,
      [like, like, like, perKind],
    ),
    db.getAllAsync<{ id: string; name: string; company: string | null; status: string }>(
      `SELECT id, name, company, status FROM clients
       WHERE deleted_at IS NULL AND (name LIKE ? OR company LIKE ? OR email LIKE ? OR notes LIKE ?)
       ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
      [like, like, like, like, perKind],
    ),
    db.getAllAsync<{ id: string; title: string; body: string }>(
      `SELECT id, title, body FROM notes
       WHERE deleted_at IS NULL AND (title LIKE ? OR body LIKE ?)
       ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
      [like, like, perKind],
    ),
    db.getAllAsync<{ id: string; title: string; status: string; project_id: string | null; project_name: string | null }>(
      `SELECT t.id, t.title, t.status, t.project_id, p.name AS project_name
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.deleted_at IS NULL AND (t.title LIKE ? OR p.name LIKE ?)
       ORDER BY t.status = 'done' ASC, t.priority DESC LIMIT ?`,
      [like, like, perKind],
    ),
  ]);

  return [
    ...projects.map<SearchHit>((row) => ({
      kind: 'project',
      id: row.id,
      title: row.name,
      subtitle: row.client_name ?? row.status,
    })),
    ...clients.map<SearchHit>((row) => ({
      kind: 'client',
      id: row.id,
      title: row.name,
      subtitle: row.company ?? row.status,
    })),
    ...notes.map<SearchHit>((row) => ({
      kind: 'note',
      id: row.id,
      title: row.title || 'Untitled',
      subtitle: row.body.replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90) || null,
    })),
    ...tasks.map<SearchHit>((row) => ({
      kind: 'task',
      id: row.id,
      title: row.title,
      subtitle: row.project_name,
      project_id: row.project_id,
      done: row.status === 'done' ? 1 : 0,
    })),
  ];
}

// ─────────────────────────── Bench ───────────────────────────

export type SnippetRow = {
  id: string;
  tool: string;
  title: string;
  body: string;
  language: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Saved snippets, newest first. `search` is a plain LIKE over title and body —
 * the same bargain search makes everywhere else in this app ([[07-decisions]]
 * ADR-018), and enough at personal scale.
 */
export async function listSnippets(db: SQLiteDatabase, search?: string): Promise<SnippetRow[]> {
  const query = search?.trim();
  if (query) {
    const like = `%${query}%`;
    return db.getAllAsync<SnippetRow>(
      `SELECT id, tool, title, body, language, created_at, updated_at
       FROM bench_snippets
       WHERE deleted_at IS NULL AND (title LIKE ? OR body LIKE ?)
       ORDER BY updated_at DESC`,
      [like, like],
    );
  }
  return db.getAllAsync<SnippetRow>(
    `SELECT id, tool, title, body, language, created_at, updated_at
     FROM bench_snippets
     WHERE deleted_at IS NULL
     ORDER BY updated_at DESC`,
  );
}

export async function getSnippet(db: SQLiteDatabase, id: string): Promise<SnippetRow | null> {
  return db.getFirstAsync<SnippetRow>(
    'SELECT id, tool, title, body, language, created_at, updated_at FROM bench_snippets WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
}

export async function saveSnippet(
  db: SQLiteDatabase,
  input: { tool: string; title: string; body: string; language?: string | null; id?: string },
): Promise<string> {
  const now = nowIso();
  if (input.id) {
    await db.runAsync(
      `UPDATE bench_snippets SET tool = ?, title = ?, body = ?, language = ?, updated_at = ?
       WHERE id = ?`,
      [input.tool, input.title, input.body, input.language ?? null, now, input.id],
    );
    return input.id;
  }
  const id = createId();
  await db.runAsync(
    `INSERT INTO bench_snippets (id, tool, title, body, language, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.tool, input.title, input.body, input.language ?? null, now, now],
  );
  return id;
}

export async function deleteSnippet(db: SQLiteDatabase, id: string) {
  const now = nowIso();
  await db.runAsync(
    'UPDATE bench_snippets SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id],
  );
}

/** How many snippets are kept — one figure for the shelf's honest empty state. */
export async function countSnippets(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM bench_snippets WHERE deleted_at IS NULL',
  );
  return row?.count ?? 0;
}
