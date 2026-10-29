---
tags: [devlofy, garden, pixel-art]
created: 2026-10-29
---

# The pixel garden

**Supersedes [[05-blender-pipeline]]** (deleted with the 3D pipeline in v0.9 — see [[07-decisions]] ADR-028).

The Focus Garden is **procedural pixel art**: the tree is grown in code from `(seed, growth)`, the world around it is generated per frame size, and the props are hand-authored character grids. There are no model files, no GPU renderer and no loading state — the same pure modules compile under Node, which is why the garden carries its own known-answer suite.

## The pipeline

```
src/lib/garden/model.ts      growth math: weights, clamps, 5% buckets, seeded randomness
src/lib/garden/tree.ts       the tree: recursive branches + dithered foliage on an 84×84 buffer
src/lib/garden/scenery.ts    the world: sky bands, stars, moon/sun, clouds, hills, meadow, clearing
src/lib/garden/sprites.ts    the palette + hand grids + run merging + SVG path compilation
src/lib/garden/props.ts      placement: dressing tiers + earned trophies (pure functions of history)
src/lib/garden/models.ts     the stage ladder: seed → sprout → sapling → young → canopy
src/lib/garden/self-check.ts 168 known-answer checks over all of the above
src/components/garden/garden-scene.tsx
                             the only React file: layers runs into one <Svg>
```

## How a frame is drawn

1. **One grid.** The scene is 96 rows tall; one unit is one "pixel". The component measures its frame and maps the 96 rows onto the measured height, so the same art fills a 176-unit teaser and a 428-unit stage without rescaling art.
2. **Runs, not rects.** Every layer is reduced to horizontal runs of one colour (`sprites.ts`), and runs compile into SVG **path data — one `<Path>` per colour**. A full garden is roughly a hundred SVG nodes, which is why it can re-step at ~4 fps on a phone.
3. **Painter's order.** sky → stars → lamp (moon at rest, low sun mid-session) → far clouds → hills → pines → meadow → clearing → growth rings → tree shadow → props *behind* the tree (the sine of their placement angle) → the tree → props in front → near cloud → the bird → twinkles → fireflies.
4. **Stepped motion.** The world advances on a 260 ms tick: clouds drift, bright stars blink, fireflies wander (and gather at the lantern while a block runs), the crown sways one unit on a slow cycle, the lantern's halo pulses. Reduced-motion freezes the frame; `animated={false}` never starts the clock.

## Authoring rules

- **Grids are rectangular and priced.** Every row of a sprite is the same width; every character exists in `PALETTE` or is `.`. The self-check fails the run otherwise.
- **Light comes from the upper left.** Highlights sit top-left of a blob, shade bottom-right; wood discs use the same convention (`v` light rim, `u` core, `t` shade).
- **Determinism is the contract.** Same `(seed, growth, stats, projects)` → the same garden on every device, every render. Randomness always comes from `mulberry32(hashString(...))`, never `Math.random()`.
- **The signpost is data.** One plate per active project, alternating sides — the only prop whose shape is history.
- **A prop needs a sprite and a slot.** Add the grid, register it in `PROP_SPRITES`, and give it a slot in `props.ts`; the suite checks the registry covers every prop.

## Previewing a frame without a device

The pure modules compile standalone, so any frame can be rebuilt as a static SVG:

```bash
npx tsc -p tsconfig.render.json   # or a temp config with module=commonjs, node10 resolution
node -e "const {buildScenery}=require('./garden-js/src/lib/garden/scenery'); ..."
```

Assemble the layers exactly as `garden-scene.tsx` does (same order, same runs) and write an `.svg`. That is how the four reference frames in the v0.9 changelog were reviewed.
