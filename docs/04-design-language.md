---
tags: [devlofy, design]
created: 2026-10-17
updated: 2026-10-29
---

# Design language — neutral ground, hairline boxes, one violet

Devlofy looks like a **tool**, not a themed app: a neutral canvas, white surfaces held
by a 1px hairline, small drawn geometry, one brand violet, and monospace for everything
that is measured. The reference set (studied, not copied): **Primer-grade developer
surfaces** (density, hairlines, honest state), **Linear** (spacing discipline, keyboard
density), **Things 3** (craft), **Forest** (non-punitive growth). The GitHub feature is a
connection, not an affiliation — no GitHub palette, mark, copy or blue anywhere.

The test that keeps this system honest: **would this look right in a screenshot beside a
good developer tool?** If it needs a gradient, a glow, or a 28px pill to feel designed, it
is wrong. If a border has been replaced by three tones to "separate surfaces", it is wrong
in the other direction. See [[07-decisions]] ADR-027 for what replaced what.

## Colour — one brand, two reserved meanings

The canvas is **neutral**; the brand never tints it. There is exactly one brand hue — the
violet of the app icon — and two reserved meanings.

| Role | Light | Dark | Means |
|---|---|---|---|
| `background` | `#F6F6F8` | `#0C0C10` | the canvas behind everything |
| `surface` | `#FFFFFF` | `#141419` | cards, sheets, rail, nav bar |
| `surfaceElevated` | `#F1F1F4` | `#1C1C23` | wells, chips, search rows, pressed fills |
| `surfaceSunken` | `#E9E9EE` | `#24242C` | recessed tracks: segmented rails, inputs, troughs |
| `controlThumb` | `#FFFFFF` | `#2E2E38` | the plate under a selected segment — **above** the rail in both schemes |
| `hairline` | `#E4E4EA` | `#26262F` | the 1px border that holds a surface |
| `hairlineStrong` | `#CFCFD8` | `#3A3A46` | control outlines and stronger separators |
| `text` | `#15151A` | `#ECECF1` | ink |
| `textSecondary` | `#4B4B57` | `#B7B7C2` | supporting prose |
| `textTertiary` | `#797985` | `#85858F` | metadata, placeholders, mono labels |
| `accent` | `#5B3DF5` | `#A794FF` | the brand: active nav, the one primary action, progress, **money** |
| `accentSoft` | `#EFEBFF` | `#241D4D` | the icon well, a selected row, a focus ring |
| `accentBorder` | `#CFC4FF` | `#40357A` | brand at outline strength |
| `accentContrast` | `#FFFFFF` | `#120C33` | content sitting on a solid `accent` fill |
| `ember` / `emberSoft` | `#8F5A06` / `#FDF0DA` | `#F0B45E` / `#33240D` | focus and time only |
| `info` / `infoSoft` | `#0B5FA5` / `#E3F0FB` | `#7FB8E8` / `#12293D` | neutral system state |
| `danger` / `dangerSoft` | `#C0322A` / `#FDECE9` | `#FF8A80` / `#3D1512` | destructive and failure |

- **Everything is a token** in `src/theme/colors.ts`. No component holds a literal colour.
- **One accent action per screen**, and selection reads by ground, weight and one edge
  rule — never by colour alone (the segmented control also carries a check mark).
- **`ember` is a meaning, not a second brand**: a running session, the timer, the streak,
  minutes tracked. **Money** (rates, line items, the draft total) is `accent`. Sentinel
  reuses the same three roles — up `accent`, slow `ember` (a verdict about *time*), down
  `danger` — and a fourth "success" hue is still declined ([[07-decisions]] ADR-023).
- `accentContrast` is the only content colour for a solid `accent` fill; content on
  `accentSoft` uses `accent`. **The pair is checked, never eyeballed.**
- **Nothing pretends to be live.** A measured number carries the time it was measured;
  Sentinel has no pulsing dot, no ticking "last checked", no refreshing shimmer, because
  it checks only while you are looking (ADR-023).

## Surfaces — hairline, not tone

A card is a **white box drawn on a neutral canvas**: `borderWidth: 1`, `hairline`,
`radius.lg` (8), **no shadow**. That single rule is the whole interface. Depth is not a
layer of grey; it is a line.

| Token | Job |
|---|---|
| `background` | the page behind everything |
| `surface` | `Panel`, sheets, the rail, the nav bar |
| `surfaceElevated` | fills *inside* a card: icon wells, chips, avatars, inputs |
| `surfaceSunken` | recessed tracks: the segmented rail, progress troughs, a disabled control |
| `controlThumb` | the travelling plate of a segmented control |

