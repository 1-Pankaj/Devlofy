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
- **Notes** — search over titles + bodies, pinned notes, **rebuilt editor**: autosave with live save badge, **markdown preview** *(replaced by the block editor and its reading view in v0.8 — see below)*, **starter templates**, word/char footer, pin + inline delete confirm.
- **More** — the **feature shelf** first (Bench and Sentinel as cards carrying a live figure, v0.7.1), then name, theme (System / Dark / Light), desktop mode, **daily focus goal**, data stats, JSON export, about.
- **Desktop mode** — side rail + centered content; adaptive tab shell.
- **System** — safe-area insets owned by `Screen` everywhere, animated `ProgressRing` / `LiveDot` / `Loading` primitives, root crash boundary, loading/error/empty handled on every list.
- **Data layer** — full local schema ([[06-data-model]]), migrations, first-run seed, sync-ready (app-generated ids, `updated_at`, tombstones).

## v0.2 — the working day (built 2026-10-18)

- **Task grammar** — `!3` priority, `45m` / `1.5h` estimate, `today` / `tomorrow` / `fri` / `+3d` due date, `#Project` attribution; parsed by `src/lib/parse-task.ts`, previewed as chips before it is committed, and nothing typed is silently dropped (an unmatched `#tag` stays in the title).
- **The queue is a day view** — dated work first (overdue on top), then the undated backlog by priority; rows carry a due pill (`2d overdue`, `today`, `tomorrow`, `in 4d`, `Oct 24`).
- **Focus attribution** — the project the next block belongs to is chosen once and persisted, so Today and Garden agree; sessions store `project_id`, which is what makes per-project time real.
- **Time tracked per project** — Work rows and the project page state focused minutes and session count.
- **Rhythm heatmap** — twelve weeks of focus as a 4-step tonal grid on Garden, with the best day and the number of days focused.
- **Daily focus goal** — 1h / 1.5h / 2h / 3h in More, driving the Today ring and "to go".
- **Precise motion** — every overshoot removed: no spring anywhere, just timing curves for everything ([[04-design-language]]).

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

- **The dashboard** — what is waiting on you: review requests, your own open pull requests, issues assigned to you, the newest CI run on each recently pushed repo, and the repo list. **Read-only** in v0.4: the app never wrote to GitHub. Reached from Work → GitHub; new route `/github`. *(v0.5 made it two-way — see below and [[07-decisions]] ADR-020.)*
- **Two ways in** — paste a personal access token (both platforms), or sign in with the **device flow** (Android only, and only once a client ID is configured in `app.json`). ⌘K-style convenience is not offered: this is a destination, not a palette.
- **A snapshot with a date** — the last good read is cached locally and paints instantly; it refreshes in the background only when older than ten minutes, and a failed refresh keeps the snapshot and says how old it is instead of blanking the screen. Offline degrade, not offline failure.
- **Honest partial reads** — permissions are per-token, so any section that could not be read says so in its own words rather than showing an empty list.
- **No schema change** — the token and the snapshot live in the KV store, not the database ([[06-data-model]]).

Surfaces touched: Work gains a **GitHub** section (with a connected pill); new route `/github`; `app.json` gains `expo.extra.githubClientId` — a public client ID, with the comment beside it saying what it is for. It was empty when this shipped (the on-device sign-in stays hidden until it is set); a real one is configured now, so the device flow is available on native and a pasted token remains the web path.

## v0.5 — GitHub, two-way *(built 2026-10-19)*

The dashboard becomes the whole code host. This is the first time the app **writes to the outside world**, so the release is as much a safety contract as a feature set ([[07-decisions]] ADR-020, [[09-platform-ceiling]]):

