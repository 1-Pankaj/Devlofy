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

## ADR-012 · Garden models: Blender GLBs over the procedural fallback
**Decision:** the garden prefers one Blender-authored GLB per growth stage (five stages, seed → canopy, in `assets/models/`); the procedural tree remains the loading state and the permanent failure fallback.
**Why:** authored geometry reads better than recursion, while the fallback guarantees 3D from the first frame on any device and keeps the app shippable if loading ever breaks.
**Consequence:** new stages/props ship as GLBs plus an entry in `src/lib/garden/models.ts`; loading stays behind `src/lib/three/load-model.*` (ADR-008), and failure must never blank the scene.

## ADR-013 · Design language "Daylight" (supersedes the Ink & Sprout look)
**Decision:** the surface system moves from OLED ink + neon sprout to a neutral, light-first palette. Light is paper (`#F5F6F8` canvas, white cards); dark is neutral charcoal (`#0F1115`), never pure black and never colour-cast. One deep emerald accent (the sprout survives, the neon does not). Conventional radii (6–20 instead of 10–28), quiet two-step elevation, text-first hierarchy, and **one type voice** — Geist for everything, JetBrains Mono only for code and tabular figures. The Double-Bezel card becomes a single bordered surface, the ambient `Glow` component is deleted, and compact widths get a solid, edge-anchored `BottomTabBar` instead of the floating pill.
**Why:** the previous system read as a high-end/AI demo rather than a product: neon-on-near-black with a green cast, mono uppercase eyebrows as the signature motif, oversized squircles, machined "bezel" shells, and glow blobs on every dark screen — with very low information density. The stated reference set is mainstream product design (Instagram / WhatsApp / Facebook / LinkedIn): neutral surfaces, familiar navigation, one accent used sparingly, and screens that carry real information.
**Consequence:** supersedes the palette/typography parts of ADR-004 and ADR-005 and the compact-nav half of ADR-009. `Glow` and `FloatingTabBar` are deleted; `BottomTabBar` renders in the layout flow. Nothing is reintroduced without a new ADR. ADR-004's core (own the primitives, no component kit), ADR-005's Phosphor decision, and ADR-009's side rail all stand. New surfaces must be built from `src/theme` tokens — no hardcoded colour, radius, font size, or shadow. ## ADR-014 · Design language "Material 3 Expressive" (supersedes ADR-013's palette, surfaces, shape and gradient rule)
**Decision:** Devlofy adopts **Material 3** as its design system and works in its *Expressive* register. A **tonal** scheme replaced the light-first neutral palette: `background #F5F2FB` / `surface #FFFFFF` in light and `#131318` / `#1F1F26` in dark, with an **indigo** primary (`#4B5AA0` / `#BCC2FF`) and an **amber** tertiary (`#A85A08` / `#FFB870`) reserved for focus and time. Surfaces separate by **tone, not borders** — the 1px grey outline is gone from every container (`Panel` is filled/elevated/outlined, default filled). The shape scale is Material's (4/8/12/16/28/full) and buttons, chips and the FAB are pills. Every tab screen carries exactly **one extended FAB** (`Fab`) as its single action — Today `Start focus`, Garden `Focus for 25m`, Work `New project`, Notes `New note` — and nothing else on those screens is filled. The gradient system is deleted (`GradientSurface` removed, `ProgressRing` lost `gradientTo`): a colour block is a colour, not a blend. Type grew (display 34 / title 24) and entrances are springy. Segmented controls gained a check mark so selection never relies on colour alone.
**Why:** the Daylight pass was judged a re-paint, not a redesign — it changed hue while keeping one bordered white card stacked on another, so dark mode looked like the previous build. The complaint was structural. A tonal surface hierarchy, one floating action per screen, and asymmetric bento layouts change the *composition* of every screen, not just its colour. Indigo was chosen over the previous green and the interim berry because the garden owns green, the user rejected pink, and amber-for-time keeps "focus" legible as a second, meaningful hue.
**Consequence:** supersedes ADR-013's palette, surface treatment, radii and gradient rule; ADR-013's navigation, primitive-ownership, Phosphor and side-rail decisions stand. Gradients may only return with a new ADR. New surfaces must be `Panel` variants or `accentSoft`/`emberSoft` blocks built from `src/theme` tokens. [[04-design-language]] is the canon.

