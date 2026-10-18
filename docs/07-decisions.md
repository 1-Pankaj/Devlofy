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
**Consequence:** supersedes the palette/typography parts of ADR-004 and ADR-005 and the compact-nav half of ADR-009. `Glow` and `FloatingTabBar` are deleted; `BottomTabBar` renders in the layout flow. Nothing is reintroduced without a new ADR. ADR-004's core (own the primitives, no component kit), ADR-005's Phosphor decision, and ADR-009's side rail all stand. New surfaces must be built from `src/theme` tokens — no hardcoded colour, radius, font size, or shadow.

## ADR-014 · Design language "Material 3 Expressive" (supersedes ADR-013's palette, surfaces, shape and gradient rule)
**Decision:** Devlofy adopts **Material 3** as its design system and works in its *Expressive* register. A **tonal** scheme replaced the light-first neutral palette: `background #F5F2FB` / `surface #FFFFFF` in light and `#131318` / `#1F1F26` in dark, with an **indigo** primary (`#4B5AA0` / `#BCC2FF`) and an **amber** tertiary (`#A85A08` / `#FFB870`) reserved for focus and time. Surfaces separate by **tone, not borders** — the 1px grey outline is gone from every container (`Panel` is filled/elevated/outlined, default filled). The shape scale is Material's (4/8/12/16/28/full) and buttons, chips and the FAB are pills. Every tab screen carries exactly **one extended FAB** (`Fab`) as its single action — Today `Start focus`, Garden `Focus for 25m`, Work `New project`, Notes `New note` — and nothing else on those screens is filled. The gradient system is deleted (`GradientSurface` removed, `ProgressRing` lost `gradientTo`): a colour block is a colour, not a blend. Type grew (display 34 / title 24) and entrances are springy. Segmented controls gained a check mark so selection never relies on colour alone.
**Why:** the Daylight pass was judged a re-paint, not a redesign — it changed hue while keeping one bordered white card stacked on another, so dark mode looked like the previous build. The complaint was structural. A tonal surface hierarchy, one floating action per screen, and asymmetric bento layouts change the *composition* of every screen, not just its colour. Indigo was chosen over the previous green and the interim berry because the garden owns green, the user rejected pink, and amber-for-time keeps "focus" legible as a second, meaningful hue.
**Consequence:** supersedes ADR-013's palette, surface treatment, radii and gradient rule; ADR-013's navigation, primitive-ownership, Phosphor and side-rail decisions stand. Gradients may only return with a new ADR. New surfaces must be `Panel` variants or `accentSoft`/`emberSoft` blocks built from `src/theme` tokens. [[04-design-language]] is the canon.


## ADR-015 · Precise motion, and a v0.2 feature batch the schema already allowed
**Decision:** two things at once, because they answer the same feedback ("the animations feel wrong, give me more that's useful").
1. **Motion is precise, never playful.** Every spring with `dampingRatio < 1` and every `springify()` is removed. Springs survive only as **critically damped** (`spring.settle` 300, `spring.precise` 220); everything else is a timing curve (`easing.out`, `emphasized`, `inOut`, `sheet`) over the five `duration` steps. Press feedback is symmetric timing in/out at 0.975, `FadeUp` is a timed 8 px rise, the nav pill slides on Material's emphasized curve, and `LiveDot` breathes over 1600 ms instead of blinking.
2. **Five features, no migrations.** The v1 schema already carried `sessions.project_id`, `tasks.est_minutes`, `tasks.priority` and `tasks.due_at` unused, so the working day was built on data the app was already storing: project attribution for focus blocks (persisted selection in settings, `project_name` joined onto sessions, tracked minutes per project on Work and the project page), a **twelve-week rhythm heatmap** on Garden, a **daily focus goal** in More that drives the ring and the heatmap bands, a **quick-add grammar** (`!3 45m tomorrow #Northwind`) with a live parse preview, and a **due-date-ordered day queue** with due pills.
**Why:** motion with overshoot reads as a toy on a tool you sit inside for hours; a short rise and a fast settle reads as precision. And the fastest useful features are the ones the schema already pays for — attribution is what turns a timer into "this project cost 14 h 20 m", which is the question a freelancer actually asks. Every addition is local, offline and deterministic ([[01-vision]]), so none of them weakens the no-backend promise.
**Consequence:** the feature-budget rule in [[AGENTS]] was **explicitly overridden by the user request** for this batch rather than applied; the displaced work (energy pairing, manual reordering, due-date editing after creation, command palette) is written into [[02-scope]] v1 and [[08-backlog]] instead. `parse-task.ts` is pure and unit-testable — the grammar is the contract, so extending it means extending its header comment and the preview together. No schema change was needed, so [[06-data-model]] stands.

## ADR-016 · The Engine is a pure, deterministic ranking — no model, no server
**Decision:** `src/lib/engine/` is Devlofy's intelligence layer, and it is **pure functions over the user's own rows**: `rhythm.ts` (focus minutes bucketed by local hour and weekday, the contiguous 3-hour peak band, the median block length, and the sentences the UI may show), `next-up.ts` (a documented weight table that scores every open task and returns the *reasons* it scored that way), `estimate.ts` (estimated vs actually-focused minutes per task → a drift ratio). `use-engine.ts` wires those to `useLiveQuery` so Today and Garden read the same numbers. The "Next up" card on Today names one task, shows up to three reasons as pills, and offers **Focus on this** (which starts a block attributed to the *task*, not just the project) and **Show me another** (a local, cheap override).
**Why:** the product's stated edge is local intelligence ([[01-vision]], [[03-architecture]]), and the strongest version of it needs no network at all: the app already knows what you said matters (tasks: priority, due, estimate, energy), what you actually did (sessions: minutes, hour, attribution) and where the time went (projects). "You plan 70m, it takes 82m" and "your strongest stretch is 09:00–12:00" are facts a to-do list cannot produce, and they are only possible because earlier versions prompted for that data. A recommendation that cannot state its reason is not allowed here — if the card ever says "do this" without a why, it is a bug in `next-up.ts`.
**Consequence:** the Engine has no thresholds tuned to a demo and no hidden randomness; weights live in one `WEIGHT` table so they can be argued with. It stays silent rather than inventing patterns (`MIN_SESSIONS_FOR_INSIGHTS = 6`, drift needs 4 samples). The v3 vision of *optional tiny on-device models* stays in [[02-scope]] behind a flag — this ADR ships the deterministic core and forbids reaching for a model to solve what a rule can.

