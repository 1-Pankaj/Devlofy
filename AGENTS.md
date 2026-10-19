# Devlofy — agent guide

This is **Devlofy**, an offline-first command center for solo developers (Expo/React Native + web). Read this before any task.

## Product context (short)

- Personal-first app; user does client work + game dev under "Codeloom".
- **No backend, no cloud AI.** Local SQLite is the product. Intelligence = local rules/algorithms ("the Engine"), never a chat.
- Platforms: **Android native (primary, tablets included) + web (equal partner)**. iOS is later — keep code iOS-safe but don't build UI hunting for it.
- **Desktop mode is core scope**: expanded widths (≥840) get a side rail; compact gets the floating tab bar.
- **3D day one**: Blender-authored GLBs (sprout/sapling/canopy in `assets/models/`) over a procedural fallback; author more via the live Blender MCP (`get_addon_status` first). Two authoring paths now: a prop is answered by its GLB **or** by the code kit (`src/lib/three/kit/`) — never by nothing. See [[07-decisions]] ADR-022.
- Docs vault: `docs/` (wikilinks, Obsidian). Decision log: `docs/07-decisions.md` — read it before proposing architecture changes. Feature budget rule applies: new feature displaces one or goes to `docs/08-backlog.md`.

## Verify before writing API code

Expo changes every SDK. This project is **SDK 58** (react 19.3, RN 0.88, reanimated 4.7). Before touching Expo/RN APIs: read the major version in `package.json`, fetch `https://docs.expo.dev/versions/v58.0.0/`, and for anything else use `https://docs.expo.dev/llms.txt`. Never answer from memory.

## Commands

```bash
npx expo start                 # dev server (a=Android, w=web)
npx expo install <package>     # ALWAYS for deps — resolves SDK versions
npx tsc --noEmit               # typecheck — must be clean
npx eslint .                   # lint — must be clean
npx expo export --platform web # validates the full web bundle (wasm, r3f)
npx expo-doctor
```

Run **lint + typecheck before declaring any task done.** If a task touches UI, sanity-check the rules in `docs/04-design-language.md`.

## Architecture rules

