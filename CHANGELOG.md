# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). While the version is below 1.0, a minor bump adds features and a patch bump fixes bugs.

Every release is offline-first. No release adds a server, an account, or telemetry. Where a release changes the database schema or the export format, it says so.

## [Unreleased]

## [0.10.0] - 2026-10-29

### Added

- **The garden, handcrafted.** Every piece of the pixel garden is redrawn and the world gained depth and life: a twelve-stop sky with a dithered last-light band, a cratered moon with a halo (a half-set sun at golden hour), three ridges with atmospheric fade and silhouette pines, a turning windmill, a meadow of swaying blades and flower drifts crossed by a footpath, and a foreground pond with lily pads, cattails and a moon glint. The tree grew up with it: a tapered four-tone trunk with a knot and root flare, visible limbs, a unified canopy outlined as one silhouette, contact shadows between foliage clumps, sun-kissed sparkles, and blossom past 82% growth.
- **A living world at rest**: fireflies at dusk and a moth at the lantern, a hopping, looking, pecking sparrow, falling leaves once the tree has a crown, the odd shooting star, drifting clouds, expanding pond ripples, and golden-hour butterflies over the flower drifts. Every creature is a pure function of the tick — deterministic, and frozen by `animated={false}` or the OS reduce-motion setting.
- **Time-log editing** (a Next-line item since v0.2): tap a finished block in the Garden log to move it to another project — billable recomputed from the destination's rate — or forget it entirely (soft-deleted, so the log, the invoice and the export agree). Plus **manual entry**: "Log a block" files work the timer never saw, 1–720 minutes, attributed like any other block.
- **Custom block lengths**: 25/50/90 remain on the chips, and a "custom" chip accepts 5–240 minutes, remembered in settings alongside the focus project.
- **The brand mark everywhere a logo applies**: the violet D-and-arrow now ships as the desktop rail's brand tile (white silhouette on the brand fill), the launch splash in both schemes, the landing page's header mark and favicon, and the social card. `tools/brand/make-marks.py` joins `make-icons.py` as the second generator from the one source artwork; `make-og.py` rebuilt with the real mark.
- Garden suite grown to **168** known-answer checks (**650** total): the new world's invariants are pinned — pond, windmill and footpath on wide frames only; the moon top-left; four-phase blade sway; blossom waiting for its season; canopy outline and contact shadow; lantern rest/lit frames of one shape; plates counted by the project query.

### Changed

- Version bumped to 0.10.0 (`package.json`, `app.json`); the landing page and social card quote 0.10.0 and the real check count.
- `docs/07-decisions.md` gained ADR-029 (the garden re-craft) and ADR-030 (the ledger is editable).

### Fixed

- The signpost's project plates hang flush against the post with outward-pointing tips and a nail (they used to float beside it as an unlabeled brown board).
- Clouds never spawn on the moon (a cloud crossing the disc read as a bite out of it on the first frame).
- The sparrow is a sparrow — hedge browns with a pale breast, not slate on stone — and the fern reads against the meadow (brighter fronds, lit crown).

## [0.9.0] - 2026-10-29

### Added

- **The pixel garden.** The Focus Garden is rebuilt as procedural pixel art: the tree grows in code from `(seed, growth)` (`src/lib/garden/tree.ts`), the world — banded twilight or golden-hour sky, stars, moon and low sun, drifting clouds, hill silhouettes with pines, meadow, soil clearing with growth rings — is generated per frame size (`scenery.ts`), and props are hand-authored grids (`sprites.ts`). One renderer for Android and web via react-native-svg; ~100 SVG nodes per frame.
- **Focus-reactive atmosphere**, kept from the 3D days and made louder: the sky burns into golden hour while a block runs, the lantern's halo pulses, and fireflies gather at the glass. Motion steps at ~4 fps, honours the OS reduce-motion setting, and `animated={false}` freezes the frame.
- Deterministic prop placement retained: dressing tiers unlock with growth, the signpost still hangs one plate per active project, and trophies (mushrooms per two hours, daisy patches at 3/7-day streaks, a cairn at six hours, a sparrow at five days) are unchanged.

### Removed

- **All 3D**: `assets/models/` (fifteen GLB files), `src/lib/three/` (platform shim, kit, loaders), `tools/blender/` and `tools/preview/` (the Blender pipeline and GPU-less renderer), and the dependencies `three`, `@react-three/fiber`, `@types/three` and `expo-gl`. No WebGL capability check remains in the app.
- `.agents/skills/graphify/` — the vendored skill with no recorded upstream or licence (flagged by this repository's own `.agents/skills/LICENSE`). `NOTICE` updated.

### Changed

- `docs/05-blender-pipeline.md` replaced by `docs/05-pixel-garden.md`; architecture, decision log (new ADR-028), backlog, README, AGENTS.md and the landing page updated to match.
- Version bumped to 0.9.0 (`package.json`, `app.json`).

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
