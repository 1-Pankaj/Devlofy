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

/**
 * A local wall-clock time `daysAgo` back, never in the future. The seed uses this
 * for sessions so the rhythm chart has a *shape* — mornings, not a single spike
 * wherever "now" happened to be when the app was first opened.
 */
function localAt(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() > Date.now()) date.setDate(date.getDate() - 7);
  return date.toISOString();
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
    sql: `INSERT INTO clients (id, name, company, email, status, hourly_rate, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    params: [northwindId, 'Northwind Labs', 'Northwind Labs', 'pm@northwind.io', 2500, now, now],
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
    const id = createId();
    statements.push({
      sql: `INSERT INTO tasks (id, project_id, title, status, priority, energy, est_minutes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
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
    return id;
  };
  // Ids are kept so the seeded sessions can be attributed to tasks — that is
  // what lets a fresh install show estimate-vs-reality without any user effort.
  const gardenTask = task(devlofyId, 'Wire the garden growth model to focus minutes', { priority: 2, energy: 'deep', est: 90 });
  const deskTask = task(devlofyId, 'Desk-check desktop mode rail on a wide window', { priority: 1, energy: 'shallow', est: 25 });
  const billingTask = task(portalId, 'Billing screen: invoice list states', { priority: 2, energy: 'deep', est: 120 });
  task(portalId, 'Reply to Northwind about Phase 2 scope', { priority: 1, energy: 'shallow', est: 15 });
  const dashTask = task(starlightId, 'Dash cooldown feels floaty — tighten curve', { priority: 0, energy: 'deep', est: 45 });
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

  // A week of focus sessions so the garden starts grown, not dead — and so the
  // per-project time on Work has something to show. Northwind pays an hourly
  // rate, so their blocks are seeded billable: the invoice draft has a real
  // number on a fresh install, and the Devlofy/Starlight blocks deliberately
  // stay unrated to show the "not priced" state too.
  const sessionMinutes = [45, 0, 70, 25, 90, 55, 42];
  const sessionProjects = [devlofyId, null, portalId, devlofyId, portalId, starlightId, devlofyId];
  const sessionTasks = [gardenTask, null, billingTask, deskTask, billingTask, dashTask, gardenTask];
  const sessionBillable = [0, 0, 1, 0, 1, 0, 0];
  // Morning-weighted on purpose: a realistic solo-dev week, and enough shape for
  // the rhythm card to name a peak band on a fresh install.
  const sessionHours = [9, 9, 11, 14, 9, 10, 15];
  sessionMinutes.forEach((minutes, index) => {
    if (minutes <= 0) return;
    // Today's block is relative ("a couple of hours ago") so the streak and
    // "banked today" read true whenever the app is first opened; the rest sit at
    // fixed local hours to give the rhythm chart its shape.
    const startedAt = index === 6 ? iso(0, 2) : localAt(6 - index, sessionHours[index], 20);
    statements.push({
      sql: `INSERT INTO sessions (id, task_id, project_id, kind, started_at, ended_at, minutes, billable, created_at, updated_at)
            VALUES (?, ?, ?, 'focus', ?, ?, ?, ?, ?, ?)`,
      params: [
        createId(),
        sessionTasks[index],
        sessionProjects[index],
        startedAt,
        new Date(new Date(startedAt).getTime() + minutes * 60 * 1000).toISOString(),
        minutes,
        sessionBillable[index],
        startedAt,
        startedAt,
      ],
    });
  });

  await runInTransaction(db, statements);
}
