---
tags: [devlofy, scope]
created: 2026-10-17
---

# Scope

## Platform strategy (decided 2026-10-17)

| Platform | Status | Notes |
|---|---|---|
| **Android (native)** | Primary | Phones, **tablets**, desktop-class devices. No iOS in this phase. |
| **Web** | Stable, equal partner | PWA install on iPhone for dogfooding; same codebase. |
| **iOS (native)** | Later | Untouched until Android is solid. Code is kept iOS-safe. |

**Desktop mode is v0.1 scope** (user requirement): expanded widths get a side-rail shell instead of the bottom bar. Window size classes: compact < 600, medium < 840, expanded ≥ 840 (Material 3). Auto/On/Off switch in More → Settings. See [[03-architecture]] for the mechanics.

## v0.1 — foundation (built 2026-10-17)

- **Today** — greeting, focus hero with live timer + animated ring and a **daily focus goal** (set in More), project attribution for the next block, 7-day momentum chart (streak, tasks done), **quick-add tasks with a grammar** (`Ship the invoice !3 45m tomorrow #Northwind`) and a live parse preview, garden teaser, craft tip.
- **Garden** — 3D tree grown from real focus data: Blender-authored GLBs over the procedural fallback; **focus blocks (25/50/90) with countdown, progress bar and auto-close at zero**; project attribution; live overlay timer; **12-week rhythm heatmap**; recent sessions.
- **Work** — projects list with progress rings **and time tracked per project**, project detail (progress, milestones, tasks, focus time), clients list, **client detail (delivery stats, details, portfolio)**, create project / create client.
- **Notes** — search over titles + bodies, pinned notes, **rebuilt editor**: autosave with live save badge, **markdown preview**, **starter templates**, word/char footer, pin + inline delete confirm.
- **More** — name, theme (System / Dark / Light), desktop mode, **daily focus goal**, data stats, JSON export, about.
- **Desktop mode** — side rail + centered content; adaptive tab shell.
- **System** — safe-area insets owned by `Screen` everywhere, animated `ProgressRing` / `LiveDot` / `Loading` primitives, root crash boundary, loading/error/empty handled on every list.
- **Data layer** — full local schema ([[06-data-model]]), migrations, first-run seed, sync-ready (UUID ids, `updated_at`, tombstones).

## v0.2 — the working day (built 2026-10-18)

- **Task grammar** — `!3` priority, `45m` / `1.5h` estimate, `today` / `tomorrow` / `fri` / `+3d` due date, `#Project` attribution; parsed by `src/lib/parse-task.ts`, previewed as chips before it is committed, and nothing typed is silently dropped (an unmatched `#tag` stays in the title).
- **The queue is a day view** — dated work first (overdue on top), then the undated backlog by priority; rows carry a due pill (`2d overdue`, `today`, `tomorrow`, `in 4d`, `Oct 24`).
- **Focus attribution** — the project the next block belongs to is chosen once and persisted, so Today and Garden agree; sessions store `project_id`, which is what makes per-project time real.
- **Time tracked per project** — Work rows and the project page state focused minutes and session count.
- **Rhythm heatmap** — twelve weeks of focus as a 4-step tonal grid on Garden, with the best day and the number of days focused.
- **Daily focus goal** — 1h / 1.5h / 2h / 3h in More, driving the Today ring, "to go", and the heatmap's intensity bands.
- **Precise motion** — every overshoot removed: critically damped springs only, timing curves for everything else ([[04-design-language]]).

## v1 — the spine *(next)*

- Task scheduling follow-ons: energy pairing, manual reordering, due-date editing after creation.
- Time log editing, manual entries, billable flags.
- Command palette / keyboard-first navigation on desktop mode.
- Git dashboard (GitHub device flow, read-mostly: PRs, commits, issues, CI) — needs online, degrades to last-synced.
- Notifications/alarms (mobile-only; **expo-notifications does not support web**).
- Money-lite: rates per client, manual invoice drafts (manual-confirm only).
- Learning: spaced repetition (FSRS) over notes and project tips.
- Content packs: game-dev track (Unity/Godot data, shader notes, prototyping recipes).

## v1.5

- Client comm log (calls, emails as notes attached to clients).
- Pipeline view (lead → active → archived).
- Project templates (new project from a template with tasks + milestones).
- Week view / timetable.
- FTS5 search on native (web falls back to LIKE — wasm build lacks FTS).

## v2

- Invoicing with export (PDF) — still no backend, still manual send.
- Home widgets (Android) and share-sheet capture.
- Backup/restore file flow (.devlofy dump).

## v3

- "The Engine": local analytics that tune recommendations; optional tiny on-device models (react-native-executorch) behind a flag. Never a chat.

## Explicitly out of scope (for now)

- Multiplayer/teams, realtime sync service, accounts.
- Cloud AI / chat assistants.
- Real git on mobile (mobile git is a **dashboard**, not a repo client).
- iOS native work, watchOS, etc.
- Anything that requires a server to function.

## Success test

Dogfood on the builder's phone + tablet for two weeks without opening Notion/Trello for personal work.
