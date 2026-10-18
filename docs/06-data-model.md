---
tags: [devlofy, data]
created: 2026-10-17
---

# Data model

Local SQLite database `devlofy.db`, opened and migrated in `src/lib/db/`. Schemas are versioned with `PRAGMA user_version`; migrations are append-only (`src/lib/db/migrations.ts`). All writes go through `src/lib/db/repo.ts`.

## Sync-ready rules (from day one)

1. **`id` is an app-generated string** — 16 base-36 characters from `src/lib/ids.ts` (Web Crypto when the runtime has it, `Math.random` otherwise; Hermes cannot rely on either). Globally unique at personal-app scale, generated on-device. No autoincrement anywhere.
2. **`created_at` / `updated_at`** are ISO-8601 UTC strings on every table.
3. **Deletes are tombstones**: `deleted_at` is set; nothing is hard-deleted. Every read filters `deleted_at IS NULL`.
4. **No server assumptions**: no sequences, no triggers, no server time.

If sync ever happens (it's a "maybe"), the schema is already shaped for last-write-wins.

## Tables (v1)

| Table | Purpose | Notable columns |
|---|---|---|
| `clients` | people/companies you build for | `status` (lead/active/archived), contact fields, **`hourly_rate`** (v2 — the default rate for all of their projects) |
| `projects` | the builds | `client_id` (nullable = personal), `status`, `repo_url`, `stack_tags` (JSON array), `start_date`, `due_date`, **`hourly_rate`** (v2 — overrides the client's) |
| `milestones` | project timeline | `project_id`, `due_date`, `status` (pending/hit), `order_index` |
| `tasks` | the day's work | `project_id` (nullable = inbox), `status`, `priority` (0–2, **2 = high** — the task grammar's `!3` maps to it), `energy` (deep/shallow), `est_minutes`, `due_at` (nullable, 09:00 local on the due day), `completed_at`, `tags` |
| `sessions` | time log / focus | `kind` (focus/meeting/break), `started_at`, `ended_at`, `minutes`, `project_id` (nullable — what the block was *for*), `task_id` (nullable — what the block was *spent on*, which is what makes estimate drift possible), `billable` (set at start from the resolved rate), `note` |
| `notes` | knowledge | `title`, `body` (markdown-ish), `pinned`, `tags` (comma-separated lowercase slugs — see `src/lib/tags.ts`), optional `project_id`/`client_id` (link chips in the editor) |
| `bench_snippets` | what you kept from a Bench tool (v3) | `tool` (the tool id — it decides which screen re-opens it), `title`, `body` (the tool's own artifact: formatted JSON, a unified patch, a regex, a digest…), `language` (nullable, for the shared code renderer) |

Indexes: `tasks(status)`, `tasks(project_id)`, `sessions(started_at)`, `notes(updated_at DESC)`, `projects(client_id)`, **`sessions(project_id)`** (v2), **`bench_snippets(updated_at DESC)`** and **`bench_snippets(tool)`** (v3) — all partial on `deleted_at IS NULL`.

## Migrations

| Version | What it adds | Why |
|---|---|---|
| 1 | the six tables above + five partial indexes | the foundation ([[03-architecture]]) |
| 2 | `clients.hourly_rate`, `projects.hourly_rate`, `idx_sessions_project` | money-lite: a block's price resolves from its project, so pricing needs no new join table and no per-block input ([[07-decisions]] ADR-017) |
| 3 | `bench_snippets` + `idx_bench_snippets_updated` / `idx_bench_snippets_tool` | Bench: a kept snippet is user content — it has a title, a tool it belongs to, and must ride along in the app's own export — so it is a table, not a KV value ([[07-decisions]] ADR-021) |

## Derived data (computed, never stored)

- **Garden growth** = weighted: total focus minutes (55%) + streak (30%) + today (15%), see `src/lib/garden/model.ts`.
- **Streak** = distinct session days walked backwards from today/yesterday (`getFocusStreakDays`).
- **Project progress** = `done_count / task_count` per project (subquery in `listProjects`).
- **Time tracked per project** = `SUM(minutes)` / `COUNT(*)` / `MAX(started_at)` over that project's finished focus sessions (same subquery block in `listProjects` / `getProject`) — a query, never a denormalised counter, so editing or deleting a session can't desync it.
- **Billable minutes per project** = the same `SUM` restricted to `billable = 1` (`billable_minutes`); billability is decided once, when a session starts, from the resolved rate ([[07-decisions]] ADR-017).
- **Rhythm bands** = today's minutes bucketed per day, in four steps: `0` (nothing), `< 30`, ` < 75`, `≥ 75` for the twelve-week heatmap (`level()` in `src/components/focus/focus-heatmap.tsx`).
- **Rhythm (the Engine)** = finished blocks bucketed by **local** hour and weekday, the best contiguous 3-hour band, and the median block length — computed in JS, not SQL, so the buckets are in the user's timezone rather than UTC (`src/lib/engine/rhythm.ts`).
- **Next up** = a weighted score over every open task plus the reasons behind it (`src/lib/engine/next-up.ts`); never persisted, and re-ranked on every read.
- **Estimate drift** = per-task `SUM(sessions.minutes)` against `tasks.est_minutes` (`listEstimateSamples`), reported as a ratio once four tasks have both numbers.
- **Invoice draft** = a *view*, not a table: sessions in a window, grouped by project, each priced at `COALESCE(projects.hourly_rate, clients.hourly_rate)` (`src/lib/money.ts`). Nothing to keep in sync, nothing to go stale.

## Search

- **Global** (v0.3): `searchEverything()` runs four bounded `LIKE` queries over projects (name/description/stack), clients (name/company/email/notes), notes (title/body) and tasks (title/project name), and returns one grouped result set (six per kind, `perKind`). Reached from Today's header or ⌘/Ctrl-K on web ([[07-decisions]] ADR-018).
- **Notes**: `LIKE` over `title` + `body` + `tags`, narrowable by linked client/project chips.
- **Bench snippets** are searched on their own screen (`/bench/snippets`, `listSnippets(db, query)` over `title` + `body`) rather than through `searchEverything()`. A snippet is a value you go and use in a tool, not a record you navigate to; it has its own list, its own search field, and the shelf row that opens it ([[07-decisions]] ADR-021).
- **v1.5**: **FTS5** on native behind a capability check; web keeps LIKE (the wasm build has no FTS5 — see [[03-architecture]]). Any FTS result must keep the v0.3 shape.

## Not in the database (KV)

Two things deliberately live outside SQLite, in the KV adapter (`src/lib/storage`: `expo-sqlite/kv-store` on native, `localStorage` on web — ADR-011):

- **Settings** — zustand persist (theme, goal, currency, focus project, desktop mode).
- **GitHub** (`devlofy.github.auth`, `devlofy.github.snapshot`) — the token and the last good dashboard snapshot, with `fetchedAt` (v0.4, [[07-decisions]] ADR-019). A cache of somebody else's data is not user content: it has no relationships to keep, no migration story worth having, and it must never be exported as if it were the user's own record. `exportAll()` therefore does not include it, and losing it costs one refresh.

## Seeding

First run seeds a living demo (idempotent, guarded on `clients` being empty): Codeloom (self) + Northwind Labs (client, **rated ₹2,500/h**) + Personal; four projects (Devlofy included); milestones for Northwind Portal; today's tasks; a welcome note; and a week of focus sessions — attributed to tasks at realistic local hours (morning-weighted, so the rhythm card has a shape) and **billable where the project is rated**, so the invoice draft has a real number on a fresh install. Devlofy and Starlight blocks stay unrated on purpose, so the "not priced" state is visible too. It's normal data afterwards — delete freely.

## Export & backup

`exportAll()` dumps every table as JSON (`{ app, version, exported_at, data }`); the More screen shares it (native share sheet) or copies it (web clipboard). The dump's `version` went to **2** in v0.6 when `bench_snippets` joined it, so a reader can tell whether it will find a table it knows. **Export exists from v0.1 because data ownership is the product promise**, and "every table" is literal: a new table is added to the `tables` list in the same change that creates it. A full backup/restore file flow lands in v2 ([[02-scope]]).

## Migration policy

- Append-only. Never edit a shipped migration; add version N+1 with `ALTER TABLE` / `CREATE TABLE`.
- Connection pragmas (`journal_mode`, `foreign_keys`) are applied outside the migration transaction and are best-effort (web wasm doesn't support everything).
- Any schema change updates this doc in the same commit.