- `Panel` variants: **filled** (default — white + hairline), **elevated** (the rare surface
  that truly floats), **outlined** (a secondary grouping, transparent + stronger hairline).
  `tone="sunken"` is the flat alternative for a recessed well.
- **Shadows exist in exactly two places**: the FAB, and a sheet/popover that leaves the
  page plane (including the wide-screen tray). Everything else casts nothing.
- `boxShadow` strings only — never legacy shadow/elevation props. Light uses a neutral
  ink shadow; dark uses black, never a glow.
- The one deliberate exception is the **garden stage**: dark in both schemes (see §3D).

## Shape and space

- Radii are **small and engineered**: `xs 3` (bars, tags) · `sm 4` (inline chips) ·
  `md 6` (buttons, inputs, icon wells, rail rows) · `lg 8` (cards, the FAB) ·
  `xl 12` (hero surfaces, sheets, statement blocks) · `full 999` (status tag, avatar,
  running dot — **never a button or a panel**).
- One 4-point grid (`spacing`: 2/4/8/12/16/20/32/48). Screen edge padding is `lg` (16);
  card padding is `lg`; stacked cards sit `lg` apart. A layout that needs an in-between
  value uses the nearest step or adds a named step to the theme.
- Touch targets are ≥44 tall (buttons are 40/46 with hit slop; rows are 52–60).
- Grouped lists use **hairlines, not nested cards** (`ListRow` inside `Panel pad={0}`).
- Density is a feature: a real stat line beats blank space. Empty states offer the next
  action.

## Typography — two voices

**Geist speaks; JetBrains Mono measures.** Prose, headings and labels are Geist. Anything
counted, timed, versioned, hashed or labelled as a field is mono — tracked and uppercase at
label size. That split is what makes the app read as an instrument rather than a document.

| Token | Size / weight | Job |
|---|---|---|
| `display` | 31 / 600, −0.9 | screen titles (max two lines) |
| `title` | 22 / 600, −0.4 | a statement inside a container |
| `headline` | 17 / 600, −0.2 | card and section titles |
| `body` / `bodyMedium` | 16 / 400 · 500 | prose, inputs |
| `subhead` / `subheadMedium` | 15 / 400 · 500 | secondary lines, row subtitles |
| `caption` / `captionMedium` | 13 / 400 · 500 | metadata |
| `mono` | 13 / 500, tabular | counts and figures in the body face |
| `code` | 12.5 mono | code, versions, short hashes |
| `monoLabel` | 10.5 mono, +0.9, uppercase | **every** section, stat, field and table label |
| `timer` | 38 mono, −1.2, tabular | the live focus timer |
| `numberXl` / `numberLg` | 40 / 28 semibold, tabular | hero figures |
| `numberMd` | 22 / 26 semibold, tabular | the phone size of a stat row |

- **`monoLabel` is the connective tissue**: it labels sections (`MOMENTUM`), stats
  (`ACTIVE`), form fields (`PROJECT`) and table columns. It is quiet (`textTertiary`),
  tracked, and never used for prose. The old `eyebrow` token is gone.
- **Sentence case everywhere else.** Never Title Case Every Word, never mono for prose.
- **Numbers are design elements**: `numberXl`/`numberLg` for a hero, `numberMd` when three
  figures share a 390px row, `AnimatedNumber` so a value travels rather than snaps. Money
  keeps two decimals; most counts keep none.
- Hierarchy comes from weight, colour and the mono label above a heading — not from four
  display sizes.

## The action button and the FAB

`AppButton` is a **drawn box at `radius.md`**, 40px (`md`) or 46px (`lg`), label-led with
the icon in front. Variants: `filled` (the one brand-solid control), `tonal`, `outlined`,
`text`.

- **A disabled control is a quiet box, not a faded one**: `surfaceSunken` ground,
  `textTertiary` label, hairline intact. Never 0.45 opacity — a white-on-violet label at
  45% is a lavender smudge with no readable text.
- Every **content tab screen** has **exactly one FAB** (`Fab`, extended, bottom-end, above
  the nav bar) and it is that screen's only filled action:

| Screen | FAB |
|---|---|
| Today | `Start focus` / `End session` (ember while a session runs) |
| Garden | `Focus for 25m` / `End block` |
| Work | `New project` / `New client` (follows the segment) |
| Notes | `New note` |

