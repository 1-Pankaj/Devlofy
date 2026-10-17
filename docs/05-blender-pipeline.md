---
tags: [devlofy, blender, 3d]
created: 2026-10-17
---

# 3D & Blender pipeline

## How it works today (v0.1)

The Focus Garden is **procedural**: `src/lib/garden/model.ts` generates a deterministic tree from `(seed, growth)` — recursion, no assets. This means:

- The garden works on web + Android **from the first commit**, with zero asset pipeline risk.
- Growth is *real data*: `growthFromStats({ totalMinutes, streakDays, todayMinutes })` → 0..1, bucketed to 5% steps so the tree only regenerates when it actually grows.
- Rendering: `garden-scene.tsx` via the `@/lib/three` platform shim (expo-gl native / WebGL web). Instanced leaves, ~25 draw calls, DPR clamped, `frameloop="demand"` for teasers.

## The Blender day-one commitment

The user opens **Blender** (the MCP addon is wired: `get_addon_status`, `execute_blender_code`, `import_asset`); the agent authors models **inside that live session** and integrates them. Nothing about this flow blocks the procedural garden — models are additive.

### Model backlog (make in this order)

1. **Tree variants** — 2–3 stylized low-poly trees (sapling / young / canopy) to replace/extend the procedural tree. Style: faceted (flat-shaded), chunky silhouette, 500–3k tris each.
2. **Garden props** — stones, a lantern, flower clumps, a fence post. Kit-bash scale, CC0-clean.
3. **Focus props** — a log/desk, a coffee mug, a tiny terminal. Props appear at milestone moments.
4. **Trophy shelf** — per-milestone trophies for shipped projects.
5. **Logo mark** — the sprout-in-squircle as an actual 3D object for the splash/celebration.

### Hard rules for assets

- **GLB only**, Y-up, meters, origin at the base, applied transforms.
- Flat-shaded, low-poly, single material per object where possible; baked vertex colors over textures.
- Budget: ≤ 10k tris *total* on the garden screen; textures ≤ 1k if any.
- Export from Blender: `File → Export → glTF 2.0 (.glb)` with +Y up, apply modifiers on.

## Integration path (when Blender turns on)

1. `get_addon_status` → confirm the session; then `execute_blender_code` to build/generate the asset, screenshot via MCP to review in-chat.
2. Export GLB into `assets/models/`.
3. Loader: `useGLTF` from a native-safe loader shim (three's `GLTFLoader` + `expo-asset`; web uses plain URL). The shim lives beside `src/lib/three/` following the adapter rule ([[03-architecture]]) — no ad-hoc imports inside scenes.
4. Scenes keep the same props (`seed`, `growth`); model swap is an internal detail of `garden-scene.tsx`.
5. Preload on the Garden tab only. If loading fails → fall back to the procedural tree (never an empty frame).

## Aesthetic direction for Blender assets

Match [[04-design-language]]: faceted low-poly with confident silhouette, ink-deep greens on ambient, sprout-green emissive accents used like a light source, **no photoreal grass, no PBR bark scans**. Think *Monument Valley meets terminal*.

## Performance guardrails

- Target 60 fps on a mid-range Android tablet; degrade: fewer leaves → no sway → static (frameloop demand) → 2D placeholder.
- One canvas alive at a time (Garden tab mounts/unmounts on focus; teasers render on demand).
- Any new scene must state its tri count and draw calls in a comment.
