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
    _layout.tsx           # providers, fonts, splash, stack
  components/
    ui/                   # Panel, AppButton, AppText, ListRow, Segmented, Screen, …
    nav/                  # nav-items, BottomTabBar, DesktopShell
    garden/               # garden-scene.tsx (R3F)
    focus/                # heatmap, project chips, Next up (the Engine's card), rhythm card
  lib/
    db/                   # migrations, seed, repo, hooks, provider
    engine/               # the Engine: rhythm.ts, next-up.ts, estimate.ts, use-engine.ts
    garden/model.ts       # pure tree math (deterministic PRNG)
    layout/breakpoints.ts # window size classes + desktop mode
    three/                # platform shim
    money.ts              # rates → line items → invoice text (pure)
    parse-task.ts         # the quick-add grammar (pure)
    format.ts, share.ts, storage*.ts, search-shortcut*.ts
  state/settings.ts       # zustand persisted settings
  theme/                  # colors, spacing, radius, typography, motion, shadows, provider
```

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

## Boot order

`_layout.tsx` → fonts (`useFonts`) + `DatabaseProvider` (`SQLiteProvider` with `onInit` = migrate + seed) → `AppThemeProvider` → `RootNavigator`. The native splash hides when fonts are ready; screens can assume a migrated, seeded database.

## Knowledge tooling

- **Docs**: this `docs/` folder is the vault (wikilinks → graph).
- **graphify**: `graphify update .` builds `graphify-out/graph.json` from the code; `graphify export obsidian` emits vault notes + canvas. Re-run after big refactors.
- **Skills used** (installed under `.agents/skills/`): expo-overview, expo-design-system, expo-native-ui, expo-animation, expo-router, expo-sqlite, plus the taste skills (high-end-visual-design et al.). Consult them before large UI/DB work.
