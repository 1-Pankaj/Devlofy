---
tags: [devlofy, audit]
created: 2026-10-29
---

# Project audit — 2026-10-29

A full pass over the repository: licensing and open-source compliance, secrets exposure, pending work, and the v0.9 garden re-platform (3D → pixel art). Everything below was verified against this working tree; the changes it produced are listed at the end and are **uncommitted** — review and commit them yourself.

## 1. Secrets & credential exposure — ✅ clean

- **Working tree**: scanned every `src/`, `tools/`, `site/`, config and doc file for AWS (`AKIA…`), GitHub (`ghp_/gho_/github_pat_`), OpenAI/Anthropic (`sk-…`), Google (`AIza…`), Slack (`xox…-`), Stripe (`sk_live_/whsec_`), GitLab, DigitalOcean, PostHog (`phx_`), JWTs, private-key blocks, and high-entropy `key/secret/password/token` assignments. **No real credentials found.** The one JWT match is the public jwt.io demo token inside the Bench JWT tool's sample input.
- **Full git history**: all **4,553 unique blobs** across all 43 commits were extracted and pattern-scanned — **zero hits**. A generated `graphify-out/` dump (scraped Expo/EAS documentation in Obsidian format, including notes with credential-flavoured titles such as "Credential Setup") was committed at some point and later untracked; its historical contents are documentation only and contain no keys. Nothing needs rotating and no history rewrite is required.
- **`.gitignore`** covers `.env`, `.env*.local`, `*.key`, and `expo-env.d.ts`.
- **The one credential path in the app** (GitHub token) is handled honestly: the user's own token is validated against `/user` before saving, lives in the device-local KV store (`expo-sqlite/kv-store` native / `localStorage` web), is excluded from the JSON export, and the UI says where it sits. The OAuth `githubClientId` in `app.json` is a **public** identifier by design (device flow never uses a client secret) — safe to commit.
- No `.env` files, no embedded basic-auth URLs, no telemetry or crash-reporting endpoints.

## 2. Licensing & open-source compliance — ⚠️ 1 issue found → fixed

- **The project license is coherent**: `LICENSE` is MIT (2026, Pankaj Israni), `package.json` declares `"license": "MIT"` and `"private": true`, `NOTICE` credits the Expo template scaffolding, and the README badge matches.
- **Fixed: the vendored `graphify` agent skill had no licence.** The repository's own `.agents/skills/LICENSE` said it plainly: *"Establish its provenance and licence before publishing this repository, or remove `.agents/skills/graphify/`."* Its upstream was never recorded in `skills-lock.json`, and redistribution without a licence is a real compliance risk for a public MIT repo. **Removed** (nothing in `src/` imports it — it is dev tooling only), along with its section in `.agents/skills/LICENSE` and the dangling mention in `NOTICE`.
- **Remaining vendored skills are clean**: the Expo skills (MIT, © 650 Industries) and the taste skills (MIT, © Leonxlnx) carry full notices and a `skills-lock.json` mapping.
- **Landing page (`site/index.html`)** attributes all third-party code and ships it under its own terms: Octicons (MIT), Mona Sans (OFL 1.1), GSAP + ScrollTrigger (GSAP Standard "no charge" licence), Swiper (MIT), Lenis (MIT).
- **Runtime dependencies** are permissively licensed (Expo/React Native stack, MIT; react-native-svg, MIT; zustand, MIT; date-fns, MIT; phosphor icons, MIT; @shopify/flash-list, MIT). With `three`, `@react-three/fiber` and `expo-gl` removed (all MIT), the dependency tree got smaller, not riskier.

## 3. Pending work (what actually needs doing)

The authoritative list is `docs/08-backlog.md` (governed by the ADR-001 feature-budget rule). The honest summary:

**Next candidates (v1)**
- Task scheduling follow-ons: energy pairing, manual reorder, editing due date/estimate after creation.
- Time-log editing: manual entries, edit/delete a session, move a block to another project.
- GitHub dashboard follow-ons: pinned repos, a commits/contributions feed.
- **Token hardening**: move the GitHub token to `expo-secure-store` (Android Keystore) — confirmed available in Expo Go, so it is cheaper than first written.
- Notifications: focus-end + daily planning reminder (mobile-only; no web support).
- Weekly review ritual, learning track (FSRS), client comm log, project templates.
- Unit tests for the pure GitHub parsers (the self-check pattern now covers bench/engine/garden/notes/sentinel — 650 checks).
- Notes block types not yet built: tables, image blocks, nested pages, math; find-in-note outside the sheet.

