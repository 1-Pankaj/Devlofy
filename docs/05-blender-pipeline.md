---
tags: [devlofy, blender, 3d]
created: 2026-10-17
---

# 3D & Blender pipeline

## How it works today (v0.1)

The Focus Garden renders a **deterministic procedural tree** from `(seed, growth)` (`src/lib/garden/model.ts`) and prefers a **Blender-authored GLB per growth stage** whenever one is available:

- Growth is *real data*: `growthFromStats({ totalMinutes, streakDays, todayMinutes })` → 0..1, bucketed to 5% steps so the tree only regenerates when it actually grows.
- Rendering: `garden-scene.tsx` via the `@/lib/three` platform shim (expo-gl native / WebGL web). Instanced leaves, DPR clamped, `frameloop="demand"` for teasers.
- **Blender models v3 (2026-10-17, live session):** `assets/models/garden-{seed,sprout,sapling,young,canopy}.glb` — hand-crafted stages built by the re-runnable script `tools/blender/garden_models.py` (source of truth): deep limb scaffolds (4 branch levels + bare twig tips, root knuckles, decimated skin limbs), **lobed crowns** (left / right / top lobes with open gaps so the fork structure reads through), per-stage dressing (soil mound, grass tufts, pebbles, mushrooms). Canopy ≈ 12.1k tris; each stage is one joined mesh at the origin with identity transforms.
- **Garden props kit (2026-10-17):** `assets/models/props/prop-{rock,rocks,grass,fern,log,stump,mushrooms,flowers,cairn,lantern,bird}.glb` — built by `tools/blender/garden_props.py`; ≈ 4.6k tris across all eleven (flowers heaviest at 2.1k). Wired in `src/lib/garden/props.ts`: **dressing tiers** unlock with growth (grass/rocks → fern + lantern → log/stump/rock → the full clearing) and **trophies** follow real history — mushrooms per 2 h focused (max 3), daisy patches at 3/7-day streaks, a stacked cairn at 6 h, a sparrow at a 5-day streak. The lantern's panes burn brighter while a session runs.
- Stage → model: `< 0.12` seed, `< 0.32` sprout, `< 0.58` sapling, `< 0.8` young, `≥ 0.8` canopy. Loaded lazily, cached per variant, cloned per consumer (`src/lib/garden/models.ts`); the scene enables soft shadows and aims the camera at each stage's height. **Any load failure keeps the procedural tree on screen** ([[07-decisions|ADR-007]]).

## The Blender day-one commitment

The user opens **Blender** (the MCP addon is wired: `get_addon_status`, `execute_blender_code`, `import_asset`); the agent authors models **inside that live session** and integrates them. Nothing about this flow blocks the procedural garden — models are additive.

### Model backlog (make in this order)

1. **Tree variants** *(done: seed / sprout / sapling / young / canopy; detail pass + visible branches, integrated 2026-10-17)* — next: alternative species (oak / pine / blossom) as a garden-style setting.
2. **Garden props** *(done 2026-10-17: rock, rocks, grass, fern, log, stump — dressing tiers wired to growth)*.
3. **Session trophies** *(done 2026-10-17: mushrooms, flowers, cairn, bird — data-driven; lantern glows mid-session)*.
4. **Focus props** — *done 2026-10-19, in code rather than in Blender*: the **bench** (unlocks at sapling growth) and the **signpost** — one hanging plate per **active project**. They are the first garden objects whose shape is *data*, and they are authored by the code kit below because no Blender session was available (see [[07-decisions|ADR-022]]).
5. **Logo mark** — the sprout-in-squircle as an actual 3D object for the splash/celebration.

## The code-authored kit (v0.6) — the second way a prop arrives

The GLBs above come from a **live** Blender session. When that session is not available — another machine, a locked-down environment, a contributor without the MCP addon — the garden would otherwise be frozen at the models it already has. So there is a second authoring path that needs no tooling at all: **`src/lib/three/kit/`**, eight props written as three.js geometry, merged from parts (`parts.ts` → `models.ts` → `index.ts`).

It is not decorative. `src/lib/garden/props.ts` answers every placement through one of three paths, and a placement does not know which one answered it:

| Path | Which props |
|---|---|
| **Authored GLB** | the eleven in `assets/models/props/` — preferred whenever the file loads |
| **Code kit** | the two with no GLB (**bench**, **signpost**) *always*, and any other prop whose GLB never arrives, so the garden is dressed on every device |
| **Nothing** | an earned trophy whose GLB is missing — it waits rather than showing a stand-in that would teach the wrong shape |

