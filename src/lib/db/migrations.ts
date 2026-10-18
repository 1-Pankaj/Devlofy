/**
 * Schema migrations, versioned via `PRAGMA user_version`.
 *
 * Rules:
 *  - Every table carries `id` (nanoid text), `created_at`, `updated_at` (ISO
 *    strings) and a soft-delete tombstone `deleted_at`. Sync-ready from day one.
 *  - Never edit a shipped migration — append a new one.
 *  - Connection settings (journal mode, foreign keys) are applied outside the
 *    migration transaction.
 *  - FTS5 is available on native (config plugin default) but not in the web
 *    wasm build, so full-text search is a later migration behind a capability
 *    check.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { seedIfEmpty } from './seed';

type Migration = {
  version: number;
  statements: string[];
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE clients (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        phone TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE TABLE projects (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT REFERENCES clients (id),
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        repo_url TEXT,
        stack_tags TEXT,
        start_date TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE TABLE milestones (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects (id),
        title TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT REFERENCES projects (id),
        title TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        priority INTEGER NOT NULL DEFAULT 1,
        energy TEXT NOT NULL DEFAULT 'shallow',
        est_minutes INTEGER,
        due_at TEXT,
        completed_at TEXT,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT REFERENCES tasks (id),
        project_id TEXT REFERENCES projects (id),
        kind TEXT NOT NULL DEFAULT 'focus',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        minutes INTEGER,
        billable INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE TABLE notes (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        project_id TEXT REFERENCES projects (id),
        client_id TEXT REFERENCES clients (id),
        tags TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );`,
      `CREATE INDEX idx_tasks_status ON tasks (status) WHERE deleted_at IS NULL;`,
      `CREATE INDEX idx_tasks_project ON tasks (project_id) WHERE deleted_at IS NULL;`,
      `CREATE INDEX idx_sessions_started ON sessions (started_at) WHERE deleted_at IS NULL;`,
      `CREATE INDEX idx_notes_updated ON notes (updated_at DESC) WHERE deleted_at IS NULL;`,
      `CREATE INDEX idx_projects_client ON projects (client_id) WHERE deleted_at IS NULL;`,
    ],
  },
  {
    // Money. A rate lives on the project, falling back to the client, so
    // "billable" can be resolved from whatever a block was attributed to.
    version: 2,
    statements: [
      `ALTER TABLE clients ADD COLUMN hourly_rate REAL;`,
      `ALTER TABLE projects ADD COLUMN hourly_rate REAL;`,
      `CREATE INDEX idx_sessions_project ON sessions (project_id) WHERE deleted_at IS NULL;`,
    ],
  },
];

/**
 * Exclusive transactions are native-only in expo-sqlite; the web build runs
 * the same statements inside a plain transaction. Nothing else touches the
 * database during boot, so ordering is guaranteed either way.
 */
async function runStatements(db: SQLiteDatabase, statements: string[]) {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      for (const statement of statements) {
        await db.execAsync(statement);
      }
    });
    return;
  }
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const statement of statements) {
      await txn.execAsync(statement);
    }
  });
}

export async function migrate(db: SQLiteDatabase) {
  // Connection settings — outside the migration transaction, best-effort on web.
  for (const pragma of ['PRAGMA journal_mode = WAL;', 'PRAGMA foreign_keys = ON;']) {
    try {
      await db.execAsync(pragma);
    } catch {
      // The web wasm build does not support every pragma; ignore.
    }
  }

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version > MIGRATIONS.length) {
    throw new Error('The database was created by a newer version of Devlofy.');
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    await runStatements(db, migration.statements);
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    version = migration.version;
  }
}

export async function initializeDatabase(db: SQLiteDatabase) {
  await migrate(db);
  await seedIfEmpty(db);
}
