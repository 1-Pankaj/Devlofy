---
tags: [devlofy, architecture]
created: 2026-10-17
---

# Architecture

## Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Expo SDK 58** / RN 0.88 / React 19.3 | Current, reliable, EAS builds in cloud |
| Routing | **Expo Router** (typed routes) | File-based, works web + native identically |
| State | **zustand** + persist | Tiny, plays with SQLite/storage adapters |
| Database | **expo-sqlite** everywhere | Native: real SQLite. Web: wasm + OPFS |
| 3D | **three + @react-three/fiber** via expo-gl | One scene, two renderers (see below) |
| Network | **Two features, both opt-in and neither required.** `/github` — two-way but branch-bounded, cached as a dated snapshot ([[07-decisions]] ADR-019 → 020); `/sentinel` — requests to *your own* URLs, taken only when you look at the board, stored locally as your own history ([[07-decisions]] ADR-023). Everything else runs with the radio off | Local-first is the product |
| UI system | **Material 3 Expressive** — tonal surfaces, one FAB per screen, owned primitives ([[04-design-language]]) | Non-generic, no component kit, no web look |
| Icons | **phosphor-react-native** (light/regular) | Precise lines, brand-consistent |
| Fonts | Geist + JetBrains Mono | UI and display / machine-truth |
| Lists | **@shopify/flash-list** | Virtualized where it matters |
| Motion | **reanimated 4** (`.get()`/`.set()`, compiler-safe) | UI-thread only |

## Platform adapters — the core rule

**Pure TypeScript core + thin platform files.** Metro resolves platform files automatically; the core never imports platform-specific libraries.

Examples in the repo:
- `src/lib/three/index.native.ts` → `@react-three/fiber/native`; `index.web.ts` → `@react-three/fiber`. Scene code imports `@/lib/three` and runs unchanged.
- `src/lib/storage.native.ts` → `expo-sqlite/kv-store`; `storage.web.ts` → `localStorage`; `storage.ts` is the type anchor/fallback.
- `src/lib/sentinel/probe.ts` (native) reads a real HTTP status; `probe.web.ts` cannot — a browser hides every cross-origin response behind an opaque one — so it reports reachable-or-not and how long it took. Both return the same `CheckFacts`, so the verdict logic never learns which runtime it is on: it only *records* it, and the board labels a web result "reachable" rather than "up" ([[07-decisions]] ADR-023).

Any new platform-specific capability (notifications, file system, haptics) follows the same pattern: `feature.ts` (types + no-op) + `feature.native.ts` + `feature.web.ts`.

## SQLite on web (works, with two rules)

- Metro must treat wasm as an asset → `metro.config.js` pushes `wasm` into `assetExts`. (The export includes `wa-sqlite.wasm`, ~640 KB.)
- SharedArrayBuffer needs cross-origin isolation:
  - **Dev**: `metro.config.js` injects `COOP: same-origin` + `COEP: credentialless` into responses.
  - **Deploy**: `app.json` → `expo-router` plugin `headers` covers EAS Hosting. On Netlify/Vercel/Cloudflare Pages, add the same two headers manually.
- **FTS5 is native-only** (web wasm build ships without it). Search is LIKE-based for now; native FTS lands with a capability check in v1.5 ([[02-scope]]).
- Safari can evict site storage after ~7 days of non-use; installed PWAs are exempt. Export/backup exists from v0.1 regardless.

## Android large screens & desktop mode

Research findings baked into the implementation:

- Android's desktop windowing (Android 14+ tablets, DeX, desktop-class Chromebooks) runs apps in **resizable freeform windows** — the app must never assume a fixed width or a bottom edge. Everything here uses `useWindowDimensions` and flex.
- **Window size classes** (Material 3): the app maps them in `src/lib/layout/breakpoints.ts` → `compact` / `medium` / `expanded`.
- `useDesktopMode()` = user setting (`auto` follows expanded) → the tab layout renders `DesktopShell` (side rail, `Slot`) instead of the bottom tab bar. Rail + content, centered max-width 920.
- Keyboard/mouse: interactive elements are `Pressable`/`PressableScale` with accessibility roles; rows highlight (not scale) for pointer contexts. Hover polish is backlog.
- Orientation is `"default"` (tablets rotate); the manifest keeps `resizeableActivity` default-on.

## Folder map

