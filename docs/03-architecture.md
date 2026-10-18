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
| Network | **None, by design.** One exception: `/github`, two-way but branch-bounded, cached as a dated snapshot ([[07-decisions]] ADR-019 → 020) | Local-first is the product |
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
    search.tsx            # global search modal (four kinds)
    bench/                # the offline toolbox: index (shelf), [tool] (one host route), snippets
    _layout.tsx           # providers, fonts, splash, stack
  components/
    ui/                   # Panel, AppButton, AppText, ListRow, Segmented, Screen, CodeBlock, DiffView, …
    nav/                  # nav-items, BottomTabBar, DesktopShell
    garden/               # garden-scene.tsx (R3F)
    focus/                # heatmap, project chips, Next up (the Engine's card), rhythm card
    bench/                # eleven tool screens + the "keep this" panel + shared tool chrome
  lib/
    db/                   # migrations, seed, repo, hooks, provider
    engine/               # the Engine: rhythm.ts, next-up.ts, estimate.ts, use-engine.ts
    bench/                # pure tool logic: hash, json, sql, regex, jwt, encode, time, colour,
                          #   textstats, patch (LineDiff → unified patch), tools (the registry),
                          #   self-check.ts (known-answer checks — run it under Node)
    garden/model.ts       # pure tree math (deterministic PRNG)
    github/               # the one networked feature: api.ts, repo.ts, pulls.ts, issues.ts, ci.ts,
                          #   patch.ts (parses GitHub's patch *into* DiffHunks), device.ts, token.ts,
                          #   cache.ts, config.ts
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

Beside `src/`: `tools/blender/` holds the re-runnable scripts that `assets/models/*.glb` were generated from (the source of truth for the trees, not for the props), and `tools/preview/` is the GPU-less renderer and invariant check for the 3D kit below.

## Commands

```bash
npx expo start                 # dev server (a for Android, w for web)
npx expo start --android       # Android device via Expo Go / dev client
npx tsc --noEmit               # typecheck — must be clean
npx eslint .                   # lint — must be clean
npx expo export --platform web # deployable web build (dist/)
npx expo-doctor                # dependency health
```

Press `Shift+M` in the Expo CLI to browse the SQLite database with the dev tool.

## Checking the pure modules without a test runner

`src/lib/bench/self-check.ts` holds known-answer checks over every pure module Bench owns (hashes against published vectors, RFC semantics for base64/URL/JWT, cron against real timestamps, WCAG contrast, diff/patch round-trips). It is plain TypeScript returning a result list, so it runs anywhere TypeScript does — and Node 22 is not always built with TS support, so the route is an explicit emit:

```bash
npx tsc src/lib/bench/self-check.ts --ignoreConfig --outDir /tmp/bv \
  --module commonjs --target es2020 --moduleResolution node --skipLibCheck
node -e "require('/tmp/bv/bench/self-check.js').runSelfCheck()"
```

It prints `total / passed / failed` and the detail of anything that failed. When a pure module changes, add the case that would have caught the change: this file is the reason a hand-written SHA-1 can be trusted next to `git` ([[07-decisions]] ADR-021). The intent in [[08-backlog]] is to extend this habit to the Engine and the GitHub parsers rather than introduce vitest.

## Checking 3D without a GPU

Same idea, applied to geometry: `tools/preview/render.js` (**dev-only — nothing in the app imports it**) builds every model in the code-authored kit through the real three.js code paths, asserts the kit's invariants (finite vertices, base at y = 0, triangle budget, determinism by rebuilding, one glow mesh on the lantern, a consumer in `props.ts` for every model), then software-rasterises a contact sheet to `/tmp/shots/kit-sheet.png`. That is the only way to *look* at the garden's models in an environment without WebGL, where the app itself can only show its "3D is unavailable" still. Recipe and rules: [[05-blender-pipeline]].

## Boot order

`_layout.tsx` → fonts (`useFonts`) + `DatabaseProvider` (`SQLiteProvider` with `onInit` = migrate + seed) → `AppThemeProvider` → `RootNavigator`. The native splash hides when fonts are ready; screens can assume a migrated, seeded database.

## Knowledge tooling

- **Docs**: this `docs/` folder is the vault (wikilinks → graph).
- **graphify**: `graphify update .` builds `graphify-out/graph.json` from the code; `graphify export obsidian` emits vault notes + canvas. Re-run after big refactors.
- **Skills used** (installed under `.agents/skills/`): expo-overview, expo-design-system, expo-native-ui, expo-animation, expo-router, expo-sqlite, plus the taste skills (high-end-visual-design et al.). Consult them before large UI/DB work.
