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
- [[04-design-language]] — **Material 3 Expressive**: the visual system and its rules.
- [[05-blender-pipeline]] — how 3D models get made and integrated.
- [[06-data-model]] — SQLite schema, migrations, sync-readiness.
- [[07-decisions]] — the decision log (ADRs).
- [[08-backlog]] — feature budget, next, later.

## The one-liner

> Devlofy is the offline-first command center for solo developers — plan your day, run your clients, ship your projects, get paid, and level up. All data on your device. A game-like focus garden in 3D.

## Status (2026-10-18)

- v0.1 foundation is **built**: Today, Garden (3D), Work, Notes, More + desktop mode.
- v0.2 "working day" is **built**: precise motion, project attribution for focus blocks, time tracked per project, a twelve-week rhythm heatmap, a daily focus goal, and a quick-add task grammar ([[02-scope]]).
- v0.3 "the majors" is **built**: **the Engine** (Next up with its reasons, plus your rhythm and estimate drift learned from your own session log), **money-lite** (rates → billable blocks → an invoice draft you can copy), and **search** over everything (⌘K on web). Schema v2 ([[06-data-model]], [[07-decisions]] ADR-016 → 018).
- v0.4 "GitHub" is **built**: a read-only dashboard of what is waiting on you (review requests, your PRs, assigned issues, the newest CI run per recently pushed repo), reachable from Work, with a pasted token or on-device device-flow sign-in and a dated snapshot so it degrades instead of emptying ([[07-decisions]] ADR-019). No schema change.
- Targets: **Android (native) + web** now; iOS later. Tablets included — desktop mode ships with v0.1.
- Blender: models are integrated day one via the MCP pipeline ([[05-blender-pipeline]]).