**Invariants the kit holds**, all of them checked by the tool below rather than asserted: *deterministic* (surface noise is a hash of each vertex's own position, so the same model is identical on every device and two vertices sharing a corner never crack apart); **one draw call per prop** — parts merge into a single vertex-coloured, flat-shaded geometry, the lantern excepted, which is two (its body plus the glow panes, so the emissive material can be lit without lighting the wood); **base at y = 0 in metres**, matching the GLB convention exactly, so a placement can swap between the two without moving; ≤ **700 triangles** per prop.

The two code-only props are the interesting ones:

- **bench** — three seat planks, a back on a 12° lean, four legs, one stretcher. Unlocks at sapling growth.
- **signpost** — a bilateral arm and one hanging plate per **active project** (`countActiveProjects()` → `dressingFor(growth, projects)`), up to five, alternating sides. Zero projects is an honest bare post.

The rest: **rock** (1–3 jittered stones), **grass** (nine tapered blades), **fern** (seven arching fronds), **log** (cut ends, a branch stub, moss on the up-side), **stump** (roots tapered into the soil, rings on the sawn face), **lantern** (glass on `DevlofyKitGlow`, so it still answers focus — dim at rest, lit mid-session).

## Seeing 3D without a GPU: `tools/preview`

A browser with no WebGL context — headless in a container, a webview that has it switched off — can only show the app's "3D is unavailable" still, and **a model you cannot look at is a model you cannot judge.** `tools/preview/render.js` closes that gap with no new dependency:

1. it builds **every** kit variant through the real three.js code paths and checks the invariants above — finite vertices, base on the ground, height and footprint sane, triangle budget, determinism (build twice, compare the geometry), exactly one glow mesh on the lantern, and every kit model having a consumer in `props.ts`;
2. it **software-rasterises a contact sheet** — z-buffered, flat-shaded, lit by the scene's own three lights, with the same linear→sRGB conversion — and writes it to `/tmp/shots/kit-sheet.png` for review, no renderer required.

```bash
npx tsc src/lib/three/kit/index.ts --ignoreConfig --outDir /tmp/kit \
  --module commonjs --target es2020 --moduleResolution node --skipLibCheck
NODE_PATH=$PWD/node_modules node tools/preview/render.js
```

The last tile of the sheet is the **procedural tree**: what the garden shows when no GLB ever arrives, and the one 3D object in this app that had no way of being seen before this tool existed.

The kit's other half of the contract is compile-time, not runtime: `props.ts` types its two maps so a hole cannot be expressed — `Record<GlbProp, GltfAssetModule>` requires a module for every authored prop and `Record<KitProp, KitAnswer>` requires a kit entry for every prop that has no GLB — so adding a prop to either union without an answer fails `npx tsc --noEmit` instead of quietly rendering an empty clearing on a device whose GLB did not load.

### Hard rules for assets

- **GLB only**, Y-up, meters, origin at the base, applied transforms.
- Flat-shaded, low-poly, single material per object where possible; baked vertex colors over textures.
- Budget: ≤ **21k tris** *total* on the garden screen — measured, not estimated, and only one tree is ever mounted. Largest stage is canopy at 12,120 (seed 876, sprout 878, sapling 5,210, young 8,680); the eleven props are 4,632 together (bird 490, cairn 80, fern 694, **flowers 2,100**, grass 256, lantern 72, log 304, mushrooms 432, rock 20, rocks 60, stump 124), of which the always-on dressing is 1,806 worst case and the earned trophies 6,066 — two daisy patches are 4,200 of that, so *flowers* are the prop to thin first if this number ever has to come down. The code kit adds 264 at most (bench 144 + signpost ≤ 120) and totals 1,422 across *all* its variants. Textures ≤ 1k if any.
- Export from Blender: `File → Export → glTF 2.0 (.glb)` with +Y up, apply modifiers on.
- If you author a prop in code instead, the same rules bind: base at y = 0, metres, flat-shaded, 3–4 tones, per-vertex noise, and you must run `tools/preview` (below) to see it.

## Integration path

1. **Done.** `get_addon_status` → confirm the session; `execute_blender_code` builds the asset; MCP screenshots (`look`) review it in-chat.
2. **Done.** Export GLB into `assets/models/` (`glb` ships via `metro.config.js` assetExts).
3. **Done.** Loader shim: `src/lib/three/load-model.{ts,native,web}.ts` — native reads bytes with `expo-asset` + `expo-file-system` (`File.bytes()`) and parses in memory (three's `FileLoader` cannot fetch `file://` URLs); web runs `GLTFLoader` on the bundled URL. No ad-hoc three imports inside scenes ([[03-architecture]]).
4. **Done.** Scene API unchanged: `garden-scene.tsx` keeps `(seed, growth)`; the GLB swap is internal (`src/lib/garden/models.ts`: promise cache per variant + `clone(true)` per consumer).
5. **Done.** Fallback: loading failure keeps the procedural tree (never an empty frame); `load-model.native.ts` imports the Hermes `process.emitWarning` polyfill before three.

## Aesthetic direction for Blender assets

Match [[04-design-language]]: sculpted low-poly with confident silhouette — smooth organic limbs (skin-modifier craft), tiered foliage clumps with scalloped edges, ink-deep greens on ambient, sprout-green accents used like light sources, **no photoreal grass, no PBR bark scans**. Think *Monument Valley meets terminal*.

Craft rules (the difference between a model and slop): hierarchy of masses (big primaries → medium fills → small accents), overlap ≥ 40% inside a crown, per-vertex noise on every organic surface, asymmetry everywhere, a soil mound + micro-dressing at the base so nothing floats, and only 3-4 tones per model.

Theme colors used by the authored models: trunk `#6E5B4C`; leaves `#1E7B4E` (deep), `#2FA96C` (mid), `#3EE08F` (bright accent, faint emissive); soil `#33291F`; stone `#57534C`; grass `#1F6B45`.

## Performance guardrails

- Target 60 fps on a mid-range Android tablet; degrade: fewer leaves → no sway → static (frameloop demand) → 2D placeholder.
- One canvas alive at a time (Garden tab mounts/unmounts on focus; teasers render on demand).
- Any new scene must state its tri count and draw calls in a comment.