- The FAB is a 48px box at `radius.lg` with a brand-tinted shadow; it is deliberately not
  a Material pill. `Screen` grows the scroll padding to clear it.
- **Detail and modal routes have no FAB** (a form's action is its submit button; `/search`,
  `/invoice` and `/note/[id]` are *for* their content). They may carry **one** filled
  `AppButton`; everything else is tonal, outlined or text — e.g. `/invoice` keeps export
  tonal so the draft total stays the loudest thing on the screen.

## Life — where richness comes from

Flat is not the goal; **empty** is the failure. Richness comes from content and craft, in
this order:

1. **Real information.** A stat line beats blank space. The Today hero says how long is
   *left*, not just how long you've gone. Surface history you already store before
   inventing decoration.
2. **Drawn statement blocks.** A statement lives on a full-width panel with a big figure,
   a mono label, and often a hairline-divided stat row — a colour block is a colour, never
   a gradient.
3. **Asymmetry.** Bento, not a stack of identical full-width cards: a hero figure, then a
   two-up, then a chart, then a horizontal shelf. Three equal cards in a row is the most
   generic arrangement there is.
4. **Identity.** People and projects get an `Avatar`: deterministic initials on one of
   three sanctioned tints, so the same name is the same colour on every screen.
5. **Imagery.** The Blender stills in `empty-art.ts` and the live 3D scene are the app's
   photography. The garden may animate — one loud moment is the whole point.
6. **Momentum.** The rhythm heatmap, streaks, meters and counters are data made visible.

Never: gradient heroes, glow blobs, coloured shadows on cards, tinted body text "for
richness", a second accent, or a decorative pill where a mono label belongs.

## States — four, not three

Every screen that reads data answers four questions, in this order: **loading**, **error**,
**empty**, **ready**. The trap is collapsing the middle two, because the code is shorter:
`!data ? <EmptyState /> : …` renders "Nothing here yet" — or worse, "It may have been deleted
on this device" — when the read actually threw, which tells the user their own work is gone.

- **Loading** is a `Loading` panel carrying the verb of the thing (`reading the shelf…`),
  shown only when there is nothing else to show: `useLiveQuery` keeps the last good value,
  so a silent refresh never flashes a spinner over real content.
- **Error** is `ErrorState` — one sentence built from the noun (`<ErrorState
  what="projects" />` → "Could not read projects.") and an explicit **Retry** wired to the
  query's `refresh`. Quiet: `danger` text and an accent retry, no red panel, no illustration.
- **Empty** is `EmptyState`, using the `empty-art` still where one exists and copy that says
  what to do next instead of what is missing.
- **Ready** is the screen.

An error is also **not "not found"**: "no longer exists" may only be said after a
*successful* read that came back null. Where a screen has several queries, each panel
carries its own state — one failed section is a sentence in that panel, never a blank page.

## Reaching a feature — a shelf card, and its state where the work is

More is a hub, not a junk drawer. The categories reached from it (Bench, Sentinel, GitHub)
open as a **feature shelf** of `FeatureCard`s, and the difference between a card and a
`ListRow` is deliberate:

| | `ListRow` | `FeatureCard` |
|---|---|---|
| Job | one item inside a group | a place you can go |
| Leading | 30px well, usually neutral | a 44px well on a soft tone, always |
| State | none | a **live pill**: what the feature is doing right now |
| Reads as | a preference | a product |

- At expanded width More shows them **2-up**; the settings below are label/control rows
  with a 340px control column, not a second stack of cards.
- **A pill never computes anything.** `More` and `Today` both render
  `standingLine(standingOf(…))` from `src/lib/sentinel/status.ts` — one pure function, so
  two screens showing the same fact cannot disagree. A card that derived its own number
  would be a second source of truth for it.
- **"Nothing to say" is a state, not an absence** — the neutral pill (`Nothing watched
  yet`) — and a failed read keeps its own wording (`Could not read the board`) instead of
  rendering as an empty one. The states rule applies to a pill, not just a screen.
- **The state surfaces where the work is.** A card is where you *go to* a feature; the
  Sentinel strip on Today is where you *find out you need to*. Reach paths stay where the
  feature budget put them ([[07-decisions]] ADR-001/021/024).
- **The tab bar carries destinations, not alarms.** No badge, ever — the alarm is a
  `danger` pill on Today, and it costs one row only while the feature is actually set up.
- **A card never animates to be noticed.** No pulsing dot, no badge bounce, no live
  shimmer: `statusColors()` gives the pill and the icon well one shared tone.

## Writing — a document, measured

