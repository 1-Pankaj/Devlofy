# Changelog

All notable changes to Devlofy are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — read against a pre-1.0 version, where a minor bump is the feature budget and a patch is a fix that changes no behaviour.

Everything in this project is offline-first by default: no release below adds a server, an account, or telemetry. Where a release changes the SQLite schema or the export dump, that is stated, because it is the one thing a user's data cares about.

## [Unreleased]

### Added

- **The Engine now has known-answer checks** (`src/lib/engine/self-check.ts`, 122 of them). The ranking is the app's only hidden opinion — a weight table nobody can see — so every weight, every reason string it can produce, the overdue decay and its floor, the priority clamp, the three-reason cap and its ordering, each tie-break in `rankTasks`, the peak band including one that wraps past midnight, and both ±15% boundaries of the drift sentence are pinned. Total across the four suites: **482 checks**.
- `SECURITY.md` — the threat model the code actually has: the GitHub token, Sentinel's probes, local data, and the web build's cross-origin isolation
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) and `.github/` templates for issues and pull requests
- `CHANGELOG.md`, `.editorconfig`, `.gitattributes`, `.nvmrc`
- `tools/checks/self-check.sh` — runs all four known-answer suites as one command, used by `npm run check`
- `.github/workflows/ci.yml` — typecheck, lint and the suites on every push and pull request

### Changed

- `LICENSE` is now MIT held by the project's author, with the Expo template's attribution moved to a new `NOTICE` file — the previous file credited 650 Industries for the whole tree
- `README.md` rewritten to describe the app at v0.8 rather than the v0.1 foundation it still documented
- `package.json`: version aligned to the app's real `0.8.0` (was `1.0.0`), `license: MIT`, and `check` / `typecheck` / `lint` / `self-check` scripts
- Expo modules bumped within SDK 58 (`expo` 58.0.14 → 58.0.19 and seven others), `expo-doctor` now clean

### Fixed

- Nothing user-facing — this release is packaging and verification only

## [0.8.0] — 2026-10-19

The release that rebuilt the app's oldest feature without moving a byte of anyone's data.

### Added

- **Notes as blocks that are a view over markdown lines.** `parseBlocks()` reads the saved body, every edit is a pure `body → body` function, and the note stays one `TEXT` column that search, export and old notes still understand. No migration.
- **`[[wikilinks]]` with backlinks.** A picker inserts them, the reader makes them tappable, backlinks are one escaped `LIKE` query rather than a links table.
- Markdown input rules as you type, Enter that continues or leaves a list, Backspace that merges with the caret at the join, a format bar that follows the caret, an outline that jumps, tickable to-dos, to-dos that become real tasks through Today's own grammar, focus-on-this-note, and copy-as-markdown.
- A per-block sheet for reordering — deliberately not drag handles.
- **190 known-answer checks** for the block model in `src/lib/notes/self-check.ts`.

### Fixed

- On web, a textarea's two-row floor made every block twice as tall as on a phone; exactly one row is rendered now.

## [0.7.1] — 2026-10-19

### Added

- **A front door for the two categories.** More opens with a `FeatureCard` shelf — icon well, promise, and a live pill — instead of settings rows (ADR-024).
- **Sentinel's standing on Today**: a strip that appears only when something is watched, shows the same sentence as the More card, and never runs a check itself.
- Bench's tools in global search, so `sha256` or `base64` opens the tool.

## [0.7.0] — 2026-10-19

### Added

- **Sentinel** — is anything of mine down? Status, latency, incidents (three failures in a row), uptime windows and a full check log over URLs the user owns. Checks run **when you look**, never on a timer; a verdict is recorded at the moment it is judged while an incident is derived; a browser check says *reachable*, never "up" (ADR-023).
- 90 known-answer checks for the verdicts, windows, incidents and labels.
- **Schema v4**: `watch_sites`, `watch_checks` (the one table with no `deleted_at`, pruned to the newest 500 per target). Export dump `version: 3`.

## [0.6.0] — 2026-10-19

### Added

- **Bench** — the offline dev toolbox as a new category: JSON, SQL, Diff, Regex, Text, Encode, JWT, Hash, Epoch, Cron, Colour. Eleven tools that compute as you type, never touch the network, and add no dependency.
- 80 known-answer checks, and a snippet store so what you keep re-opens in the tool that made it.
- **Schema v3**: `bench_snippets`. Export dump `version: 2`.
- **A code-authored 3D prop kit** — a bench that unlocks with growth, a signpost with one plate per active project, and a code model for every non-trophy prop, so the garden is dressed even when a GLB never arrives (ADR-022). `tools/preview/render.js` renders it without a GPU and asserts the geometry invariants.

## [0.5.0] — 2026-10-19

### Added

- **GitHub two-way, branch-bounded** — browse and edit files with the app's own highlighter, commit to a branch (never the default one), diff before commit, review and merge, file and triage issues, dispatch and re-run Actions, cut a release, read the inbox (ADR-020). Twelve screens under `/github`.

## [0.4.0] — 2026-10-18

### Added

- **GitHub, read-only** — what is waiting on you: review requests, your pull requests, assigned issues, the newest CI run per recently pushed repo. Two ways in: a pasted token, or device-flow sign-in on native (ADR-019). Every section fetched independently, so one failed permission is a sentence rather than a blank screen.

## [0.3.0] — 2026-10-18

### Added

- **The Engine** — pure functions over your own rows: next-up ranking where every score carries a reason, your working rhythm, and estimate drift learned from your session log (ADR-016).
- **Money** — rates on the project, billable blocks marked at start, and an invoice as a view over the session log rather than a stored document (ADR-017).
- **Search** — one screen over projects, clients, notes and tasks, `⌘K` on web (ADR-018).
- **Schema v2**.

## [0.2.0] — 2026-10-18

### Added

- Precise motion across the app, and **no overshoot anywhere** — a duration against one of two curves, never a spring (ADR-015).
- Focus blocks attributed to a project (a persisted setting, per-project time as a query), a twelve-week rhythm heatmap, and a daily focus goal.
- The task quick-add grammar (`!3`, `45m`, `tomorrow`, `#Project`) with chips that state exactly what will be created.

## [0.1.0] — 2026-10-17

### Added

- **The foundation**: Today, Garden (3D tree from real focus data), Work (projects, milestones, clients), Notes, More (theme, desktop mode, export).
- **Local SQLite as the product** — no backend, no cloud AI, no account. Adapter pattern for platform code, design tokens only.
- **Desktop mode from day one**: expanded widths get a side rail, compact keeps the floating tab bar.
- **Blender pipeline** — GLBs authored through the MCP, loaded on native and web, with a procedural fallback.

[Unreleased]: https://github.com/1-Pankaj/Devlofy/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.8.0
[0.7.1]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.7.1
[0.7.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.7.0
[0.6.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.6.0
[0.5.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.5.0
[0.4.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.4.0
[0.3.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.3.0
[0.2.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.2.0
[0.1.0]: https://github.com/1-Pankaj/Devlofy/releases/tag/v0.1.0
