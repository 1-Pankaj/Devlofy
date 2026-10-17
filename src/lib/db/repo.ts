/**
 * Typed repository over the local SQLite database. Every screen reads and
 * writes through these functions — no SQL in components.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { createId } from '../ids';

function nowIso(): string {
  return new Date().toISOString();
}

// ─────────────────────────── Notes ───────────────────────────

export type NoteListRow = {
  id: string;
  title: string;
  preview: string;
  pinned: number;
  updated_at: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  project_id: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
};

export async function listNotes(db: SQLiteDatabase, search?: string): Promise<NoteListRow[]> {
  const query = search?.trim();
  if (query) {
    const like = `%${query}%`;
    return db.getAllAsync<NoteListRow>(
      `SELECT id, title, substr(body, 1, 140) AS preview, pinned, updated_at
       FROM notes
       WHERE deleted_at IS NULL AND (title LIKE ? OR body LIKE ?)
       ORDER BY pinned DESC, updated_at DESC`,
      [like, like],
    );
  }
  return db.getAllAsync<NoteListRow>(
    `SELECT id, title, substr(body, 1, 140) AS preview, pinned, updated_at
     FROM notes
     WHERE deleted_at IS NULL
     ORDER BY pinned DESC, updated_at DESC`,
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
  patch: { title?: string; body?: string; pinned?: boolean },
) {
  const sets: string[] = [];
  const params: (string | number)[] = [];
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
  if (sets.length === 0) return;
  params.push(nowIso(), id);
  await db.runAsync(`UPDATE notes SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, params);
}

export async function deleteNote(db: SQLiteDatabase, id: string) {
  const now = nowIso();
  await db.runAsync('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

// ─────────────────────────── Clients ───────────────────────────

export type ClientRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  project_count: number;
};

export async function listClients(db: SQLiteDatabase): Promise<ClientRow[]> {
  return db.getAllAsync<ClientRow>(
    `SELECT c.id, c.name, c.company, c.email, c.status,
            (SELECT COUNT(*) FROM projects p
              WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS project_count
     FROM clients c
     WHERE c.deleted_at IS NULL
     ORDER BY c.name COLLATE NOCASE ASC`,
  );
}

export async function createClient(
  db: SQLiteDatabase,
  input: { name: string; company?: string },
) {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO clients (id, name, company, status, created_at, updated_at)
     VALUES (?, ?, ?, 'lead', ?, ?)`,
    [id, input.name.trim(), input.company?.trim() || null, now, now],
  );
  return id;
}

export type ClientDetail = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

export async function getClient(db: SQLiteDatabase, id: string): Promise<ClientDetail | null> {
  return db.getFirstAsync<ClientDetail>(
    `SELECT id, name, company, email, phone, notes, status, created_at
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
    `SELECT p.id, p.client_id, c.name AS client_name, p.name, p.description, p.status,
            p.stack_tags, p.due_date,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) AS done_count
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
  stack_tags: string | null;
  due_date: string | null;
  task_count: number;
  done_count: number;
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
    `SELECT p.id, p.client_id, c.name AS client_name, p.name, p.description, p.status,
            p.stack_tags, p.due_date,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) AS done_count
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
    `SELECT p.id, p.client_id, c.name AS client_name, p.name, p.description, p.status,
            p.stack_tags, p.due_date,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.deleted_at IS NULL) AS task_count,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) AS done_count
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
  input: { name: string; clientId?: string | null; dueDate?: string | null },
) {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO projects (id, client_id, name, status, due_date, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`,
    [id, input.clientId ?? null, input.name.trim(), input.dueDate ?? null, now, now],
  );
  return id;
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
  project_name?: string | null;
};

export async function listTodayTasks(db: SQLiteDatabase, limit = 8): Promise<TaskRow[]> {
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

export async function createTask(
  db: SQLiteDatabase,
  input: { title: string; projectId?: string | null; priority?: number },
): Promise<string> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO tasks (id, project_id, title, status, priority, created_at, updated_at)
     VALUES (?, ?, ?, 'todo', ?, ?, ?)`,
    [id, input.projectId ?? null, input.title.trim(), input.priority ?? 2, now, now],
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
};

export async function startFocusSession(db: SQLiteDatabase): Promise<string> {
  const id = createId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO sessions (id, kind, started_at, created_at, updated_at)
     VALUES (?, 'focus', ?, ?, ?)`,
    [id, now, now, now],
  );
  return id;
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
    `SELECT * FROM sessions
     WHERE kind = 'focus' AND ended_at IS NULL AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
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
    `SELECT * FROM sessions
     WHERE kind = 'focus' AND deleted_at IS NULL AND minutes IS NOT NULL
     ORDER BY started_at DESC LIMIT ?`,
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
  const tables = ['clients', 'projects', 'milestones', 'tasks', 'sessions', 'notes'] as const;
  const dump: Record<string, unknown[]> = {};
  for (const table of tables) {
    dump[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  return {
    app: 'devlofy',
    version: 1,
    exported_at: nowIso(),
    data: dump,
  };
}