The note editor is the one screen the user writes in for a long sitting, so it has its own
measure and its own chrome:

- **A document column, not a page.** `DOCUMENT_MAX_WIDTH = 760` centres the editor on a
  wide screen; block content is inset by `BLOCK_GUTTER` (24 + 8 = 32) so the text sits on
  the same left edge as the title, meta and stats. Reading mode uses the same inset.
- **Fixed chrome, one scroll.** Header, title, meta, stats and the format bar stay put; the
  block list owns its own scroll. A toolbar that scrolls away with the text is a toolbar
  nobody presses.
- **One `TextInput` is mounted at a time** — the block you are in. Every other block is
  *drawn*, so inline marks (`**bold**`, `[[links]]`) are visible only in the block being
  edited and resolved everywhere else. `active` (what the toolbar acts on) and `editing`
  (what has an input) are deliberately separate state: a toolbar press blurs the input on
  web, and the toolbar must still know what it is formatting.
- **Two modes, one document.** Editing and reading are the same body rendered two ways: the
  reader runs the same inline tokenizer with the syntax taken out and `[[links]]` tappable.
- **A mark is a token, not a mode.** Bold is `**` in the text, converted as you type, so the
  note is the same string in the reader, in search and in the export — never a rich-text
  blob. The bar *reflects* the caret (`activeMarks`) instead of holding state of its own.
- **The keyboard is the primary input.** Markdown input rules (`# `, `- `, `1. `, `[] `,
  `> `, a fenced code block, `---`) and a `/` menu on an empty block are the fast path; the
  format bar is for the mouse and the finger. Enter starts the next block, and on an empty
  list item it leaves the list.
