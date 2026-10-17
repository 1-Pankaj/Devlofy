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
4. **Focus props** — still open: a bench; a signpost with a notch per active project.
5. **Logo mark** — the sprout-in-squircle as an actual 3D object for the splash/celebration.

### Hard rules for assets

- **GLB only**, Y-up, meters, origin at the base, applied transforms.
- Flat-shaded, low-poly, single material per object where possible; baked vertex colors over textures.
- Budget: ≤ 15k tris *total* on the garden screen (largest stage, canopy, is ≈ 12.1k; the always-on dressing adds ≈ 1.5k and trophies ≈ 2.5k worst case — only one tree is ever mounted); textures ≤ 1k if any.
- Export from Blender: `File → Export → glTF 2.0 (.glb)` with +Y up, apply modifiers on.

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
