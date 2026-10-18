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

## v0.3 — the majors *(built)*

Three features that change what the app *is*, all offline, all local compute ([[07-decisions]] ADR-016 → 018):

- **The Engine** — today's answer to "what next?". A pure ranking over every open task (priority, due proximity, estimate-vs-your-typical-block, energy-vs-your-peak-hours, momentum on a project already touched today, age) that shows its reasons as pills, starts the block attributed to the *task*, and lets you skip to the next candidate. [[04-design-language]].
- **Rhythm & estimate truth** — the session log becomes a report: focus minutes per hour of day with the learned 3-hour peak band, your strongest weekday, your median block, and **estimate drift** ("your 70m estimates take about 82m").
- **Money-lite** — an hourly rate on a project (inheriting the client's), automatic billability for blocks on rated work, and **/invoice**: a period- or client-scoped draft with line items, per-block evidence you can exclude with a tap, and copy-as-text export. Currency is a setting you pick.
- **Search & palette** — one screen over projects, clients, notes and tasks, from the Today header or **⌘/Ctrl-K** on web; results act (navigate, or complete a task in place).
- **Schema v2** — `clients.hourly_rate`, `projects.hourly_rate`, plus an index on `sessions(project_id)` ([[06-data-model]]).

Surfaces touched: Today gains the **Next up** card and a header search action; Garden gains the **Rhythm** card; Work gains a **Billing** section; client detail gains its rate pill and a scoped draft; new routes `/invoice` and `/search`; both forms gain a rate field; More is untouched (currency lives on the invoice screen, where the question arises).

## v0.4 — GitHub *(built 2026-10-18)*

The first feature that leaves the device, and the only one that can be stale ([[07-decisions]] ADR-019):

- **The dashboard** — what is waiting on you: review requests, your own open pull requests, issues assigned to you, the newest CI run on each recently pushed repo, and the repo list. **Read-only**: the app never writes to GitHub. Reached from Work → GitHub; new route `/github`.
- **Two ways in** — paste a personal access token (both platforms), or sign in with the **device flow** (Android only, and only once a client ID is configured in `app.json`). ⌘K-style convenience is not offered: this is a destination, not a palette.
- **A snapshot with a date** — the last good read is cached locally and paints instantly; it refreshes in the background only when older than ten minutes, and a failed refresh keeps the snapshot and says how old it is instead of blanking the screen. Offline degrade, not offline failure.
- **Honest partial reads** — permissions are per-token, so any section that could not be read says so in its own words rather than showing an empty list.
- **No schema change** — the token and the snapshot live in the KV store, not the database ([[06-data-model]]).

Surfaces touched: Work gains a **GitHub** section (with a connected pill); new route `/github`; `app.json` gains `expo.extra.githubClientId` (empty by default — the on-device sign-in stays hidden until it is set).

## v1 — the spine *(next)*

- Task scheduling follow-ons: energy pairing, manual reordering, due-date editing after creation.
- Time log editing and manual entries (the log is read-only today).
- Git dashboard follow-ons: pin the repos you care about, a commit/contribution feed, review *actions* (the read-only dashboard shipped in v0.4).
- Notifications/alarms (mobile-only; **expo-notifications does not support web**).
- Weekly review ritual: period summary, what slipped, one-tap carry-over.
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

- "The Engine" beyond rules: optional tiny on-device models (react-native-executorch) behind a flag — the deterministic ranking, rhythm and estimate drift shipped in v0.3 (ADR-016). Never a chat.

## Explicitly out of scope (for now)

- Multiplayer/teams, realtime sync service, accounts.
- Cloud AI / chat assistants.
- Real git on mobile (mobile git is a **dashboard**, not a repo client).
- iOS native work, watchOS, etc.
- Anything that requires a server to function.

## Success test

Dogfood on the builder's phone + tablet for two weeks without opening Notion/Trello for personal work.