- **Browse** — repositories (from the hub or from Work), folders, and files, with syntax highlighting done by this app's own tokenizer (`src/lib/highlight.ts`), not a highlighter dependency. Folders are browsable at any ref; binary and oversized files say so instead of pretending.
- **Edit** — a file opens in an editor seeded from GitHub's blob, and the screen computes the diff against the `sha` it read. You type, you see exactly what will change, and only then does the button appear — labelled with its consequence, never "Save".
- **The branch rule** — no code path commits to the default branch. An edit either appends to an existing non-default branch or creates one (`devlofy/<file>`), then offers the pull request against the default branch. The ref update is non-forced, so a branch that moved while you were typing is refused rather than overwritten, and a stale `sha` comes back as GitHub's own `409` with a sentence.
- **Pull requests** — list by state, open one, read the conversation and the per-file patches, and act: approve, request changes, comment, request a review from a collaborator, merge (merge / squash / rebase, guarded by the head `sha`), close or reopen, or mark a draft ready.
- **Issues** — list by state, file a new one with labels and assignees, comment, and triage (state, labels, assignees).
- **Actions** — recent runs with their states and per-job checks, the workflow list, **dispatch** a workflow with typed JSON inputs, re-run (all or failed jobs), and cancel. Dispatch is honest about what GitHub answers: *accepted*, not *started*.
- **Releases** — the shipped list, and a form that cuts the next one: tag, title, target branch, draft/prerelease, and notes either written by you or generated by GitHub from the merged pull requests (the form closes the box it will ignore rather than discarding what you typed).
- **Inbox** — notifications with their reasons, per-thread read, and "read all" — classic tokens only, which the screen says out loud when it cannot read them.
- **Honest by construction** — every screen keeps ADR-019's habits: per-section failure as a sentence, a last-known read when the network is gone, and a version of the truth that never blanks.

Not built, deliberately: **gists** (the endpoint is one call, but a second snippet store is not where the value is — [[08-backlog]]), Actions **log download** (a 302 to a ZIP that expires in ~60 s belongs in a desktop browser), and any repository/settings write.

Surfaces touched: `/github` becomes a hub of twelve screens (`repo`, `browse`, `blob`, `edit`, `pulls`, `pr`, `issues`, `issue`, `new-issue`, `actions`, `notifications`, `release`) with its own nested navigator; Work's GitHub row says what it now does; **no schema change** — GitHub's data stays in KV ([[06-data-model]]).

## v0.6 — Bench, the offline toolbox *(built 2026-10-19)*

The first new **category** since v0.1 ([[10-categories]]), and the first release with nothing networked in it at all — every tool runs on the device, on both platforms, in Expo Go ([[07-decisions]] ADR-021):

- **A shelf in More, not a sixth tab** — the tab bar keeps its five destinations; Bench opens from an `offline` section on More. Route `/bench` is a stack: the shelf, one host route per tool, and the kept-snippets list. Filtering the shelf matches tool names and their one-line promise.
- **Eleven tools, grouped by kind** — *data*: JSON (format / minify / sort keys / types + stats), SQL (dialect-aware formatting with keyword casing), Diff (two texts or a paste-able unified patch, built on GitHub's own engine); *text*: Regex (highlighted hits, groups, a replacement preview, recipes), Text (word/character/reading stats and nine case conversions), Encode (base64, URL, HTML entities, hex, with byte previews); *security*: JWT (decode and *not* verify — said out loud, with iat/exp in human words), Hash (SHA-1/SHA-256, compared against an expected digest); *time*: Epoch (parse and format, plus a live "now"), Cron (a full parser that says the schedule in words and the next five runs); *design*: Colour (hex/rgb/hsl, WCAG contrast grades against AA and AAA, and a tonal ramp that shows each step's ratio).
- **Every tool computes as you type** — no Run button, no stale result.
- **What you keep is the tool's own artifact** — the formatted document, the unified patch, the pattern, the digest, the ISO timestamp, the cron expression, the hex — saved to `bench_snippets` (**schema v3**) with a title, and re-opened **in the tool that made it** (`?snippet=<id>`, updating the same row).
- **Honest by subtraction** — YAML and XML were cut from the plan rather than shipping a half-parser, and the HTTP/API client is Bench's *second* release ([[08-backlog]]).
- **Pure logic, verified** — all eleven tools live in `src/lib/bench/*` and are covered by **eighty known-answer checks** (`self-check.ts`), which caught four bugs in this release and one pre-existing bug in the shared diff engine that had been printing the wrong context line in GitHub's editor since v0.5.

Surfaces touched: More gains its **Bench** section; new route `/bench` (shelf, `[tool]`, `snippets`); `src/lib/bench/*` + `src/components/bench/*`; the shared `src/lib/diff.ts`, `base64.ts` and `src/components/ui/code-block|diff-view` are now used by two features; **schema v3** ([[06-data-model]]).

