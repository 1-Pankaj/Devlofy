---
tags: [devlofy, backlog]
created: 2026-10-17
---

# Backlog

**Rule (ADR-001):** nothing enters "Next" unless something leaves or it replaces something. "Later" is a parking lot, not a promise.

## Next (v1 candidates — pick by real friction)

> **Category candidates are now written down**: [[10-categories]] holds the six big
> ones (Bench, Sentinel, Ledger, Atelier, Chronicle, Flow) with screens, data, tier
> and effort. **Bench shipped in v0.6** ([[07-decisions]] ADR-021, [[02-scope]]);
> by that note's order the next category build is **Sentinel** — "is production
> up?" — which is the one that needs an ADR for its polling story before code.

- [ ] Task scheduling follow-ons: energy pairing, manual reorder, editing due date/estimate after creation. ("Focus on this task" **shipped** in v0.3 — the Next up card starts a block attributed to the task.)
- [ ] Time log editing: manual entries, edit/delete a session, move a block to another project. (Billable flags and per-project totals **shipped** in v0.3.)
- [ ] Git dashboard follow-ons: **pinned repos** (choose the five that matter instead of "most recently pushed") and a commits/contributions feed. (Review *actions* — approve / request changes / comment / merge — and the rest of the two-way surface **shipped** in v0.5.)
- [ ] Token, hardening: move the GitHub token to `expo-secure-store` (Android Keystore). *See the corrected note in the Tier A list below: it ships in Expo Go, so this is cheaper than first written ([[07-decisions]] ADR-019).*
- [ ] Notifications: focus-end + daily planning reminder (mobile-only; expo-notifications has no web support).
- [ ] Weekly review ritual: this week vs last, per-project split, what slipped, one-tap carry-over of unfinished tasks.
- [ ] Learning track: FSRS spaced repetition over notes + tips; game-dev content pack (Unity/Godot recipes).
- [ ] Client comm log entries on the client detail screen (calls, emails as notes).
- [ ] Project templates (tasks + milestones from a template) — promoted from Later; the shape is already in the seed.
- [ ] Unit tests for the pure modules (`engine/*`, `money.ts`, `parse-task.ts`, `github/api.ts`, `github/device.ts`) — the modules where a silent wrong number would go unnoticed. **The runner question is answered**: v0.6 shipped `src/lib/bench/self-check.ts`, eighty known-answer checks that run under Node against emitted JS with no dependency at all ([[03-architecture]]). That is the pattern to extend, not vitest — and the Engine and the GitHub parsers are the next two files that deserve one.

### Tier A candidates — pure HTTPS, no new native dependency ([[09-platform-ceiling]])

All of these run on Android **and web**, inside Expo Go. Ranked by value ÷ risk in that note.

- [x] **GitHub two-way** *(shipped v0.5)*: browse/read files with syntax highlighting, edit → commit to a branch → open a PR, submit a review (approve / request changes / comment), merge (merge/squash/rebase), issue triage, Actions control (dispatch / re-run / cancel), releases from generated notes, notifications inbox. Reversed ADR-019's read-only rule with **ADR-020** and the write-safety design (never the default branch at all, diff before commit, no force-push, no branch deletion, nine bounded endpoints). **Not built on purpose:** gists (a second snippet store is not where the value is — dropped from the design, and `createGist`/`deleteGist`/`listGists` were deleted from `repo.ts` rather than left as dead code) and Actions log download (a 302 to a ZIP that expires in ~60 s belongs in a desktop browser).
- [ ] **Repo ⇄ project binding**: a project page shows *its* repo's open PRs and its CI; that is what no standalone GitHub client can do.
- [ ] **The closed loop**: a failed check becomes a task in Today (with a block and an estimate), a merged PR becomes an invoice line, commit activity feeds the rhythm heatmap, a merged PR grows the Garden.
- [ ] **Watching your back while closed**: `expo-background-task` (verified **in Expo Go**) polls CI/reviews and posts a **local** notification (local notifications work in Expo Go; remote push needs a dev build; no web at all).
- [x] **Offline dev toolbox — shipped as `Bench` in v0.6** ([[10-categories]], [[07-decisions]] ADR-021). The shelf, the eleven tools, the `bench_snippets` table (schema v3) and the eighty known-answer checks are in `/bench`; **YAML and XML were dropped on purpose** rather than shipping a half-parser. The **HTTP/API client** with saved requests + environments (a mini-Insomnia, reusing the credential store) remains below as Bench's *second* release, because it needs the network path and an honest CORS story on web.
- [ ] **Bench, second release — the HTTP/API client**: saved requests with methods/headers/bodies, environments and variables, a response viewer reusing `CodeBlock`, history, and a documented CORS story for web (the app has no proxy, so a browser request is a browser request). Needs an ADR before it ships: it is the second networked feature, and it must not become a place to store secrets carelessly — the KV credential store is the only acceptable home for a token, and the UI has to say where it lives.
- [ ] Token hardening, corrected: `expo-secure-store` (Android Keystore) **is in Expo Go**, so the earlier "needs a dev-build check" caveat on this line was wrong — it can ship in Tier A.

### Tier B candidates — need a development build, Android only ([[09-platform-ceiling]])

Nothing here starts until a spike proves the transport.

