---
tags: [devlofy, decisions]
created: 2026-10-17
---

# Decision log (ADRs)

Format: **decision → why → consequences**. Newest at the bottom. Superseding a decision appends, never rewrites.

## ADR-001 · Feature budget rule
**Decision:** every accepted feature displaces an existing one or goes to [[08-backlog]].
**Why:** solo dev, limited hours; scope creep is the project killer.
**Consequence:** saying yes requires saying no out loud.

## ADR-002 · No backend, no cloud AI
**Decision:** local SQLite is the entire backend. "AI" = local rules/scoring/algorithms, explicitly never a chat.
**Why:** privacy, zero cost, works on a plane, no ops burden.
**Consequence:** sync/multi-device is explicitly unsolved (accepted); export/backup is mandatory from v0.1.

## ADR-003 · Web-first, then Android native; tablets as first-class
**Decision (updated 2026-10-17):** Web stable + **Android native primary** (phones *and tablets*, desktop mode in v0.1). iOS later.
**Why:** user has an iPhone but no MacBook; Android hardware is immediately testable; web gives day-one reach and a PWA dogfood path.
**Consequence:** platform adapters are mandatory (`feature.native.ts` / `feature.web.ts`); nothing imports platform-only libs in core code.

## ADR-004 · Custom design system over component kits
**Decision:** brand system "Ink & Sprout" built on tokens + owned primitives (Panel, AppButton, AppText, …). No React Native Paper / RNUILib.
**Why:** kits ship generic Material/iOS looks; the user explicitly wants a rich, non-generic, native-feel identity. Paper was installed early and removed.
**Consequence:** we own more components; every new component must go through `src/theme` tokens.

## ADR-005 · Fonts & icon set
**Decision:** Geist (UI) + Space Grotesk (display) + JetBrains Mono (machine), Phosphor icons (light/regular weight).
**Why:** taste-skill banned Inter/Roboto and stock thick icon sets; these read as precise developer tools and work offline (bundled).
**Consequence:** font weights are separate static files; styles never set `fontWeight`.

## ADR-006 · Plain SQL repos over an ORM
**Decision:** `src/lib/db/repo.ts` with typed `getAllAsync/getFirstAsync/runAsync` + hand-written migrations (no Drizzle/Prisma).
**Why:** the ORM expo driver is historically sync-API oriented; web wasm constraints (sync API, FTS absence) make hand-rolled SQL the safe path. Screens consume typed functions either way.
**Consequence:** schema changes touch migration + repo + [[06-data-model]]. Tooling (drizzle-kit) is unnecessary.

## ADR-007 · Procedural 3D first, Blender GLBs layered in
**Decision:** the garden ships as deterministic procedural geometry; Blender assets replace/extend it later without changing the scene API.
**Why:** 3D from day one without asset-pipeline risk; keeps the app shippable while Blender sessions are intermittent.
**Consequence:** `garden-scene.tsx` must keep `(seed, growth)` props and a procedural fallback forever ([[05-blender-pipeline]]).

## ADR-008 · One R3F scene, two runtimes via a shim
**Decision:** `@/lib/three` resolves `@react-three/fiber/native` (expo-gl) or web per platform; scene code imports only the shim.
**Why:** avoids duplicated scenes; keeps the adapter rule (ADR-003) intact; web honors the same code path as Android.
**Consequence:** platform-specific three imports anywhere outside the shim are forbidden.

## ADR-009 · Navigation architecture (floating bar ⇄ side rail)
**Decision:** custom `FloatingTabBar` on compact widths; `DesktopShell` side rail in desktop mode; no native `NativeTabs` (template default was replaced).
**Why:** brandable icons/states across Android + web, and the rail requirement can't be met by stock tab bars. Tab switches don't animate.
**Consequence:** `useDesktopMode()` gates layout; switching modes remounts the navigator (accepted for now).

## ADR-010 · Reanimated 4 compiler-safe API
**Decision:** shared values use `.get()` / `.set()`; React Compiler experiment stays enabled; no `runOnJS` (use `scheduleOnRN` from `react-native-worklets`).
**Why:** RN 0.88 + Reanimated 4 + compiler enabled in the template; `.value` assignment fails lint immutability checks and risks compiler mis-optimization.
**Consequence:** any animation PR must pass `npx eslint .` with the immutability rule on.

## ADR-011 · Zustand persist via platform storage adapters
**Decision:** settings persist through `createJSONStorage(() => kv)` where `kv` is `expo-sqlite/kv-store` on native and `localStorage` on web. Zustand stays out of the database.
**Why:** settings aren't syncable user content; they're cheap, local, and must load before the DB opens.
**Consequence:** new persisted stores must use `src/lib/storage`, not direct platform APIs.
