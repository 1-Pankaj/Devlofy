---
tags: [devlofy, data]
created: 2026-10-17
---

# Data model

Local SQLite database `devlofy.db`, opened and migrated in `src/lib/db/`. Schemas are versioned with `PRAGMA user_version`; migrations are append-only (`src/lib/db/migrations.ts`). All writes go through `src/lib/db/repo.ts`.

## Sync-ready rules (from day one)

1. **`id` is a nanoid** — globally unique, generated on-device. No autoincrement anywhere.
2. **`created_at` / `updated_at`** are ISO-8601 UTC strings on every table.
3. **Deletes are tombstones**: `deleted_at` is set; nothing is hard-deleted. Every read filters `deleted_at IS NULL`.
4. **No server assumptions**: no sequences, no triggers, no server time.

If sync ever happens (it's a "maybe"), the schema is already shaped for last-write-wins.

## Tables (v1)

| Table | Purpose | Notable columns |
|---|---|---|
| `clients` | people/companies you build for | `status` (lead/active/archived), contact fields |
| `projects` | the builds | `client_id` (nullable = personal), `status`, `repo_url`, `stack_tags` (JSON array), `start_date`, `due_date` |
| `milestones` | project timeline | `project_id`, `due_date`, `status` (pending/hit), `order_index` |
| `tasks` | the day's work | `project_id` (nullable = inbox), `status`, `priority` (0–2), `energy` (deep/shallow), `est_minutes`, `due_at`, `completed_at`, `tags` |
| `sessions` | time log / focus | `kind` (focus/meeting/break), `started_at`, `ended_at`, `minutes`, `billable`, `note` |
| `notes` | knowledge | `title`, `body` (markdown-ish), `pinned`, optional `project_id`/`client_id` |

Indexes: `tasks(status)`, `tasks(project_id)`, `sessions(started_at)`, `notes(updated_at DESC)`, `projects(client_id)` — all partial on `deleted_at IS NULL`.

## Derived data (computed, never stored)

- **Garden growth** = weighted: total focus minutes (55%) + streak (30%) + today (15%), see `src/lib/garden/model.ts`.
- **Streak** = distinct session days walked backwards from today/yesterday (`getFocusStreakDays`).
- **Project progress** = `done_count / task_count` per project (subquery in `listProjects`).

## Search

v0.1: `LIKE` over `title` + `body` (works everywhere).
v1.5: **FTS5** on native behind a capability check; web keeps LIKE (the wasm build has no FTS5 — see [[03-architecture]]).

## Seeding

First run seeds a living demo (idempotent, guarded on `clients` being empty): Codeloom (self) + Northwind Labs (client) + Personal; four projects (Devlofy included); milestones for Northwind Portal; today's tasks; a welcome note; a week of focus sessions so the garden starts grown. It's normal data afterwards — delete freely.

## Export & backup

`exportAll()` dumps every table as JSON; the More screen shares it (native share sheet) or copies it (web clipboard). **Export exists from v0.1 because data ownership is the product promise.** A full backup/restore file flow lands in v2 ([[02-scope]]).

## Migration policy

- Append-only. Never edit a shipped migration; add version N+1 with `ALTER TABLE` / `CREATE TABLE`.
- Connection pragmas (`journal_mode`, `foreign_keys`) are applied outside the migration transaction and are best-effort (web wasm doesn't support everything).
- Any schema change updates this doc in the same commit.