- [ ] **Spike: SSH transport.** Prove or kill pure-JS `ssh2` + `react-native-tcp-socket` (or a New-Arch-compatible libssh2 wrapper) on the tablet in a dev build. `react-native-ssh-sftp` has had no npm release in over a year and its New-Arch support is unverified — RN 0.88 is New-Arch-only, so an unported module is a hard stop.
- [ ] **Spike: terminal view.** `expo-libghostty` 0.8.1 (MIT, real libghostty VT core, bring-your-own-PTY) is documented for SDK 57 and needs a compatibility check on 58; fallback is xterm.js in `react-native-webview`.
- [ ] **Connect** (only after both spikes): saved SSH hosts with host-key verification, pure-JS Ed25519 keygen + one-tap "add this key to GitHub", one-shot remote commands with the block timer running, SFTP, and an SSH terminal themed from `src/theme`. Remote-only; a local shell is a worse Termux in a prettier frame.

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
- Real git client on mobile — dashboard only; mobile git is a trap. **Sharpened ([[09-platform-ceiling]]):** the API *can* commit and open PRs (Tier A), so what stays rejected is the *working tree* — clone, rebase, merge-conflict resolution, LFS, submodules. A commit through the API is not a compromise; a half-working git in a pocket is.
- Team features — solo-first; multi-user is a different product.
- Third-party component kits for the core UI — see ADR-004.
- **A Termux-class userland inside Devlofy — blocked by the platform, not by taste.** Android 10+ forbids executing binaries from the app's writable data dir, so it would mean baking a distribution (and a proot rootfs) into the APK: hundreds of MB, and a duplicate of the Termux already on the device. See [[09-platform-ceiling]].
- **A local shell (toybox, no package manager) for its own sake** — superseded by the remote-only terminal; a worse Termux in a prettier frame.

## Feature budget ledger

| Cycle | In | Out / deferred |
|---|---|---|
| v0.1 (2026-10-17) | Today, Garden 3D, Work (projects/clients), Notes, More, desktop mode, export | iOS native, notifications, git, invoicing, FTS |
| v0.1 polish (2026-10-17) | Safe-area pass, live timer heroes, quick-add tasks, focus blocks w/ auto-close, editor templates + markdown preview, client detail, animated ring/dot primitives, crash boundary | Task scheduling (due/energy), comm log, notifications, time-log editing |
| 3D world v2 (2026-10-17) | Trees v3 (visible branch scaffold, lobed crowns, knuckles, twig tips), 11-prop Blender kit (rock…lantern…bird), growth-tiered dressing, data-driven trophies, focus-reactive lantern glow | none displaced — Garden depth is additive |
| Design + features wave (next) | Type scale + elevation pass, premium empty states, notes upgrades (checklists, tags + search, pin, links), full client/project add-edit | Scoped into v0.2 and v0.3 below |
| v0.2 working day (2026-10-18) | Precise motion (no overshoot anywhere), project attribution for focus blocks, per-project time tracked, 12-week rhythm heatmap, daily focus goal, quick-add task grammar w/ parse preview, due-date-ordered queue + due pills | Task scheduling follow-ons (energy pairing, reorder, editing dates after creation), command palette — deferred to v1, listed above |
| v0.3 majors (2026-10-18) | **The Engine** (Next up ranking + reasons, rhythm/peak band, median block, estimate drift) with task-attributed blocks; **Money-lite** (schema v2 rates, auto-billable blocks, `/invoice` draft + copy-as-text, currency setting); **Search** (`/search` over four kinds, ⌘K on web, act-in-place rows) | Backlog dents, not new debt: focus-from-task, the money-lite line, and the command-palette line are struck through above; Task scheduling follow-ons, time-log *editing*, git dashboard, notifications, weekly review, project templates stay in Next |
| v0.4 GitHub (2026-10-18) | **`/github`**: read-only dashboard (review requests, own PRs, assigned issues, newest CI run per recently pushed repo, repo list), pasted-token + device-flow sign-in, KV snapshot cache with staleness shown, honest per-section partial reads, Work entry row | The git-dashboard line is now a follow-on line (pinned repos, commits feed, review actions) plus token hardening; **no schema change** — the cache is a KV value, so the database stays user content only |
| Research (2026-10-18) | **Nothing shipped.** [[09-platform-ceiling]]: a feasibility map of the three platform tiers, the full GitHub write surface with endpoints and scopes, the SSH/terminal ecosystem as it actually stands, and the platform fact that kills an in-app Termux | Nothing displaced — research is not a feature, and the tier-A/B candidate sets are parked above rather than promoted |
| v0.5 GitHub two-way (2026-10-19) | **Twelve screens under `/github`**: hub (waiting-on-you + repos), repository, browse, blob with the app's own syntax highlighter, **edit → branch → PR** (diff before commit, non-forced ref update, `409` recovery), pull requests + review + merge, issues + new-issue + triage, Actions (runs, checks, dispatch with inputs, re-run, cancel), a **notifications inbox**, and **releases** (list + cut one, with GitHub-generated notes). Reverses ADR-019 under the ADR-020 branch rule; own `base64`/`diff`/`patch`/`highlight` modules, no new dependency | The **gists** and **Actions-log** lines are struck from the design (dead exports deleted with them); "Repo ⇄ project binding" and "the closed loop" stay in Tier A below; **no schema change** — GitHub data is still KV, so the database remains user content only |
| v0.6 Bench (2026-10-19) | **A new category, entirely offline**: `/bench` (shelf + one host route + kept snippets) with **eleven tools** — JSON, SQL, Diff, Regex, Text, Encode, JWT, Hash, Epoch, Cron, Colour — each computing as you type, all pure logic in `src/lib/bench/*` and all covered by **eighty known-answer checks**. Snippets are user content → **schema v3 `bench_snippets`**, re-opened in the tool that made them. Plus a shared-hunk-header fix and a real bug fixed in v0.5's `diffLines` (it printed the wrong context line whenever two sides shared a leading line). No new dependency | Bench's **HTTP/API client** is split off as its own next line (it needs the network path and an honest CORS story); **YAML and XML are dropped rather than half-parsed**; the unit-test line now points at `self-check.ts` instead of vitest; Bench added to the export dump (format `version` → 2) |
