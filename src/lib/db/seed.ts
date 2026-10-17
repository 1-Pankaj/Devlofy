/**
 * First-run seed. Idempotent: only runs when the database is empty.
 *
 * The seed exists so the app is alive the moment it boots — a demo client,
 * real projects (Devlofy itself included), today's tasks, a welcome note and a
 * week of focus sessions so the garden has something to grow from. It is
 * normal user data afterwards; delete freely.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { createId } from '../ids';

const day = 24 * 60 * 60 * 1000;

type Statement = {
  sql: string;
  params: (string | number | null)[];
};

/** Exclusive transactions are native-only in expo-sqlite (web uses a plain one). */
async function runInTransaction(db: SQLiteDatabase, statements: Statement[]) {
  const run = async (
    exec: (sql: string, params: (string | number | null)[]) => Promise<unknown>,
  ) => {
    for (const statement of statements) {
      await exec(statement.sql, statement.params);
    }
  };

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => run((sql, params) => db.runAsync(sql, params)));
    return;
  }
  await db.withExclusiveTransactionAsync((txn) => run((sql, params) => txn.runAsync(sql, params)));
}

function iso(daysAgo = 0, hoursAgo = 0): string {
  return new Date(Date.now() - daysAgo * day - hoursAgo * 60 * 60 * 1000).toISOString();
}

export async function seedIfEmpty(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM clients');
  if ((row?.count ?? 0) > 0) return;

  const now = iso();

  const codeloomId = createId();
  const northwindId = createId();
  const personalId = createId();

  const devlofyId = createId();
  const starlightId = createId();
  const portalId = createId();
  const portfolioId = createId();

  const statements: Statement[] = [];

  // Clients
  statements.push({
    sql: `INSERT INTO clients (id, name, company, email, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    params: [codeloomId, 'Codeloom', 'Codeloom Studio', 'hello@codeloom.dev', now, now],
  });
  statements.push({
    sql: `INSERT INTO clients (id, name, company, email, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    params: [northwindId, 'Northwind Labs', 'Northwind Labs', 'pm@northwind.io', now, now],
  });
  statements.push({
    sql: `INSERT INTO clients (id, name, company, status, created_at, updated_at)
          VALUES (?, ?, NULL, 'active', ?, ?)`,
    params: [personalId, 'Personal', now, now],
  });

  // Projects
  statements.push({
    sql: `INSERT INTO projects (id, client_id, name, description, status, stack_tags, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    params: [
      devlofyId,
      codeloomId,
      'Devlofy',
      'Offline-first command center for solo developers.',
      JSON.stringify(['Expo', 'SQLite', 'R3F']),
      new Date(Date.now() + 45 * day).toISOString(),
      now,
      now,
    ],
  });
  statements.push({
    sql: `INSERT INTO projects (id, client_id, name, description, status, stack_tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    params: [
      starlightId,
      personalId,
      'Starlight Dash',
      'Side-scrolling action prototype. Unity, pixel art, one level at a time.',
      JSON.stringify(['Unity', 'C#']),
      now,
      now,
    ],
  });
  statements.push({
    sql: `INSERT INTO projects (id, client_id, name, description, status, stack_tags, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    params: [
      portalId,
      northwindId,
      'Northwind Portal',
      'Client dashboard rebuild. Phase 2: billing screens.',
      JSON.stringify(['Next.js', 'Postgres']),
      new Date(Date.now() + 21 * day).toISOString(),
      now,
      now,
    ],
  });
  statements.push({
    sql: `INSERT INTO projects (id, client_id, name, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'planning', ?, ?)`,
    params: [portfolioId, personalId, 'Portfolio 2.0', 'New personal site with case studies.', now, now],
  });

  // Milestones — Northwind Portal phases
  const milestone = (title: string, dueInDays: number, order: number, status = 'pending') => {
    statements.push({
      sql: `INSERT INTO milestones (id, project_id, title, due_date, status, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        createId(),
        portalId,
        title,
        new Date(Date.now() + dueInDays * day).toISOString(),
        status,
        order,
        now,
        now,
      ],
    });
  };
  milestone('Auth + roles', -12, 0, 'hit');
  milestone('Core screens', -2, 1, 'hit');
  milestone('Billing screens', 10, 2);
  milestone('Polish + handover', 20, 3);

  // Tasks for today
  const task = (
    projectId: string | null,
    title: string,
    opts: { priority?: number; energy?: string; est?: number; status?: string } = {},
  ) => {
    statements.push({
      sql: `INSERT INTO tasks (id, project_id, title, status, priority, energy, est_minutes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        createId(),
        projectId,
        title,
        opts.status ?? 'todo',
        opts.priority ?? 1,
        opts.energy ?? 'shallow',
        opts.est ?? 30,
        now,
        now,
      ],
    });
  };
  task(devlofyId, 'Wire the garden growth model to focus minutes', { priority: 2, energy: 'deep', est: 90 });
  task(devlofyId, 'Desk-check desktop mode rail on a wide window', { priority: 1, energy: 'shallow', est: 25 });
  task(portalId, 'Billing screen: invoice list states', { priority: 2, energy: 'deep', est: 120 });
  task(portalId, 'Reply to Northwind about Phase 2 scope', { priority: 1, energy: 'shallow', est: 15 });
  task(starlightId, 'Dash cooldown feels floaty — tighten curve', { priority: 0, energy: 'deep', est: 45 });
  task(null, 'Plan the learning track for FTS + local search', { priority: 0, energy: 'shallow', est: 20 });

  // Welcome note
  statements.push({
    sql: `INSERT INTO notes (id, title, body, project_id, pinned, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)`,
    params: [
      createId(),
      'Welcome to Devlofy',
      [
        '# This is your command center',
        '',
        'Everything here lives on this device. No account, no sync queue,',
        'no "loading" spinner between you and your own data.',
        '',
        '## What ships in v0.1',
        '- **Today** — your plan, your focus time, your streak.',
        '- **Garden** — a 3D tree that grows with focused minutes.',
        '- **Work** — projects and clients, milestones included.',
        '- **Notes** — plain markdown notes you actually own.',
        '',
        '> Tip: open this on a tablet and flip on desktop mode in More.',
      ].join('\n'),
      devlofyId,
      now,
      now,
    ],
  });

  // A week of focus sessions so the garden starts grown, not dead.
  const sessionMinutes = [45, 0, 70, 25, 90, 55, 42];
  sessionMinutes.forEach((minutes, index) => {
    if (minutes <= 0) return;
    const startedAt = iso(6 - index, 4);
    statements.push({
      sql: `INSERT INTO sessions (id, kind, started_at, ended_at, minutes, created_at, updated_at)
            VALUES (?, 'focus', ?, ?, ?, ?, ?)`,
      params: [
        createId(),
        startedAt,
        new Date(new Date(startedAt).getTime() + minutes * 60 * 1000).toISOString(),
        minutes,
        startedAt,
        startedAt,
      ],
    });
  });

  await runInTransaction(db, statements);
}
