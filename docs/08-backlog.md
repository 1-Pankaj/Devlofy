---
tags: [devlofy, backlog]
created: 2026-10-17
---

# Backlog

**Rule (ADR-001):** nothing enters "Next" unless something leaves or it replaces something. "Later" is a parking lot, not a promise.

## Next (v1 candidates — pick by real friction)

- [ ] Task scheduling follow-ons: energy pairing, manual reorder, editing due date/estimate after creation. ("Focus on this task" **shipped** in v0.3 — the Next up card starts a block attributed to the task.)
- [ ] Time log editing: manual entries, edit/delete a session, move a block to another project. (Billable flags and per-project totals **shipped** in v0.3.)
- [ ] Git dashboard: GitHub device-flow auth (client ID only, token in `expo-secure-store`), last-synced cards for PRs/issues/CI, offline-degrades to cache. **Blocked: needs the user's own OAuth client ID** — device flow cannot use someone else's.
- [ ] Notifications: focus-end + daily planning reminder (mobile-only; expo-notifications has no web support).
- [ ] Weekly review ritual: this week vs last, per-project split, what slipped, one-tap carry-over of unfinished tasks.
- [ ] Learning track: FSRS spaced repetition over notes + tips; game-dev content pack (Unity/Godot recipes).
- [ ] Client comm log entries on the client detail screen (calls, emails as notes).
- [ ] Project templates (tasks + milestones from a template) — promoted from Later; the shape is already in the seed.
- [ ] Unit tests for the pure modules (`engine/*`, `money.ts`, `parse-task.ts`) — needs a runner (vitest) added to the project; no test infrastructure exists today, and these are the modules where a silent wrong number would go unnoticed.

## Later

- [ ] Pipeline board (lead → active → archived) with drag.
- [ ] Week/timetable view with drag-to-schedule.
- [ ] Invoicing proper: numbered documents with draft/sent state, PDF export, payment tracking (v0.3 shipped the *draft* as a view — [[07-decisions]] ADR-017).
- [ ] Backup/restore file flow (`.devlofy` dump import).
- [ ] FTS5 native search + fuzzy match ranking; TF-IDF "related notes".
- [ ] Home-screen widgets (Android), share-sheet capture into Notes.
- [ ] Hover states + more desktop keyboard shortcuts (⌘K search **shipped** in v0.3).
- [ ] "The Engine" v2: energy *pairing* (match a task to the hours you'd actually do it), week-ahead scheduling, and tuning the weight table against your own behaviour. The v0.3 Engine is rules-only and shipped (ADR-016).
- [ ] On-device tiny model experiments (react-native-executorch) — flag-gated, never default.

## Ideas graveyard (explicitly rejected for now)

- Cloud sync service — violates ADR-002 (revisit only on user demand and with export-first migration).
- Chat AI assistant — explicitly not wanted; "AI" means algorithms (ADR-002).
- Real git client on mobile — dashboard only; mobile git is a trap.
- Team features — solo-first; multi-user is a different product.
- Third-party component kits for the core UI — see ADR-004.

## Feature budget ledger

| Cycle | In | Out / deferred |
|---|---|---|
| v0.1 (2026-10-17) | Today, Garden 3D, Work (projects/clients), Notes, More, desktop mode, export | iOS native, notifications, git, invoicing, FTS |
| v0.1 polish (2026-10-17) | Safe-area pass, live timer heroes, quick-add tasks, focus blocks w/ auto-close, editor templates + markdown preview, client detail, animated ring/dot primitives, crash boundary | Task scheduling (due/energy), comm log, notifications, time-log editing |
| 3D world v2 (2026-10-17) | Trees v3 (visible branch scaffold, lobed crowns, knuckles, twig tips), 11-prop Blender kit (rock…lantern…bird), growth-tiered dressing, data-driven trophies, focus-reactive lantern glow | none displaced — Garden depth is additive |
| Design + features wave (next) | Type scale + elevation pass, premium empty states, notes upgrades (checklists, tags + search, pin, links), full client/project add-edit | Scoped into v0.2 and v0.3 below |
| v0.2 working day (2026-10-18) | Precise motion (no overshoot anywhere), project attribution for focus blocks, per-project time tracked, 12-week rhythm heatmap, daily focus goal, quick-add task grammar w/ parse preview, due-date-ordered queue + due pills | Task scheduling follow-ons (energy pairing, reorder, editing dates after creation), command palette — deferred to v1, listed above |
| v0.3 majors (2026-10-18) | **The Engine** (Next up ranking + reasons, rhythm/peak band, median block, estimate drift) with task-attributed blocks; **Money-lite** (schema v2 rates, auto-billable blocks, `/invoice` draft + copy-as-text, currency setting); **Search** (`/search` over four kinds, ⌘K on web, act-in-place rows) | Backlog dents, not new debt: focus-from-task, the money-lite line, and the command-palette line are struck through above; Task scheduling follow-ons, time-log *editing*, git dashboard, notifications, weekly review, project templates stay in Next |
