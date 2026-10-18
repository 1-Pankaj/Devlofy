---
tags: [devlofy, design]
created: 2026-10-17
updated: 2026-10-18
---

# Design language — Material 3 Expressive

Devlofy is built on **Material 3** and leans into its *Expressive* register: bold tonal
blocks, generous shape, confident type, precise motion. The reference set (studied, not
copied): **Material 3 / Material You** (colour roles, tonal surfaces, FAB, shape scale),
**Instagram / WhatsApp / LinkedIn** (mainstream clarity, real density), **Linear** (spacing
discipline, keyboard-first density), **Things 3** (craft), **Forest** (growth warmth).

The test that keeps this system honest: **tonal surfaces, one primary action, real
information.** If a screen needs a border to explain itself, the tone is wrong. If it reads
like a tech demo — neon, glow, monospace everywhere, giant empty space — it is wrong. See
[[07-decisions]] ADR-014 for what changed and why.

## Colour — roles, not decorations

The scheme is built the way Material 3 builds one: a **primary** hue that tints the entire
neutral ramp, plus a **tertiary** hue reserved for exactly one meaning.

| Role | Hue | Means |
|---|---|---|
| `accent` (+ `accentSoft`, `accentBorder`) | **indigo** `#4B5AA0` / `#BCC2FF` | the brand: active nav, the primary action, progress, selection, **money** (rates, line items, the draft total) |
| `ember` (+ `emberSoft`) | **amber** `#A85A08` / `#FFB870` | focus and time only: a running session, the timer, the streak, minutes tracked |
| `info` / `danger` | blue-grey / red | state: sync state, destructive and failure |

- **Everything is a token** in `src/theme/colors.ts`. No component holds a literal colour.
- Neutrals are **tinted** with the primary hue (`#F5F2FB` canvas, `#131318` dark) — never
  pure grey, never pure black.
- `accentContrast` is the content colour for a solid `accent` fill. Content on `accentSoft`
  uses the `accent` tone. **A bright container never carries the ink for a darker one — the
  pair is always checked, never eyeballed.**
- **One accent action per screen.** Selection (nav, filters, chips) reads by tone and weight,
  and where it matters (the segmented control) by a check mark — not by colour alone.

## Surfaces — tone, not borders

A card reads as raised because it sits a step above the canvas. **There is no 1px grey
border on a container anywhere in this system.**

| Token | Job |
|---|---|
| `background` | the canvas behind everything |
| `surface` | cards (`Panel`), the nav bar, the rail — one step above the canvas |
| `surfaceElevated` | interactive fills and wells: icon wells, chips, pressed rows, media backdrops |
| `surfaceSunken` | recessed tracks: the segmented rail, text fields, progress troughs |

- `Panel` variants: **filled** (resting, default), **elevated** (the thing being interacted
  with), **outlined** (only where tone alone is too weak).
- Shadows are `boxShadow` strings only — never legacy shadow/elevation props — and they are
  **tinted** with the primary hue in light, neutral in dark. Tone does the layering; elevation
  is the second signal, never the first.
- Hero stones and the FAB use `radius.xl` (28); cards use `radius.lg` (16).

## The floating action button

Every **content tab screen** (Today, Garden, Work, Notes) has **exactly one FAB** (`Fab`,
extended, bottom-end, above the nav bar) and it is the screen's only action:

| Screen | FAB |
|---|---|
| Today | `Start focus` / `End session` (ember when a session runs) |
| Garden | `Focus for 25m` / `End block` |
| Work | `New project` / `New client` (follows the segment) |
| Notes | `New note` |

Everything else on those screens is tonal, outlined, or plain text (`AppButton` `tonal` /
`outlined` / `text`). The FAB floats over content; `Screen` grows the scroll padding to clear
it.

**Detail and modal routes have no FAB** (a form's action is its submit button; `/search` and
`/invoice` are *for* their content). They may carry **one** filled `AppButton`; anything else
is tonal or text — e.g. `/invoice` keeps its export action tonal so the draft total stays the
loudest thing on the screen.

## Life — where richness comes from

Flat is not the goal; **empty** is the failure. Richness comes from content and craft, in
this order:

1. **Real information.** A stat line beats blank space. The Today hero says how long is *left*,
   not just how long you've gone. Surface history you already store before inventing decoration.