**Tier A (pure HTTPS, Android + web)**
- `expo-background-task` for Sentinel checks + local notifications ("tell me the moment it breaks").
- Repo ⇄ project binding (a project page shows its repo's PRs and CI).
- The closed loop: failed check → task, merged PR → invoice line / garden growth.
- Bench second release: the HTTP/API client (needs a documented CORS story).

**Tier B (needs a dev build, Android only)**
- SSH transport spike and a terminal view spike — both gated behind feasibility proof; RN 0.88 is New-Arch-only, which is a hard stop for unported modules.

**Explicitly rejected** (ideas graveyard): cloud sync, chat AI, a mobile git working tree, team features, third-party UI kits.

## 4. v0.9 changes in this pass — 3D removed, garden re-grown in pixels

**Removed**
- `assets/models/` — all fifteen Blender GLB files (~740 KB).
- `src/lib/three/` — the expo-gl/WebGL platform shim, the GLB loaders, the procedural 3D kit.
- `tools/blender/`, `tools/preview/` — the Blender pipeline and the GPU-less preview renderer.
- Dependencies: `three`, `@react-three/fiber`, `@types/three`, `expo-gl`.
- `.agents/skills/graphify/` (the licence finding above).

**Added — the pixel garden** (see `docs/05-pixel-garden.md`, ADR-028)
- `src/lib/garden/tree.ts` — the tree grown in code from `(seed, growth)` onto an 84×84 buffer: recursive branches stamped as discs, foliage as dithered four-tone blobs with an outline pass. Deterministic; the same seed always grows the same tree.
- `src/lib/garden/scenery.ts` — the world: banded twilight sky (golden hour while a block runs), star field, moon / low sun, drifting clouds, two hill silhouettes with pines, meadow, soil clearing with growth rings, tree shadow, scattered grass and daisies.
- `src/lib/garden/sprites.ts` — the palette, fourteen hand-authored prop sprites (grass, fern, rocks, log, stump, bench, signpost, lantern, mushrooms, daisies, cairn, sparrow, seed, sprout), and the run/path compiler.
- `src/lib/garden/props.ts` — the placement layer, kept from the 3D days: dressing tiers unlock with growth, trophies follow real history, the signpost hangs one plate per active project.
- `src/lib/garden/self-check.ts` — **129 known-answer checks** (growth weights, stage ladder, tiers, trophy rules, sprite invariants, tree determinism/bounds/monotonicity, scenery layout). Fifth suite in the runner; **611 checks total**.
- `src/components/garden/garden-scene.tsx` — the scene: colour runs compiled into SVG paths (one `<Path>` per colour, ~100 nodes per frame), stepped ~4 fps motion, reduce-motion aware, `animated={false}` for teasers. Same public API (`GardenScene`, `GardenSceneProps`) so the Garden tab and the Today teaser needed no changes.

**Docs updated**: README, AGENTS.md, `docs/index.md`, `docs/03-architecture.md`, `docs/07-decisions.md` (ADR-028), `docs/08-backlog.md` (budget row), `CHANGELOG.md` (0.9.0), landing page copy (no more "3D"), `NOTICE`, `metro.config.js` (no GLB asset rule), `app.json` + `package.json` → 0.9.0.

## 5. Verification

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.
- `npm run self-check` — **611 checks, 0 failing** (bench 80 · engine 122 · garden 129 · notes 190 · sentinel 90).
- `npx expo export --platform web` — full web bundle builds; the 3D/WebGL code paths are gone from the output.
- Reference sweep: zero `.glb` files, zero `three`/`react-three`/`expo-gl` imports, no stale "3D" copy in the app or landing page (remaining "WebGL" strings are prose inside third-party vendored skill docs under `.agents/skills/`, which are not part of the app).

---

# v0.10 re-audit — 2026-10-29 (this pass)

The v0.10 pass re-ran the full audit against the finished tree, after the garden re-craft, the time-log features, and the brand pass.

## Secrets — ✅ clean (re-verified)

- Working tree re-scanned for AWS / GitHub / OpenAI / Google / Slack / Stripe token shapes, private-key blocks, JWTs, credential URLs and high-entropy assignments: **no credentials**. The only pattern hit is the landing page's own inline favicon (a base64 PNG of the project's logo, not a secret).
- Full git history re-scanned (`git log --all -p`): **clean**. Nothing to rotate, no rewrite needed.
- The single credential path in the app remains the user's own GitHub token (device-local KV, excluded from export, validated before save). `app.json`'s `githubClientId` is the public device-flow identifier by design.
- `.env` is present only locally and git-ignored.

## Licensing — ✅ clean

- `LICENSE` (MIT, © 2026 Pankaj Israni), `package.json` `"license": "MIT"`, `NOTICE` complete; vendored skills all carry notices (the unlicensed `graphify` skill was removed in v0.9 and stays removed).
- Direct dependencies re-checked: all MIT (fonts MIT + OFL). The v0.10 pass adds **no new dependency** — the features use existing primitives (`react-native-svg`, `expo-haptics`, `zustand`).
- The brand pipeline (`make-icons.py`, new `make-marks.py`, `make-og.py`) derives every mark from the one source artwork committed at `assets/brand/devlofy-logo.png` — the maintainer's own upload; no third-party mark is used anywhere (the landing page's Octicons are MIT and attributed; the Devlofy brand chip uses the project's own mark).

## Consistency — ✅ clean

- Version `0.10.0` consistent across `package.json`, `app.json` (`APP_VERSION` reads the manifest), the landing page (header, footer, schema.org) and the social card.
- Check counts quoted everywhere updated to the real **650** (garden 168).
- Reference sweep: zero `.glb` references in the app, zero `three`/`expo-gl` imports, the desktop rail's brand tile uses the real mark, the site's favicon is the mark, `site/assets/og.png` is rebuilt.
- No TODO/FIXME debt in `src/` (the only matches are the Bench regex/text tools' own sample fixtures).

## Verification (v0.10)

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.
- `npm run self-check` — **650 checks, 0 failing** (bench 80 · engine 122 · garden 168 · notes 190 · sentinel 90).
- Visual QA: every growth stage × both light modes rendered through the pure-module harness (`scripts/render_garden.js`, kept out of the app bundle) and inspected — seed, sprout, sapling, young, canopy; dusk and golden hour; the 800×176 Today teaser frame.
- Icon/mark verification: `tools/brand/make-icons.py` self-verifies (sizes, mask circles, silhouette coverage) — all green; `make-marks.py` regenerated all six surface marks from the source artwork.