The same release also closes [[05-blender-pipeline]]'s last open model item — **the Garden's code-authored kit** ([[07-decisions]] ADR-022): a bench that unlocks with growth and a **signpost with one plate per active project** (the first garden objects whose shape is data), plus a code model for every non-trophy prop so the garden is dressed when its GLB never arrives. Eight models in `src/lib/three/kit/`, all offline, no new dependency — and `tools/preview/` renders them to a PNG without a GPU, because a browser without WebGL (like a headless container) can only show the "3D is unavailable" still.

## v0.7 — Sentinel, the board that watches your own URLs *(built 2026-10-19)*

The second new **category** since v0.1 ([[10-categories]] §2), and the **second networked feature** — with a stricter rule than GitHub's, because Sentinel's whole purpose is to make requests, and they go to the user's own infrastructure ([[07-decisions]] ADR-023):

- **A board, not a list, in More** — the tab bar is unchanged; Sentinel opens from a `networked` section on More. Route `/sentinel` is a stack: the board (worst first), a target's own screen, and the registration form as a modal.
- **What it is** — register the URLs you own (a site, an API, a health endpoint). Each target gets a status (up / slow / down), the time the request took, a history strip, 24-hour reliability, an incident log, and a full check log — all stored locally, all exportable.
- **Checks run when you look, and only then** — no polling, no background task, no scheduler. Opening the board checks anything older than 15 minutes; Check all / Check now does it on demand. Every figure says how many checks it is over, because "uptime" here counts *the checks taken*, never wall-clock time.
- **Three failures in a row is an incident** — derived from the stored verdicts by a pure function, so the rule can improve without a migration. A verdict, by contrast, is *recorded* at the moment it is judged, so changing what a target expects tomorrow never rewrites yesterday.
- **Honest about the two runtimes** — on the tablet a check reads the real HTTP status; in a browser it cannot (a cross-origin response is opaque), so a web result is labelled **reachable**, never "up", and the board says so in a sentence whenever the numbers came from a browser.
- **What a target can require** — the only status that counts as up (or "anything below 500"), a time budget above which a response is slow but still up, a pause that keeps the history, and a note.
- **Pure logic, verified** — the verdict, the windows, the incident runs, the latency spread, the URL parser, every label and (since v0.7.1) the standing that More and Today both render live in `src/lib/sentinel/status.ts`, covered by **ninety known-answer checks** (`src/lib/sentinel/self-check.ts`).

Surfaces touched: More gains its **Sentinel** section; new route `/sentinel` (board, `[id]`, `site-form`); `src/lib/sentinel/*` + `src/components/sentinel/*` (`latency-chart`, `site-card`); `searchEverything()` grows a **fifth** kind; **schema v4** and export `version: 3` ([[06-data-model]]).

## v0.7.1 — the two categories get a front door *(built 2026-10-19)*

No new feature: a fix to how the two releases above are *reached*, because both were reachable and both were invisible ([[07-decisions]] ADR-024).

- **More opens with a shelf, not a list of settings.** Bench and Sentinel are `FeatureCard`s — a 44px tone-tinted icon well, the promise, and a **live pill** — so they read as places rather than as two more preferences next to "Theme". The reach path does not change: still More, still no sixth tab (ADR-001).
- **Sentinel's standing is on Today.** A strip between the day's tallies and the week: absent until a URL is watched, `accent` when everything is fine, `ember` for slow, `danger` for down or (in a browser) unreachable. It is the *same component and the same sentence* as the More card — one pure function, two screens — and it **never runs a check**, so opening Today cannot fire requests at the user's servers; it says when the answer was measured instead, and it is the reason the tab bar still needs no badge.
- **Bench's tools are findable.** `/search` matches `BENCH_TOOLS` with the shelf's own `searchTools()`, so "sha256", "base64" or "jwt" opens the tool instead of returning nothing — the toolbox was the one thing the app's global search could not see. `searchEverything()` is unchanged (five kinds); the sixth group is matched by the screen, because a tool is code, not a row.
- **A failed read is still not an empty one** — the card says "Could not read the board" rather than showing no pill, and an empty board says "Nothing watched yet" in the neutral tone.

