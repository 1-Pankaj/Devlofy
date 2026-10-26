# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). While the version is below 1.0, a minor bump adds features and a patch bump fixes bugs.

Every release is offline-first. No release adds a server, an account, or telemetry. Where a release changes the database schema or the export format, it says so.

## [Unreleased]

### Added

- Engine tests: 122 checks in `src/lib/engine/self-check.ts` covering the ranking weights, every reason string, the overdue decay, tie-breaks, the peak-hours band and estimate drift. Total across all suites is now 482.
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `NOTICE`
- `.github/` issue forms, pull request template, CODEOWNERS and Dependabot config
- `.editorconfig`, `.gitattributes`, `.nvmrc`
- `tools/checks/self-check.sh`: runs all test suites with one command

### Changed

- `LICENSE` is now MIT with the correct copyright holder. The Expo template credit moved to `NOTICE`.
- `README.md` rewritten for the current version.
- `package.json`: version set to `0.8.0`, license field added, and `check`, `typecheck`, `lint`, `self-check` scripts added.
- Expo packages updated inside SDK 58 (`expo` 58.0.14 to 58.0.19 and seven others). `expo-doctor` now passes all 20 checks.

## [0.8.0] - 2026-10-19

### Added

- **Markdown notes in blocks.** The note body is read as blocks, and every edit is a pure text-to-text function. Notes stay a single markdown column, so search, export and existing notes still work. No migration.
- **`[[wikilinks]]` with backlinks.** Backlinks use one indexed query, not a separate table.
- Markdown shortcuts while typing, Enter that continues or ends a list, Backspace that merges blocks, a formatting bar that follows the caret, an outline, tickable to-dos, "make tasks from to-dos", focus on a note, and copy as markdown.
- A per-block menu for moving and formatting blocks.
- 190 tests for the note editor in `src/lib/notes/self-check.ts`.

### Fixed

- On web, each note block was twice as tall as on Android because of a textarea minimum height.

## [0.7.1] - 2026-10-19

### Added

- **Feature cards in More.** Bench and Sentinel now appear as cards with an icon, a short description and a live status label instead of plain rows.
- **Sentinel status on Today.** A strip appears when anything is watched, using the same wording as the More card. It never runs a check itself.
- Bench tools now appear in global search, so "sha256" opens the Hash tool.

## [0.7.0] - 2026-10-19

### Added

- **Sentinel**, uptime checks for your own URLs: status, latency, incidents (three failures in a row), uptime windows and a full check log. Checks run only when you open the board or press the button.
- 90 tests for verdicts, windows, incidents and labels.
- **Database schema v4**: `watch_sites` and `watch_checks`. Export format version 3.

## [0.6.0] - 2026-10-19

### Added

- **Bench**, 11 offline developer tools: JSON, SQL, Diff, Regex, Text, Encode, JWT, Hash, Epoch, Cron, Colour. Everything computes as you type and nothing leaves the device.
- 80 tests, plus saved snippets that reopen in the tool that created them.
- **Database schema v3**: `bench_snippets`. Export format version 2.
- **A code-built 3D prop kit**: a bench that unlocks as the garden grows, a signpost with one plate per active project, and a model for every prop, so the garden is never empty when a GLB is missing. `tools/preview/render.js` renders it without a GPU and checks the model rules.

## [0.5.0] - 2026-10-19

### Added

- **GitHub write access, limited to branches.** Browse and edit files with syntax highlighting, commit to a new or existing branch, view the diff before committing, open and merge pull requests, file and label issues, re-run Actions, and create releases. Commits to the default branch are not possible. Twelve screens under `/github`.

## [0.4.0] - 2026-10-18

### Added

- **GitHub read-only dashboard**: review requests, your pull requests, assigned issues and recent CI runs. Sign in with a pasted token, or with device flow on native.
- Each section loads on its own, so one missing permission shows a message instead of an empty screen.

## [0.3.0] - 2026-10-18

### Added

- **The Engine**: local rules that rank what to do next and show a reason for each suggestion, plus your working hours and estimate accuracy.
- **Money**: hourly rates on projects, billable time tracked when a session starts, and an invoice generated from the session log.
- **Search** across projects, clients, notes and tasks, with `Cmd/Ctrl + K` on web.
- **Database schema v2**.

## [0.2.0] - 2026-10-18

### Added

- Precise motion across the app, with no overshoot anywhere.
- Focus sessions attributed to a project, per-project time totals, a 12-week rhythm heatmap and a daily focus goal.
- Quick-add task syntax (`!3`, `45m`, `tomorrow`, `#Project`) with a preview of what will be created.

## [0.1.0] - 2026-10-17

### Added

- First release: Today, Garden (3D tree grown from focus time), Work (projects, milestones, clients), Notes, and More (theme, desktop mode, export).
- Local SQLite storage, platform adapters, and design tokens.
- Desktop mode: wide screens get a side rail, phones keep the bottom tab bar.
- Blender-authored GLB models with a procedural fallback.

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
