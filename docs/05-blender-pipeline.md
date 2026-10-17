---
tags: [devlofy, blender, 3d]
created: 2026-10-17
---

# 3D & Blender pipeline

## How it works today (v0.1)

The Focus Garden renders a **deterministic procedural tree** from `(seed, growth)` (`src/lib/garden/model.ts`) and prefers a **Blender-authored GLB per growth stage** whenever one is available:

- Growth is *real data*: `growthFromStats({ totalMinutes, streakDays, todayMinutes })` → 0..1, bucketed to 5% steps so the tree only regenerates when it actually grows.
- Rendering: `garden-scene.tsx` via the `@/lib/three` platform shim (expo-gl native / WebGL web). Instanced leaves, DPR clamped, `frameloop="demand"` for teasers.
- **Blender models (authored 2026-10-17, in the live session):** `assets/models/garden-{sprout,sapling,canopy}.glb` — flat-shaded, two leaf tones plus a subtle sprout emissive, ~1.5k faces / ~140 KB in total. Built via `execute_blender_code`, reviewed with MCP viewport screenshots.
- Stage → model: `< 0.2` sprout, `< 0.5` sapling, `≥ 0.5` canopy. Loaded lazily, cached per variant, cloned per consumer (`src/lib/garden/models.ts`). **Any load failure keeps the procedural tree on screen** ([[07-decisions|ADR-007]]).

## The Blender day-one commitment

The user opens **Blender** (the MCP addon is wired: `get_addon_status`, `execute_blender_code`, `import_asset`); the agent authors models **inside that live session** and integrates them. Nothing about this flow blocks the procedural garden — models are additive.

### Model backlog (make in this order)

1. **Tree variants** *(done: sprout / sapling / canopy integrated 2026-10-17)* — extend with more stages/seeds the same way.
2. **Garden props** — stones, a lantern, flower clumps, a fence post. Kit-bash scale, CC0-clean.
3. **Focus props** — a log/desk, a coffee mug, a tiny terminal. Props appear at milestone moments.
4. **Trophy shelf** — per-milestone trophies for shipped projects.
5. **Logo mark** — the sprout-in-squircle as an actual 3D object for the splash/celebration.

### Hard rules for assets

- **GLB only**, Y-up, meters, origin at the base, applied transforms.
- Flat-shaded, low-poly, single material per object where possible; baked vertex colors over textures.
- Budget: ≤ 10k tris *total* on the garden screen; textures ≤ 1k if any.
- Export from Blender: `File → Export → glTF 2.0 (.glb)` with +Y up, apply modifiers on.

## Integration path

1. **Done.** `get_addon_status` → confirm the session; `execute_blender_code` builds the asset; MCP screenshots (`look`) review it in-chat.
2. **Done.** Export GLB into `assets/models/` (`glb` ships via `metro.config.js` assetExts).
3. **Done.** Loader shim: `src/lib/three/load-model.{ts,native,web}.ts` — native reads bytes with `expo-asset` + `expo-file-system` (`File.bytes()`) and parses in memory (three's `FileLoader` cannot fetch `file://` URLs); web runs `GLTFLoader` on the bundled URL. No ad-hoc three imports inside scenes ([[03-architecture]]).
4. **Done.** Scene API unchanged: `garden-scene.tsx` keeps `(seed, growth)`; the GLB swap is internal (`src/lib/garden/models.ts`: promise cache per variant + `clone(true)` per consumer).
5. **Done.** Fallback: loading failure keeps the procedural tree (never an empty frame); `load-model.native.ts` imports the Hermes `process.emitWarning` polyfill before three.

## Aesthetic direction for Blender assets

Match [[04-design-language]]: faceted low-poly with confident silhouette, ink-deep greens on ambient, sprout-green emissive accents used like a light source, **no photoreal grass, no PBR bark scans**. Think *Monument Valley meets terminal*.

Theme colors used by the authored models: trunk `#6E5B4C`; leaves `#1F8A55` (deep) and `#3EE08F` (sprout accent, slight emissive).

## Performance guardrails

- Target 60 fps on a mid-range Android tablet; degrade: fewer leaves → no sway → static (frameloop demand) → 2D placeholder.
- One canvas alive at a time (Garden tab mounts/unmounts on focus; teasers render on demand).
- Any new scene must state its tri count and draw calls in a comment.