## ADR-017 · Money: rates on the project, bills as views, no invoice table
**Decision:** migration **v2** adds `hourly_rate` to `clients` and `projects` (append-only `ALTER TABLE`). A block's rate resolves as `COALESCE(projects.hourly_rate, clients.hourly_rate)`; a project rate wins, the client's is the inherited default. `startFocusSession()` resolves that rate at start and marks the block **billable** when a rate exists, so pricing is automatic from the moment the work happens. `/invoice` is a screen, not a stored document: it picks a period (this month / 30 days / this week / all time) or one client, groups billable blocks into line items, and recomputes every time — including the "copy as text" export (`src/lib/money.ts` is pure).
**Why:** a stored invoice can disagree with the time log it came from; a *view* cannot. Rates are the only new user input, and putting them where the work is (a project, or a client for all of theirs) means they are typed once, not per block. The default-on billability matters more than a per-session toggle: for a freelancer, "time on a client project is billable" is the sane assumption, and the screen lets you take any single block off the bill with a tap.
**Consequence:** money is presented in **accent** (brand), not ember — ember stays reserved for focus/time ([[04-design-language]]). The currency symbol is a setting (`CURRENCY_OPTIONS`), shown with its picker on the invoice screen where the question first arises; the app never guesses a currency. Time on projects with no rate is surfaced honestly ("2h 47m cannot be billed") instead of silently priced at zero. A real invoice entity (numbering, sent/draft state, PDF) remains v2 scope in [[02-scope]].

## ADR-018 · Search: one screen over four kinds, LIKE in both runtimes, ⌘K on web
**Decision:** `searchEverything()` runs four bounded `LIKE` queries (projects, clients, notes, tasks) and returns them as one grouped result set on `/search`, reachable from the Today header and from **Cmd/Ctrl-K on web** via a platform adapter (`src/lib/search-shortcut.ts` + `.web.ts`, the native side a deliberate no-op). Projects, clients and notes navigate to their detail routes; a task row toggles completion in place (its trailing slot shows the state, not a caret) so no result is a dead end.
**Why:** in an app that owns all your data, "where did I put that?" is the most common navigation problem, and the answer usually arrives when you guess the wrong noun — searching one kind at a time forces you to guess right. LIKE rather than FTS5 because the same code path has to run on the wasm web build ([[03-architecture]]); for personal-sized datasets it is instant either way. The shortcut is web-only because native has no global key handler, and pretending otherwise would ship a broken affordance.
**Consequence:** FTS5 on native stays a v1.5 optimisation behind a capability check ([[06-data-model]]); if it lands, it must return the same shape. Result growth needs `LIMIT` discipline per kind. Any new entity type (milestones, clients' contacts) is added to `GROUPS` in one place.

## ADR-019 · GitHub: two ways in, one read-only snapshot with a date on it
**Decision:** `/github` (from Work, and the only screen in the app that needs the network) shows what is **waiting on the user**: pull requests with a review requested from them, their own open pull requests, issues assigned to them, the newest CI run on each of the most recently pushed repos, and those repos. It is **read-only** — the app never issues a write to GitHub. Authentication has two doors to one connection: a **pasted token** (both platforms, needs nothing from GitHub's app registry) and the **device flow** (Android only, enabled only when `expo.extra.githubClientId` in `app.json` is set). The token lives in the KV adapter (`src/lib/storage`), not the OS keychain, and connecting *proves* the token against `/user` first, so a bad token is never stored. The last good response is cached in KV as a **snapshot with `fetchedAt`**; opening the screen paints it immediately, a background refresh runs only if it is older than 10 minutes, and a failed refresh **keeps the snapshot** and adds a sentence saying so.
**Why:** every other part of this app works on the device, so the code host is the one place freshness cannot be assumed — which is an argument for making staleness *visible* rather than hiding it behind an empty state. Two doors exist because the platform decides the grant: the standard web flow needs a callback URL that a serverless app cannot provide, and the device flow cannot run in a browser at all — `github.com/login/device/code` and `/login/oauth/access_token` send **no CORS headers** (verified by hand; `api.github.com` does, so reads work on web). A pasted token is therefore the honest web path, and the only path when no client ID is configured. Read-only because a dashboard should not be able to break the thing it reports on.
**Consequence:** permissions are per-token, so a section may legitimately fail while the rest succeeds: each section is fetched independently and a failure becomes a line in `notes` ("Checks: … this token cannot read Actions"), never a silently empty list and never a blank screen. The absent-keychain choice is deliberate (no new dependency, cannot break Expo Go) and the UI says where the token is and offers to forget it; `expo-secure-store` (Android Keystore) is in [[08-backlog]] and needs a dev-build check. Nothing here touches SQLite: the cache is a KV value, keeping the database the home of user content only (ADR-011). Unauthenticated network calls stay confined to `src/lib/github/`.