- **Destruction is a two-tap confirm on the screen that owns the thing** (ADR-021's rule),
  and a pressable row's trailing slot is never another pressable.
- **Nothing jumps.** A new block never re-scrolls the list under the caret, and the block
  being edited is brought into view once, quietly, when focus arrives.

## Chrome, safe areas and the wide shell

- `Screen` owns the **top inset**, the header (mono eyebrow, display title, subtitle,
  trailing action on the same line), the centred max-width (920) and the FAB slot. The
  bottom bar owns its own bottom inset; the note editor owns both.
- On scroll the shell paints a **44px compact top bar** — the title, a hairline underneath,
  `pointerEvents="none"` — fading in between 10 and 56px. It is chrome, never a second
  header: it cannot be tapped, so it never steals a press from the content.
- The header's **trailing slot is an action slot, not a metadata slot** — one control
  (edit, add, filter), never a list of pills. Facts about the record (status, due date,
  stack tags) belong in the content, in a wrapping pill row under the header. The slot is
  capped at 55% of the row so a long trailing can never crush the title.
- The bottom bar sits **in the layout**, not floating over content, so nothing is ever
  hidden behind it. Android edge-to-edge is the baseline: the window resizes for the
  keyboard (`adjustResize`), so editors use `KeyboardAvoidingView` on iOS only.
- **Expanded shell**: the **248px rail** lives at the app root (`src/app/_layout.tsx`
  renders `DesktopRail` beside the `Stack`), so a pushed screen sits beside the navigation
  rather than over it. The rail is a brand block (leaf, name, `local-first`, version), a
  search row, the five destinations, and a footer that says where the data is.
  `activeNavPath()` is prefix-aware: `/project`, `/client`, `/invoice` and `/github` keep
  Work lit; `/note` keeps Notes lit; `/bench`, `/sentinel` keep More lit.
- **Category roots** (`/bench`, `/sentinel`, `/github`) drop their `BackRow` at expanded
  width, because the rail already says where they are; deeper routes keep theirs.
- **A sheet on a wide screen is a tray**: centred, `maxWidth: 560`, `radius.xl`,
  `shadows.raised`, `marginBottom: spacing.xl`; on a phone it stays flush and full-width.
- **The 3D window is a stage**: full-bleed inside a panel, dark in both schemes
  (`STAGE_COLOR #0C0D0B`, `SOIL_COLOR #1B1710`), with the page's own surfaces around it.
- **A key cap only exists where the key exists.** The search cap renders on web and above
  compact only, and names the real modifier (`⌘K` on Apple, `Ctrl K` elsewhere). A phone
  has neither key, so it shows nothing.

## Motion

The rule that governs every animation here: **motion states a change, then stops.** Nothing
overshoots, nothing wobbles, nothing bounces. **Any spring at all is a bug in this
codebase**, and so is `springify()`. The tokens do not exist, so a spring cannot be reached
for by accident.

- Tokens in `src/theme/motion.ts` — never an ad-hoc curve or duration.
- Curves: `easing.out` (ease-out quint) for anything entering or travelling, and
  `easing.emphasized` for on-screen movement. Never `linear`, never a bare default.
- Durations: `press` 90 · `fast` 140 · `base` 200 · `slow` 300 (values that travel) ·
  `page` 420 (a screen's first paint) · `scene` 520 (a sheet or a surface replacing another).
  Fast feedback answers instantly; the page still has time to choreograph.
- **Press** is symmetric and small: in to 0.975 on `duration.press`, back to 1 on
  `duration.fast`, both on the UI thread via shared values (`.set()`), never `runOnJS`.
  Use `PressableScale`; never hand-roll a press scale.
- **Entrances** are `FadeUp`: a short rise (8px) plus a fade over `duration.page`, staggered
  45ms by index, max 6 items. No entrance animation on virtualized rows.
- **The bottom bar's rule travels** with `withTiming` on `easing.emphasized` — one shared
  value, UI thread, no re-render. There is no pill and no bounce.
- **Values** count and travel rather than snap: `AnimatedNumber`, `Meter` and `ProgressRing`
  run `duration.slow` on `easing.out` and land exactly on the value.
- Haptics: selection on tabs/toggles, light on buttons, medium on the FAB, success on
  completed sessions/tasks. Nothing on web.
- `ReduceMotion.System` is respected everywhere: entrances collapse, meters snap, a
  running dot rests as a steady dot.
- No spinners on text: save state is a calm dot + label (`saved / saving`).
- **Tab switches do not animate.** A scene change is where the 520ms lives.

## Anti-slop rules

1. No emoji as icons. Phosphor only, `light`/`regular`/`fill` weights.
2. No gradients, no ambient glow blobs, no purple-blue "AI gradient" heroes. A colour block
   is a colour, not a blend.
3. **Hairlines are the universal container treatment** — one white box, one 1px line. Do
   not substitute a ladder of tonal greys for a border, and do not add a shadow to a card
   that has not left the page.
4. No Material pills. Buttons and panels are boxes; `full` is for a status tag, an avatar or
   a dot only.
5. Not everything is a card. Lists are lists; cards group surfaces; a tip is a quote, not a
   card.
6. No three *identical* cards in a row, and no stat strip of four identical columns. A
   three-figure `StatRow` with hairline dividers is composition; four equal boxes are slop.
7. Every screen has four states: loading, error, empty, ready — designed, not defaulted.
8. Every control does something; dead-end rows are not pressable.
9. One FAB per tab screen, one filled control. Everything else is tonal, outlined or plain.
   A disabled control is a quiet box, never a 45% fade.
10. No spring, no overshoot, no `springify()`; tab switches don't animate, cards don't float
    on scroll, blur is not decoration.
11. No GitHub identity: no borrowed palette, mark, octicon, or copy. The app is
    community-built and open source; the GitHub integration is a feature, not a badge.
12. Never show a keyboard cap on a device that has no keyboard, and never name the wrong
    modifier.

## Desktop mode (tablet / wide)

- **Compact**: a flat bottom bar anchored to the screen edge — hairline on top, label always
  visible, one 22×2 brand rule travelling above the active item.
- **Expanded**: a 248px rail with a brand block, a search row, five destinations (active =
  soft brand ground + 2px brand edge rule) and a local-first footer. `useDesktopMode()`
  follows the breakpoint ("auto") or the user's setting.
- Content centres at `CONTENT_MAX_WIDTH` 920; prose documents use `DOCUMENT_MAX_WIDTH` 760.
- Wide screens get **compositions**, not wider columns: Garden is scene + instrument side
  by side, More is 2-up cards over label/control rows, Bench splits its shelf into two
  contiguous height-balanced columns (`columnsOf`, weight = tools + 2).

## Inspiration protocol

When stealing an idea, cite the pattern, not the product: e.g. "Primer's hairline
surfaces", "Linear's keyboard-first density", "Things' checkbox physics", "Forest's
non-punitive growth". Adapt it to this system — never lift the surface, and never borrow a
mark.

## 3D in the design

The garden is the one loud moment. Everything around it stays quiet so the tree can be the
hero: a full-bleed stage panel, hairline-separated footer, stats underneath. The stage is
dark in both schemes because a daylit tree on a white page reads as a sticker. When the
platform cannot give us a GPU context (headless render, locked-down browser) the scene
degrades to a designed still instead of throwing. See [[05-blender-pipeline]].