```
src/
  app/                    # routes only
    (tabs)/               # index (Today), garden, work, notes, more + _layout (adaptive)
    note/[id].tsx         # editor
    project/[id].tsx      # project detail
    client/[id].tsx       # client detail
    project-form.tsx      # modal
    client-form.tsx       # modal
    invoice.tsx           # invoice draft (period/client scoped, a view over sessions)
    search.tsx            # global search modal (the database's five kinds, plus Bench's tools)
    bench/                # the offline toolbox: index (shelf), [tool] (one host route), snippets
    sentinel/             # the watch board: index (board, worst first), [id] (one target's
                          #   history), site-form (modal)
    github/               # the code host: index (hub), repo, browse, blob, edit, pulls, pr,
                          #   issues, issue, new-issue, actions, notifications, release
    _layout.tsx           # providers, fonts, splash, stack
  components/
    ui/                   # Panel, AppButton, AppText, ListRow, FeatureCard (the More shelf's
                          #   destination card: icon well + promise + a live status pill),
                          #   BottomSheet/SheetRow/SheetOption (the app's one sheet: scrim,
                          #   rising surface, title, close), Segmented, Screen, CodeBlock,
                          #   DiffView, …
    nav/                  # nav-items, BottomTabBar, DesktopShell
    garden/               # garden-scene.tsx (R3F)
    focus/                # heatmap, project chips, Next up (the Engine's card), rhythm card
    bench/                # eleven tool screens + the "keep this" panel + shared tool chrome
    sentinel/             # site-card (one target on the board), latency-chart (the strip, SVG),
                          #   standing-strip.tsx (the Today card: the board's answer, off the board)
    notes/                # block-editor (the writing surface: one input, focus/caret, the slash
                          #   menu, the block sheet, the format bar), format-bar, block-sheet,
                          #   rich-text (inline marks → Text), reading-view, link-sheet (the note
                          #   picker + the outline), extract-sheet, note-meta
  lib/
    db/                   # migrations, seed, repo, hooks, provider
    engine/               # the Engine: rhythm.ts, next-up.ts, estimate.ts, use-engine.ts
    notes/                # blocks.ts (the block model: parse, split, merge, move, indent, input
                          #   rules — every edit is body → body), inline.ts (the inline tokenizer
                          #   and the toolbar's helpers), self-check.ts
    bench/                # pure tool logic: hash, json, sql, regex, jwt, encode, time, colour,
                          #   textstats, patch (LineDiff → unified patch), tools (the registry),
                          #   self-check.ts (known-answer checks — run it under Node)
    sentinel/             # the second networked feature, and the only one that *aims* at the
                          #   network: status.ts (pure verdicts, windows, incidents, URL parsing),
                          #   probe.ts + probe.web.ts (the platform split — a status code on native,
                          #   reachable-or-not in a browser), run.ts (sequential checks), use-sentinel.ts,
                          #   self-check.ts
    garden/model.ts       # pure tree math (deterministic PRNG)
    github/               # the other networked feature: api.ts, repo.ts, pulls.ts, issues.ts, ci.ts,
                          #   patch.ts (parses GitHub's patch *into* DiffHunks), device.ts, token.ts,
                          #   cache.ts, config.ts, use-github.ts
    layout/breakpoints.ts # window size classes + desktop mode
    three/                # platform shim (index/load-model/webgl: ts + native + web)
      kit/                # the code-authored prop kit (parts → models → index; docs/05)
    base64.ts, diff.ts    # transport-free primitives shared by GitHub and Bench
    highlight.ts          # the app's own syntax tokenizer (no dependency)
    money.ts              # rates → line items → invoice text (pure)
    parse-task.ts         # the quick-add grammar (pure)
    format.ts, share.ts, storage*.ts, search-shortcut*.ts, version.ts
  state/settings.ts       # zustand persisted settings
  theme/                  # colors, spacing, radius, typography, motion, shadows, provider
```

Beside `src/`: `tools/blender/` holds the re-runnable scripts that `assets/models/*.glb` were generated from (trees *and* props — the code kit is the exception, it has no Blender source), and `tools/preview/` is the GPU-less renderer and invariant check for the 3D kit below.

## Commands

```bash
npx expo start                 # dev server (a for Android, w for web)
npx expo start --android       # Android device via Expo Go / dev client
npm run check                  # typecheck + lint + the four known-answer suites — must be clean
npx tsc --noEmit               # typecheck alone
npx eslint .                   # lint alone
bash tools/checks/self-check.sh # the pure-module suites alone (482 checks)
npx expo export --platform web # deployable web build (dist/)
npx expo-doctor                # dependency health
```

`npm run check` is the one gate: typecheck, lint, then `tools/checks/self-check.sh`. A green local run is exactly what a reviewer asks for.

Press `Shift+M` in the Expo CLI to browse the SQLite database with the dev tool.

## Checking the pure modules without a test runner

Known-answer checks live beside the pure modules they cover — one file per folder, deliberately, so each stays runnable on its own and none grows into a suite nobody runs:

