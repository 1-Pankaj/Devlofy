---
tags: [devlofy, working-report]
created: 2026-10-29
---

# Working report — v0.10.0 "the garden, handcrafted"

This is the report of the full overhaul pass: what was asked, what was done, how it was verified, and where every change lives. Companion documents: `AUDIT.md` (the secrets/licence audit) and `CHANGELOG.md` (the release entry).

## The brief

1. Use the supplied logo (the violet **D-and-arrow**) everywhere a logo is applicable.
2. Re-craft the pixel garden — v0.9's art was correct but coarse; it needed to feel lively and handcrafted.
3. Overhaul the app, include more features, complete what was left.
4. Verify everything, then hand over the final ZIP with this report.

## 1. The brand, everywhere a logo applies

One source artwork (`assets/brand/devlofy-logo.png`) now feeds every surface through two generators:

- `tools/brand/make-icons.py` → the app icon set (iOS/Android/web `icon.png`, 64px favicon, adaptive foreground sized inside the 72/108 dp mask circle, monochrome silhouette) — self-verifying, all checks green.
- **`tools/brand/make-marks.py` (new)** → the transparent mark (`devlofy-mark.png`), the white silhouette (`devlofy-mark-light.png`), both splash icons, and the landing page's header marks. The un-mix is exact (colour × coverage), so nothing carries a white halo on dark surfaces.

Where the mark landed:

- **Desktop rail brand tile** — the old generic leaf glyph in a violet square is now the real mark, white on the brand fill, in both schemes (`src/components/nav/desktop-shell.tsx`).
- **Launch splash** — light and dark splash images wired in `app.json` (`expo-splash-screen`), 128px, both schemes.
- **Landing page** — the header's GitHub octicon replaced by the mark; the green placeholder favicon replaced by the mark as an inline data-URI; `site/assets/brand/{mark,mark-night}.png` shipped.
- **Social card** — `tools/brand/make-og.py` rebuilt with the real mark, real version (0.10.0) and the real check count (650); `site/assets/og.png` regenerated and wired as `og:image`.

## 2. The garden, handcrafted (ADR-029)

Every layer was redrawn; the architecture from v0.9 (character buffers → pixel runs → SVG paths, one renderer for Android and web, deterministic from `(seed, growth, width, mode, tick)`) is unchanged.

**The world** (`src/lib/garden/scenery.ts`):
- a twelve-stop sky with a dithered "last light" band on the horizon (indigo-into-rose at dusk, violet-into-amber while a block runs);
- a cratered moon with a soft halo, top-left — the light source every sprite agrees with; a half-set sun at golden hour;
- three hill ridges with atmospheric fade (far = lighter), silhouette pines, and a **windmill turning on the far crest**;
- a meadow in three green bands with light dashes, **young blades that sway in four phases**, clustered flower drifts, and a **footpath** that leaves the clearing for the bottom of the frame;
- a **pond in the foreground-left, under the moon** — lily pads (one in flower), cattails, a moon glint, drifting shimmer and expanding ripples;
- pond, windmill and path appear only on frames wide enough to hold them.

**The tree** (`src/lib/garden/tree.ts`): a tapered four-tone trunk with an S-curve lean, a knot, and a flared root base; recursive limbs as tapering strokes; a canopy of overlapping clumps where back clumps are darker than front ones and crossing clumps paint **contact shadows**; one shared silhouette outline unifies the crown; sun-kissed sparkles from 60% growth and **blossom from 82%**.

**The props** (`src/lib/garden/sprites.ts`): all fourteen redrawn bigger and shaded (amanita cluster with gills, moss-topped boulders, a ringed log with a tenant, a bench with three legs and slats, arrow plates on the signpost, a hedge-brown sparrow with three behaviour frames, two-frame monarch butterfly, cattails, lily pads). Slots were re-placed so the composition breathes around the pond and the path (`props.ts`).

**The life** (`garden-scene.tsx`): fireflies that gather at the lantern while a block runs, a moth circling it, a sparrow's perch → look → peck → hop cycle, falling leaves once the tree has a crown, the odd shooting star, golden-hour butterflies over the flower drifts, cloud drift, water shimmer, grass sway, the lantern's flame growing when a session runs. Every creature is a **pure function of the tick** — deterministic, frozen by `animated={false}` or reduce-motion.

**Visual QA**: each stage (seed → canopy) × each mode (dusk, gold) × the wide teaser frame was rendered through a harness that requires the exact shipped modules and inspected as PNGs; fixes driven by those renders (crown shape, bark striping, plate attachment, cloud-on-moon spawn, prop crowding) until the frames read right.

## 3. Features — completing the backlog's Next line

- **Time-log editing (ADR-030)** — a backlog item since v0.2, now shipped: tap any finished block in the Garden log to **move it to another project** (billable recomputed from the destination's rate via the same path a new block uses), **forget it** (two-tap confirm, soft delete — log, invoice and export agree), or **file a block by hand** ("Log a block": 1–720 minutes — the timer's own runaway ceiling — attributed like any other). New repo functions: `moveFocusSession`, `deleteFocusSession`, `createManualSession`.
- **Custom block lengths** — 25/50/90 chips stay; a "custom" chip accepts **5–240 minutes**, clamped, remembered in settings (`focusBlockMinutes`) beside the focus project.
- No schema change (the columns already exist; soft-delete was already the convention), **no new dependency**.

## 4. Docs & release hygiene

- `CHANGELOG.md`: a full 0.10.0 entry.
- `docs/07-decisions.md`: **ADR-029** (the garden re-craft) and **ADR-030** (the ledger is editable).
- `docs/08-backlog.md`: the time-log line struck with its rule (minutes stay the timer's truth); a v0.10 budget-ledger row added.
- `docs/index.md`, `docs/05-pixel-garden.md`, `README.md`, `AGENTS.md`, `docs/03-architecture.md`: counts and status updated.
- Version **0.10.0** in `package.json` + `app.json`; the landing page and social card agree.

## 5. Verification (everything, checked)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint .` | clean |
| `npm run self-check` | **650 checks, 0 failing** (bench 80 · engine 122 · garden 168 · notes 190 · sentinel 90) |
| Garden known-answer suite | 168 checks — new invariants pinned: wide-frame furniture, moon placement, four-phase sway, blossom season, canopy outline, contact shadow, sprite-frame shape equality |
| Secrets audit (tree + full git history) | clean — see `AUDIT.md` |
| Licence audit (LICENSE/NOTICE/deps/site) | clean — all MIT/OFL, attributed |
| Icon verification | `make-icons.py` self-checks green (sizes, mask circle, silhouette) |
| Visual QA renders | all five stages × two modes + teaser — inspected and approved |

## 6. What to do with this ZIP

1. Unzip, `npm install` (Node 20+), then `npm run check` — it must print **650 checks · 0 failing**.
2. `npm run ios`/`android`/`web` — the garden is the second tab; start a block and watch golden hour arrive.
3. The garden's art is code: to author a new prop, draw a grid in `src/lib/garden/sprites.ts` and register it — the suite will hold you honest.
4. Deploy `site/` as before (GitHub Pages); the new `og.png`, favicon and marks are already in place.