2. **Tonal blocks.** A statement lives on a full-width `accentSoft` block with a big figure —
   a bold colour field, not a gradient. Gradients are not part of this language.
3. **Asymmetry.** Bento, not a stack of identical full-width cards: a hero figure, then a
   two-up, then a chart, then a horizontal shelf. Three equal cards in a row is the most
   generic arrangement there is.
4. **Identity.** People and projects get an `Avatar`: deterministic initials on one of three
   sanctioned tints, so the same name is the same colour on every screen.
5. **Imagery.** The Blender stills in `empty-art.ts` and the live 3D scene are the app's
   photography. The garden may animate — one loud moment is the whole point.
6. **Momentum.** Numbers are design elements: `numberXl` / `numberLg` with tabular figures,
   live pulse for a running session, streak and totals stated plainly.

Never: gradient heroes, glow blobs, coloured shadows on static cards, tinted body text "for
richness", or a second accent.

## States — four, not three

Every screen that reads data answers four questions, in this order: **loading**, **error**,
**empty**, **ready**. The trap is collapsing the middle two, because the code is shorter:
`!data ? <EmptyState /> : …` renders "Nothing here yet" — or worse, "It may have been deleted on
this device" — when the read actually threw, which tells the user their own work is gone.

- **Loading** is a `Loading` panel carrying the verb of the thing (`reading the shelf…`), and it
  shows only when there is nothing else to show: `useLiveQuery` keeps the last good value, so a
  silent refresh never flashes a spinner over real content.
- **Error** is `ErrorState` (`src/components/ui/error-state.tsx`) — one sentence built from the
  noun (`<ErrorState what="projects" />` → "Could not read projects.") and an explicit **Retry**
  wired to the query's `refresh`. It is deliberately quiet: the same `danger` text and accent
  retry as a form error, no red panel, no illustration.
- **Empty** is `EmptyState`, using the `empty-art` still where one exists and copy that says what
  to do next instead of what is missing.
- **Ready** is the screen.

An error is also **not "not found"**: "no longer exists" may only be said after a *successful*
read that came back null. Where a screen has several queries, each panel carries its own state —
one failed section is a sentence in that panel, never a blank page.

## Typography — one voice

**Geist** does everything; hierarchy comes from weight and size, never from switching
typefaces. JetBrains Mono survives only where the text really is machine output: code blocks
and raw tabular figures.

| Token | Size / weight | Job |
|---|---|---|
| `display` | 34 / 700, −1.0 | screen titles |
| `title` | 24 / 600, −0.5 | statements inside a container |
| `headline` | 19 / 600, −0.25 | card and section titles |
| `body` | 16 / 400 | prose, inputs |
| `subhead` | 15 / 400 | secondary lines, row subtitles |
| `caption` | 13 / 400 | metadata |
| `eyebrow` | 12 / 600, +0.5, uppercase | small section labels (`MOMENTUM`) |
| `numberXl` / `numberLg` | 46 / 32, tabular | the big numbers |
| `mono` | 13 / 500, tabular | counts and figures |

Signature move: the **uppercase micro-label above a section title** — small, low-contrast,
quiet. Use it sparingly; when a block already carries a big figure, the label is a `caption`,
not an eyebrow. Everything else is sentence case: never Title Case Every Word, never mono for
prose.

## Shape and space

- Radii (Material 3): `xs 4` (bars) · `sm 8` (rail rows, week bars) · `md 12` (wells, inputs)
  · `lg 16` (cards) · `xl 28` (hero blocks, sheets) · `full` (buttons, chips, the FAB,
  avatars). Buttons and chips are **pills**.
- One 4-point grid (`spacing`). Screen edge padding is `lg` (16); card padding `lg`; stacked
  cards sit `lg` apart.
- Touch targets are ≥44 tall. Grouped lists use **hairlines, not nested cards** (`ListRow`
  inside `Panel pad=0`).
- Density is a feature: prefer a real stat line over blank space. Empty states offer the next
  action.

## Safe areas & chrome

- `Screen` owns the **top inset**, the large top app bar (label, display title, subtitle,
  trailing action on the same line), the centered max-width (≈920) and the FAB slot; the
  bottom bar owns its own bottom inset; the note editor owns both.