- Routes only in `src/app/` (`_layout.tsx` = navigators). Everything else lives outside.
- **Adapters**: platform code is `x.ts` (type anchor) + `x.native.ts` + `x.web.ts`. Core never imports a platform-only lib. The 3D shim is `src/lib/three`.
- **Tokens only**: colors/spacing/type/motion come from `src/theme` — no hardcoded values in components.
- **Data**: all SQL lives in `src/lib/db/repo.ts`; screens use `useLiveQuery`. Migrations are append-only in `src/lib/db/migrations.ts` (update `docs/06-data-model.md` in the same change).
- **Reanimated 4 (compiler-safe)**: shared values use `.get()`/`.set()`; no `runOnJS` (use `scheduleOnRN`); press feedback via `PressableScale`; entrances via `FadeUp`; tokens from `theme/motion`.
- **Motion never overshoots**: there is no spring anywhere in the app — no `withSpring`, no `springify()`, no `spring` token — only a `duration` against the two curves in `theme/motion` (`easing.out`, `easing.emphasized`). A bounce is a bug.
- **Task quick-add grammar** is pure and lives in `src/lib/parse-task.ts` (`!3`, `45m`, `tomorrow`, `#Project`). The preview chips on Today must always state exactly what will be created; an unmatched `#tag` stays in the title.
- **Focus attribution**: the next block's project is a persisted setting (`focusProjectId`), read by both Today and Garden, written to `sessions.project_id`. Per-project time is a query, not a counter. A block may also carry `task_id` (the Engine's "Focus on this"), which is what makes estimate drift measurable.
- **The Engine** is `src/lib/engine/` — **pure functions over the user's own rows**, no model, no network: `rhythm.ts` (when you work, how long a block runs), `next-up.ts` (a documented weight table, and every score must produce a *reason* the UI can show), `estimate.ts` (estimated vs actual minutes). Wire it with `useEngine()`, never a bespoke query per screen.
- **Money**: rates live on `projects.hourly_rate` (falling back to `clients.hourly_rate`); a block is marked billable when it starts, and any "invoice" is a **view** over the session log (`src/lib/money.ts`), never a stored document. Money reads in `accent`; `ember` stays reserved for time.
- **Search**: `searchEverything()` (LIKE, **five kinds** — projects, clients, notes, tasks, watch targets) is the one global search; result rows must act (navigate, or complete a task in place) — no dead ends. Keyboard shortcuts are web-only via the `search-shortcut` adapter.
- **GitHub** (`src/lib/github/`) is **one of two** networked features, and it is **two-way but branch-bounded** ([[07-decisions]] ADR-020): reads in `api.ts` (every field narrowed with `??`, each section fetched independently so one failed permission is a sentence not a blank screen), domain modules beside it (`repo.ts` files/branches/commits/releases, `pulls.ts` reviews/merge/checks, `issues.ts` issues/labels/assignees/notifications, `ci.ts` runs/dispatch/re-run/cancel), transport-free helpers (`../base64.ts` and `../diff.ts`, both shared with Bench; its own `patch.ts` parses GitHub's patch text *into* our `DiffHunk`s so one renderer draws both), `device.ts` (device flow — **native only**; github.com's OAuth endpoints send no CORS headers, so browsers must paste a token), `token.ts`/`cache.ts` (KV, never SQLite — someone else's data is not user content), `use-github.ts`. **Write rule, enforced in code, never by convention:** no path commits to the default branch (an edit appends to a non-default branch or creates one), the diff is shown before the commit, the ref update is non-forced (a moved branch is refused, not overwritten), a stale blob `sha` is surfaced as GitHub's `409`, and there is no branch or repository deletion anywhere. The token is proved against `/user` before it is stored, and a failed refresh keeps the cached snapshot and says how old it is. Client ID lives in `app.json` (`expo.extra.githubClientId`); empty hides the sign-in.
- **Bench** (`src/lib/bench/*` + `src/app/bench/*`, reached from More) is the **offline dev toolbox** and the first new *category* since v0.1 ([[07-decisions]] ADR-021): pure functions per tool (`hash`, `json`, `sql`, `regex`, `jwt`, `encode`, `time`, `colour`, `textstats`, `patch`), a registry in `tools.ts` that drives the shelf and the **single host route** (`/bench/[tool]`), and `self-check.ts` — **known-answer checks you run under Node** (recipe in [[03-architecture]]) whenever a pure module changes. It never touches the network, adds no dependency, and **computes as you type** (no Run button, no stale result). A snippet is user content → `bench_snippets` (schema v3), and it re-opens **in the tool that made it** (`?snippet=<id>`, updating the same row). Two rules it settled, both house rules now: **a pressable row's trailing slot is never another pressable** (`ListRow` is itself a button, so a button inside it is invalid HTML on web and ambiguous to a screen reader — destructive actions are a two-tap confirm on the screen that owns the thing), and **every table the user owns must be added to `exportAll()`** in the same change that creates it (the export dump carries a `version`, now 2).
- **Sentinel** (`src/lib/sentinel/*` + `src/components/sentinel/*` + `src/app/sentinel/*`, reached from More) is the **second networked feature** and the second new *category* ([[07-decisions]] ADR-023), and the only one whose *purpose* is to make requests — to the user's own URLs:
  - **It checks when you look, and only then.** No daemon, no `expo-background-task`, no polling: opening the board checks anything older than `STALE_AFTER_MS` (15 min) and the buttons do the rest. So there is **no live dot, no ticking timestamp, no shimmer** anywhere in it ([[04-design-language]]), and every figure states its denominator — "uptime" counts *the checks taken*, never wall-clock time, because a board that watches only while you look would make a clock-based percentage a lie.
  - **A verdict is a record; an incident is a view.** `verdictFor()` is applied once, at the moment the check is taken, from the expectations set then, and stored (`watch_checks.verdict`) — changing what a target expects tomorrow must not rewrite yesterday. `incidentsIn()` derives "three failures in a row" from those verdicts in pure code, so the rule can change without a migration. Both live in `status.ts` with **78 known-answer checks** (`self-check.ts`) — a second checks file rather than growing Bench's.
  - **The two runtimes prove different things, and the UI says so.** `probe.ts` (native) reads the real status code; `probe.web.ts` cannot — a cross-origin response is opaque, `status` is always 0 — so it reports reachable-or-not plus the time, and `verdictLabel()` renders that as **reachable**, never "up". The board prints the browser limitation as a sentence, **only** when the numbers came from a browser.
  - **Data**: `watch_sites` (a target — user content, tombstoned) and `watch_checks` (measurements — the **one table with no `deleted_at`**, pruned to the newest 500 per target at every write and deleted with its target, [[06-data-model]] schema v4). Both ride in `exportAll()` (dump `version: 3`). **Checks run sequentially on purpose** (parallel requests inflate the very number being measured), and colour reuses the existing roles: up = `accent`, slow = `ember` (a verdict about *time*), down = `danger` — no fourth hue.
- **Garden & 3D** (`src/lib/garden/*` + `src/lib/three/kit/*` + `src/components/garden/*`, [[07-decisions]] ADR-022): one placement layer, **two asset backends** — `props.ts` answers each placement with its Blender GLB when it loads, otherwise with the code kit, and the two kit-only props (**bench**, **signpost**) always come from code. Metres, base at y = 0, flat-shaded, 3–4 tones, ≤700 tris, deterministic (noise is a hash of vertex *position*, so two vertices sharing a corner never split). Colour is written **linear**: `new Color('#hex')` is already linear under `ColorManagement`, so never convert again (double conversion is how a model turns black). The **signpost is data** — one plate per active project (`countActiveProjects()` → `dressingFor(growth, projects)`) — and no prop may be added without an answer: `props.ts` asserts it at compile time, so `npx tsc --noEmit` fails instead of rendering an empty clearing.
- **Web SQLite**: wasm in `metro.config.js` assetExts + COOP/COEP headers (dev: metro middleware; deploy: `app.json` headers / host config). FTS5 is native-only — guard capability.
- Motion manners: haptics for selection/commits (never web), tab switches don't animate, respect reduced motion, and **nothing bounces**.

## Skills & tooling installed

- `.agents/skills/` — Expo official skills (expo-overview, expo-design-system, expo-native-ui, expo-animation, expo-router, expo-ui, expo-sqlite, …) and taste skills (high-end-visual-design, design-taste-frontend, minimal ui variants). **Load the matching skill before big UI/DB/navigation work.**
- `graphify` — `graphify update .` rebuilds the code graph (`graphify-out/`); `graphify export obsidian` emits vault notes. Re-run after large refactors.
- Blender MCP — check `get_addon_status`; author models in-session; follow `docs/05-blender-pipeline.md` (GLB, Y-up, low-poly, base origin). Without a Blender session, author props in the **code kit** instead (`src/lib/three/kit/`: parts → models → index) — same rules bind (metres, base at y = 0, flat-shaded, ≤700 tris, deterministic), and `NODE_PATH=$PWD/node_modules node tools/preview/render.js` renders them to a PNG **and** checks the invariants. That tool is the only way to see the garden in an environment without WebGL, so run it whenever geometry changes. Never add a kit model with no consumer: `props.ts` compiles a coverage guard, and the tool fails the run if a model is unused.

## Conventions

- Files kebab-case; components `PascalCase` inside; hooks `use-*`.
- Icons: Phosphor (`weight="light"|"regular"|"fill"`), never emoji.
- Every screen handles loading / error / empty / ready — and a **failed read is never rendered as an empty one**: an `error` with no data gets `ErrorState` (with the query's `refresh`), not `EmptyState`, and "no longer exists" needs a *successful* read that came back null. Canon: [[04-design-language]] §States.
- Every control does something; non-actionable rows are not pressable.
- One filled action per screen — the FAB. The accent (indigo) is the brand; ember (amber) is for focus/time only.

## Expo specifics (still apply)

- If `ios/`/`android/` don't exist they're generated — never hand-edit native folders; configure via `app.json` + config plugins.
- After adding native-code deps, a development build is needed: `npx expo run:android` or `eas build --profile development`.
- Prefer official Expo modules; check skills before adding dependencies. EAS docs: https://docs.expo.dev/eas/index.md