Surfaces touched: `src/components/ui/feature-card.tsx` (new, now part of the design system, [[04-design-language]]), `src/components/sentinel/standing-strip.tsx` (new), `standingOf()`/`standingLine()` in `src/lib/sentinel/status.ts` (+12 known-answer checks → 90), `useSentinelStanding()` in `use-sentinel.ts`, More's shelf, Today's strip, and `/search`'s sixth group; **no schema change, no new dependency, no new export version**.

## v0.8 — Notes, written in blocks *(built 2026-10-19)*

The oldest feature in the app gets the largest single rework since v0.1, and it is a rework of *how a note is written*, not of what a note is: the note is still one column of markdown lines ([[07-decisions]] ADR-025), so nothing else in the app has to change — search, export, the seed and every note already on disk keep working exactly as they did. It replaces the v0.1 "markdown preview" with a real editor:

- **Blocks, not a preview.** The body is read as blocks (a heading, a bullet, a to-do, a quote, a fence, a divider, a paragraph) and each is *rendered*; only the block you are in is a text field. Inline marks resolve outside it, so a bold word looks bold everywhere except the word you are editing.
- **Keyboard first, toolbar second.** Markdown input rules as you type (`# `, `- `, `+ `, `1. `, `[] `, `> `, a fenced code block, `---`), Enter that continues a list / starts a task / *leaves* an empty list item, Backspace at the head of a block that merges it into the one above with the caret at the join, and `/` on an empty block for the type menu.
- **A format bar that says what is on.** Bold, italic, strike, inline code, highlight, two kinds of link, headings, lists, to-do, quote, code block, divider, indent/outdent — one scrollable row, with undo/redo and the block menu pinned right. It reflects the caret instead of holding state, and every action is a pure edit of the text.
- **Wikilinks — the piece other apps make you pay for.** `[[Title]]` or `[[Title|Alias]]` links one note to another, with a picker, a live render (an unresolved link offers to *create* the note), and **backlinks** on the receiving note. No links table and no schema: a link is text, resolution happens at render time, and backlinks are one `LIKE` query, so a rename cannot break an inbound link and a delete cannot leave a dangling row.
- **The reader.** A read mode that draws the whole note with the syntax gone, to-dos you can tick in place, tappable wikilinks and a `LINKED FROM` footer.
- **Actions, not just a text box.** The · sheet carries **Outline** (jump to a heading, with the caret landing there), **Turn to-dos into tasks** (a preview of exactly what will be created, through Today's own `parseTaskInput` + `createTask`), **Focus on this note** (a real focus block, attributed to the note's project), **Copy as markdown**, pin and a two-tap delete.
- **A block sheet, not drag handles.** Turn into / insert below / duplicate / move up / move down / indent / outdent / delete. Drag-to-reorder is *deliberately* not built and is in [[08-backlog]] with its condition ([[07-decisions]] ADR-025 — a drag that starts on the text field's own hit target is a fight, not a feature).
- **Pure logic, verified.** The whole editor is `body → body` functions in `src/lib/notes/*`, covered by **190 known-answer checks** — including the two rules that keep it safe: only the lines you touched are rewritten, and there is always at least one block.
- **Two bugs the browser drive found, both fixed here:** an **autosave still in flight could mark an older draft clean**, after which the refresh adopted a row behind the screen and the last line typed disappeared; and on web a `Modal` is a **focus trap that hands focus back when it closes**, so an outline jump takes the caret only once the sheet reports it is gone (native has no trap and takes it at once).

Surfaces touched: `src/app/note/[id].tsx` (the fixed-chrome editor), `src/components/notes/*` (new: block-editor, format-bar, block-sheet, rich-text, reading-view, link-sheet, extract-sheet), `src/components/ui/bottom-sheet.tsx` (new, the app's one sheet), `src/lib/notes/*` (new) + its self-check, `findNoteBacklinks()` in the repository, `src/app/(tabs)/notes.tsx` (tag filter chips, prose previews); **no schema change, no new dependency, no export version bump**.

## v1 — the spine *(next)*

- Task scheduling follow-ons: energy pairing, manual reordering, due-date editing after creation.
- Time log editing and manual entries (the log is read-only today).
- Git dashboard follow-ons: pin the repos you care about, a commit/contribution feed. (Review *actions* — approve, request changes, comment, merge — **shipped** in v0.5 along with the rest of the two-way surface.)
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
