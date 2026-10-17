---
tags: [devlofy, design]
created: 2026-10-17
---

# Design language — "Ink & Sprout"

Design reference set (studied, not copied): **Linear** (precision dark), **Things 3** (craft), **Forest** (growth warmth), **Material You** (Android adaptation), **Raycast/Arc** (delightful motion), **Fantastical** (dense info, clean).

## The two colors

- **Ink** — near-black with a green undertone (`#070A08`). Dark is the canon; the OLED look is the brand.
- **Sprout** — one living accent (`#3EE08F`). Used *sparingly*: active nav, key action, growth. Ember (`#FFB25E`) is reserved for focus/time/momentum.
- Light mode ("Paper") exists, but the dark theme is what the app is.

All values live in `src/theme/colors.ts`. **Nothing hardcodes a color outside `src/theme/`.**

## Typography — three voices

| Voice | Font | Job |
|---|---|---|
| UI | **Geist** | body, labels, controls |
| Display | **Space Grotesk** | titles, big numbers, the brand voice |
| Machine | **JetBrains Mono** | eyebrows, timers, counts, metadata |

Signature move: uppercase mono **eyebrows** (`FOCUS · 42M`, `SAT · OCT 17`) over Geist/Space-Grotesk content. Numbers use `tabular-nums`.

## Surfaces — the Double-Bezel

`Panel` is the only card shape: 2px outer bezel on a sunken surface + hairline ring; inner core with concentric radius (`outer − 3`), its own hairline, and an inner top highlight. On dark it reads as machined metal; on paper, as bonded paper.

- Grouped lists use **hairlines, not cards** (`ListRow` + `Panel pad=0`).
- `borderCurve: 'continuous'` (squircle) on every non-capsule radius.
- Shadows are `boxShadow` strings only — never legacy shadow/elevation props. Two elevations + one ambient glow token, nothing else.

## Motion

- Tokens in `src/theme/motion.ts` — never an ad-hoc curve.
- Press: scale 0.97, `duration.press` (120 ms), strong ease-out in; snappy spring out — all on the UI thread via shared values (`.set()`), never `runOnJS`.
- Boring transitions are *fast* (180 ms); entrances can take 420 ms.
- Stagger entrances (`FadeUp`, 70 ms apart, max 6 items). No entrance animation on virtualized rows.
- Haptics: selection on tabs/toggles, light on buttons, success on completed sessions/tasks. Nothing on web.
- `ReduceMotion.System` respected on entrance choreography.

## Anti-slop rules (from the design skills)

1. No emoji as icons, no stock Material/Lucide thick icons → Phosphor thin/regular.
2. No purple-blue "AI gradient" heroes. The only gradient is the ambient radial `Glow` (sprout/sky, very low alpha).
3. Not everything is a card. Lists are lists; cards are for grouped surfaces.
4. Every screen has four states: loading, error, empty, ready — designed, not defaulted.
5. Every control does something; dead-end rows are not pressable.
6. One accent action per screen. Primary button is the only colored button.
7. Tab switches don't animate; cards don't float on scroll; blur is not decoration.

## Desktop mode (tablet / wide)

- Compact: floating pill tab bar (solid surface + stone shadow, clears content, selection haptics).
- Expanded: **side rail** — brand block, nav rows (active = accent-soft well), local-first footer. Content centers at max-width 920.
- The rail is `DesktopShell`; screens don't know about it (`Screen` handles centered width automatically).

## Inspiration protocol

When stealing an idea, cite the pattern, not the product: e.g. "Linear's keyboard-first density", "Forest's non-punitive growth", "Things' checkbox physics". Adapt it to Ink & Sprout — never lift the surface.

## 3D in the design

The garden is the one loud moment. Everything around it stays quiet so the tree can be the hero: full-bleed `Panel`, ambient glow, stats whisper underneath. See [[05-blender-pipeline]].
