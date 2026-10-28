---
tags: [devlofy, moc]
created: 2026-10-17
---

# Devlofy — documentation index

This folder is an **Obsidian vault**. Open it directly in Obsidian (`Open folder as vault`) and every `[[link]]` below becomes part of the graph view. `graphify` can also index the codebase into `graphify-out/` (see [[03-architecture]]).

## Start here

- [[01-vision]] — what Devlofy is, who it's for, the wedge.
- [[02-scope]] — what's in, what's out, which phase, which platform.
- [[03-architecture]] — the stack, adapter architecture, folder map, commands.
- [[04-design-language]] — **neutral ground, hairline boxes, one violet**: the visual system and its rules.
- [[05-blender-pipeline]] — how 3D models get made and integrated.
- [[06-data-model]] — SQLite schema, migrations, sync-readiness.
- [[07-decisions]] — the decision log (ADRs).
- [[08-backlog]] — feature budget, next, later.
- [[09-platform-ceiling]] — feasibility research: what the platforms allow (GitHub writes, SSH, terminals, and what is a hard no). Its GitHub section is now a **decision taken** (ADR-020); the SSH/terminal tiers are still just research.
- [[10-categories]] — the six candidate categories for what comes after v0.5 (Bench, Sentinel, Ledger, Atelier, Chronicle, Flow) with their screens, data, tiers and effort, plus the ruling on each. **Bench shipped in v0.6 and Sentinel in v0.7; Ledger is next.**

## The one-liner

> Devlofy is the offline-first command center for solo developers — plan your day, run your clients, ship your projects, get paid, and level up. All data on your device. A game-like focus garden in 3D.

## Status (2026-10-19)

- v0.1 foundation is **built**: Today, Garden (3D), Work, Notes, More + desktop mode.
- v0.2 "working day" is **built**: precise motion, project attribution for focus blocks, time tracked per project, a twelve-week rhythm heatmap, a daily focus goal, and a quick-add task grammar ([[02-scope]]).
- v0.3 "the majors" is **built**: **the Engine** (Next up with its reasons, plus your rhythm and estimate drift learned from your own session log), **money-lite** (rates → billable blocks → an invoice draft you can copy), and **search** over everything (⌘K on web). Schema v2 ([[06-data-model]], [[07-decisions]] ADR-016 → 018).
- v0.4 "GitHub" is **built**: a read-only dashboard of what is waiting on you (review requests, your PRs, assigned issues, the newest CI run per recently pushed repo), reachable from Work, with a pasted token or on-device device-flow sign-in and a dated snapshot so it degrades instead of emptying ([[07-decisions]] ADR-019). No schema change.
- v0.5 "GitHub two-way" is **built**: the dashboard became the code host — browse and edit files with this app's own highlighter, commit to a branch and open the pull request (never the default branch, diff first, non-forced, `409`-aware), review and merge, file and triage issues, dispatch and re-run Actions, cut a release from GitHub's generated notes, and read the inbox. Reverses ADR-019's read-only rule under **ADR-020**; twelve screens under `/github` (plus the v0.4 hub, which is where they hang from); still no schema change.
- v0.6 "Bench" is **built**: a new **category** — the offline dev toolbox. Eleven tools (JSON, SQL, Diff, Regex, Text, Encode, JWT, Hash, Epoch, Cron, Colour) that each compute as you type, opened from a shelf in **More** (not a sixth tab) and all processing on the device: your JWTs, tokens, configs and diffs never leave it. Pure logic in `src/lib/bench/*` under **eighty known-answer checks**; what you keep is user content, so **schema v3** adds `bench_snippets` and `exportAll()` carries it ([[07-decisions]] ADR-021, [[06-data-model]]). The same release closes the Garden's last open model item: a **code-authored 3D kit** — a bench that unlocks with growth and a **signpost with one plate per active project**, plus a code model for every non-trophy prop, so the garden is dressed even when a GLB never arrives ([[07-decisions]] ADR-022, [[05-blender-pipeline]]).
- v0.7 "Sentinel" is **built**: the second new **category** — a board that answers *is anything of mine down?* over the URLs you own. Status, latency, three-failures-in-a-row incidents, a latency strip per target, 24h/7d/30d reliability and a full check log, all stored locally and all exported. Checks run **when you look** (no daemon, no polling), a verdict is *recorded* at the moment it is judged while an incident is *derived*, and the browser's half-truth is labelled — a web check says **reachable**, never "up" ([[07-decisions]] ADR-023). **Schema v4** (`watch_sites`, `watch_checks`) and export `version: 3`; seed state and **90** known-answer checks in `src/lib/sentinel/self-check.ts`. Since v0.7.1 both categories are reached from a **feature shelf** at the top of More — a card, not a settings row — and Sentinel's standing is summarised by a strip on **Today**, so a target that is down is visible before you think to look ([[07-decisions]] ADR-024).
- v0.8 "Notes" is **built**: the app's oldest feature rebuilt on a **block model that is a view over the markdown lines already on disk** — so search, export, the seed and every existing note are untouched and there is no migration. Blocks render, one `TextInput` is mounted for the block you are in, markdown input rules apply as you type, Enter continues or leaves a list, Backspace merges with the caret at the join, a format bar reflects the caret, and a per-block sheet does what drag handles would ([[07-decisions]] ADR-025). The flagship addition is **`[[wikilinks]]` with backlinks** — resolved against note titles at render time, with backlinks as a `LIKE` query rather than a links table. Plus a reader that replaced the markdown preview, tickable to-dos, an outline that jumps, **turn to-dos into real tasks** (through Today's own grammar), **focus on this note**, and copy-as-markdown. All logic is pure `body → body` in `src/lib/notes/*` behind **190 known-answer checks**; no schema change, no new dependency, no export bump.
- Targets: **Android (native) + web** now; iOS later. Tablets included — desktop mode ships with v0.1.
- Blender: models are integrated day one via the MCP pipeline; when no Blender session is available the garden's code-authored kit answers instead, and `tools/preview/` renders the code kit to a PNG without a GPU ([[05-blender-pipeline]]).