- The header's **trailing slot is an action slot, not a metadata slot** — one control (edit,
  add, filter), never a list of pills. Facts about the record (status, due date, stack tags)
  belong in the content, in a wrapping pill row directly under the header. The slot is capped
  at 55% of the row so a long trailing can never crush the title into a column of single
  characters.
- The bottom bar sits **in the layout**, not floating over content, so nothing is ever hidden
  behind it.
- Android edge-to-edge is the baseline: the window resizes for the keyboard (`adjustResize`),
  so editors use `KeyboardAvoidingView` on iOS only.
- The 3D scene may sit full-bleed inside a `Panel`, with the state as a floating chip (`scrim`).

## Motion

The rule that governs every animation here: **motion states a change, then stops.** Nothing
overshoots, nothing wobbles, nothing bounces. **Any spring at all is a bug in this codebase**, and
so is `springify()`. This is stronger than "damped correctly": the tokens do not exist, so a
spring cannot be reached for by accident.

- Tokens in `src/theme/motion.ts` — never an ad-hoc curve.
- There is **no spring in the app at all**: no `withSpring`, no `springify()`, no `spring`
  token. Where a value has to settle it is a duration against a curve, so "how long" is
  always a number you can read.
- Curves: `easing.out` (ease-out quint) for anything entering or travelling, and
  `easing.emphasized` (Material's `0.2, 0, 0, 1`) for on-screen movement. Never `linear`,
  never a bare default.
- Durations: `press` 110 · `fast` 160 · `base` 220 · `slow` 320 (values that travel) · `page`
  460 (the first paint of a screen).
- **Press** is symmetric and small: in to 0.975 on `duration.press`, back to 1 on
  `duration.fast`, both on the UI thread via shared values (`.set()`), never `runOnJS`.
- **Entrances** are `FadeUp`: a short rise (8 px) plus a fade over `duration.page`, staggered
  45 ms by index, max 6 items. No entrance animation on virtualized rows.
- **The nav bar's active pill** slides with `withTiming` on `easing.emphasized` — one shared
  value, UI thread, no re-render.
- **Values** count and travel rather than snap: `AnimatedNumber` and `ProgressRing` both run
  `duration.slow` on `easing.out` and land exactly on the value.
- Haptics: selection on tabs/toggles, light on buttons, medium on the FAB, success on completed
  sessions/tasks. Nothing on web.
- `ReduceMotion.System` is respected everywhere: entrances collapse, `ProgressRing` snaps,
  `LiveDot` rests as a steady dot.
- No spinners on text: save state is a calm dot + label (`saved / saving`).

## Anti-slop rules

1. No emoji as icons. Phosphor only, `light`/`regular`/`fill` weights.
2. No gradients, no ambient glow blobs, no purple-blue "AI gradient" heroes. A colour block is a
   colour, not a blend.
3. No 1px grey outline as the universal card treatment. Tone separates surfaces.
4. Not everything is a card. Lists are lists; cards group surfaces; a tip is a quote, not a card.
5. No three equal cards in a row, and no stat strip of four identical columns.
6. Every screen has four states: loading, error, empty, ready — designed, not defaulted. Lists
   show the shared `Loading` reader while the database answers instead of flashing the empty
   state.
7. Every control does something; dead-end rows are not pressable.
8. One FAB per tab screen, one filled control. Everything else is tonal or plain.
9. Tab switches don't animate; cards don't float on scroll; blur is not decoration.

## Desktop mode (tablet / wide)

- Compact: `surface` nav bar anchored to the screen edge — filled icon when active, label always
  visible, accent-soft pill sliding underneath the active item.
- Expanded: **side rail** — brand block, pill nav rows (active = accent-soft well), local-first
  footer. Content centres at max-width 920.
- The rail is `DesktopShell`; screens don't know about it (`Screen` handles centered width
  automatically).

## Inspiration protocol

When stealing an idea, cite the pattern, not the product: e.g. "Material's tonal surface
hierarchy", "Linear's keyboard-first density", "Instagram's feed rhythm", "Forest's
non-punitive growth", "Things' checkbox physics". Adapt it to this system — never lift the
surface.

## 3D in the design

The garden is the one loud moment. Everything around it stays quiet so the tree can be the
hero: full-bleed `Panel`, hairline-separated footer, stats underneath. When the platform cannot
give us a GPU context (headless render, locked-down browser) the scene degrades to a designed
still instead of throwing. See [[05-blender-pipeline]].