- `src/lib/bench/self-check.ts` — **80** checks (hashes against published vectors, RFC semantics for base64/URL/JWT, cron against real timestamps, WCAG contrast, diff/patch round-trips).
- `src/lib/sentinel/self-check.ts` — **90** checks (the verdict every set of facts produces, uptime windows, incident runs, the latency spread, URL parsing, every label the board shows, and — since ADR-024 — the standing that the More card and the Today strip render, including that a paused target cannot raise an alarm).
- `src/lib/notes/self-check.ts` — **190** checks (what Enter does to every kind of block — a list continues, an empty list item *leaves* the list, a heading at the end starts a paragraph, a fence takes a line instead of splitting; what Backspace merges and where the caret lands; what the input rules eat as you type; inline marks, `[[wikilinks]]` and escapes; and the round-trip that keeps a note the app half-understands byte-identical).
- `src/lib/engine/self-check.ts` — **122** checks (every weight in next-up's table and every reason string it can produce, the overdue decay and its floor, the priority clamp, the three-reason cap and its ordering, each tie-break in `rankTasks`, that ranking does not reorder the caller's array, the hourly/weekday totals, the peak band including one that wraps past midnight, the sentences rhythm is allowed to say *and* the ones it must not say below six blocks, and estimate drift's ratio, median, sample floor and both ±15% sentence boundaries). [[08-backlog]] asked for this one by name: the ranking is the app's only hidden opinion, so it is now pinned rather than asserted.

All four are plain TypeScript returning a result list, so they run anywhere TypeScript does. `tools/checks/self-check.sh` compiles each one and runs it — Node 22 here is not built with TS support, so the route is an explicit emit — and it generates a small tsconfig per suite because a suite may name a type through the `@/…` alias, which a bare `npx tsc file.ts` cannot resolve. The app's own tsconfig cannot simply be extended either: `expo/tsconfig.base` sets `customConditions`, which TypeScript refuses alongside commonjs output.

```bash
bash tools/checks/self-check.sh      # all four suites, one line each
npm run check                        # typecheck + lint + the four suites — the gate
```

If you need one suite on its own, point the same generated config at it:

```bash
npx tsc -p /tmp/sv-tsconfig.json     # compilerOptions: baseUrl ., paths {"@/*":["src/*"]},
                                     #   outDir /tmp/sv, module commonjs, target es2022,
                                     #   moduleResolution node10, ignoreDeprecations "6.0", skipLibCheck
node -e "const r = require('/tmp/sv/src/lib/engine/self-check.js').runSelfCheck(); \
  console.log(r.length, 'checks ·', r.filter(c => !c.pass).length, 'failing')"
```

The result shape (`{ name, pass, detail }[]`) is identical in all four files, so one snippet formats any of them. When a pure module changes, add the case that would have caught the change: this habit is the reason a hand-written SHA-1 can be trusted next to `git` ([[07-decisions]] ADR-021), the reason Sentinel's verdicts can be trusted without a server ([[07-decisions]] ADR-023), the reason "pressing Enter on an empty bullet leaves the list" is a fact rather than an opinion ([[07-decisions]] ADR-025), and the reason "next up" can say *why* ([[07-decisions]] ADR-016). What is still uncovered is the GitHub parsers — `api.ts` narrowing every field with `??` — which is the remaining item in [[08-backlog]] rather than a reason to introduce vitest.

## Checking 3D without a GPU

Same idea, applied to geometry: `tools/preview/render.js` (**dev-only — nothing in the app imports it**) builds every model in the code-authored kit through the real three.js code paths, asserts the kit's invariants (finite vertices, base at y = 0, triangle budget, determinism by rebuilding, one glow mesh on the lantern, a consumer in `props.ts` for every model), then software-rasterises a contact sheet to `/tmp/shots/kit-sheet.png`. That is the only way to *look* at the garden's models in an environment without WebGL, where the app itself can only show its "3D is unavailable" still. Recipe and rules: [[05-blender-pipeline]].

## Boot order

`_layout.tsx` → fonts (`useFonts`) → `AppThemeProvider` → `DatabaseProvider` (`SQLiteProvider` with `onInit` = migrate + seed) → `RootNavigator`. The native splash hides when fonts are ready; screens can assume a migrated, seeded database.

## Knowledge tooling

- **Docs**: this `docs/` folder is the vault (wikilinks → graph).
- **graphify**: `graphify update .` builds `graphify-out/graph.json` from the code; `graphify export obsidian` emits vault notes + canvas. Re-run after big refactors.
- **Skills used** (installed under `.agents/skills/`): expo-overview, expo-design-system, expo-native-ui, expo-animation, expo-router, expo-sqlite, plus the taste skills (high-end-visual-design et al.). Consult them before large UI/DB work.
