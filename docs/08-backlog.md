---
tags: [devlofy, backlog]
created: 2026-10-17
---

# Backlog

**Rule (ADR-001):** nothing enters "Next" unless something leaves or it replaces something. "Later" is a parking lot, not a promise.

## Next (v1 candidates — pick by real friction)

- [ ] Task scheduling follow-ons: energy pairing, manual reorder, editing due date/estimate after creation, "focus on this task" from the queue.
- [ ] Time log: manual entries, edit/delete sessions, billable flag, per-project totals.
- [ ] Command palette / keyboard-first navigation in desktop mode (Linear-style).
- [ ] Git dashboard: GitHub device-flow auth (client ID only, token in `expo-secure-store`), last-synced cards for PRs/issues/CI, offline-degrades to cache.
- [ ] Notifications: focus-end + daily planning reminder (mobile-only; expo-notifications has no web support).
- [ ] Learning track: FSRS spaced repetition over notes + tips; game-dev content pack (Unity/Godot recipes).
- [ ] Client comm log entries on the client detail screen (calls, emails as notes).

## Later

- [ ] Project templates (tasks + milestones from a template).
- [ ] Pipeline board (lead → active → archived) with drag.
- [ ] Week/timetable view with drag-to-schedule.
- [ ] Invoicing drafts + PDF export (manual send only).
- [ ] Backup/restore file flow (`.devlofy` dump import).
- [ ] FTS5 native search + fuzzy match ranking; TF-IDF "related notes".
- [ ] Home-screen widgets (Android), share-sheet capture into Notes.
- [ ] Hover states + keyboard shortcuts in desktop mode.
- [ ] "The Engine" v1: local scoring that suggests the next task/energy pairing.
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
| Design + features wave (next) | Type scale + elevation pass, premium empty states, notes upgrades (checklists, tags + search, pin, links), full client/project add-edit | Scoped when it lands |
| v0.2 working day (2026-10-18) | Precise motion (no overshoot anywhere), project attribution for focus blocks, per-project time tracked, 12-week rhythm heatmap, daily focus goal, quick-add task grammar w/ parse preview, due-date-ordered queue + due pills | Task scheduling follow-ons (energy pairing, reorder, editing dates after creation, focus-from-task), command palette — deferred to v1, listed above |
