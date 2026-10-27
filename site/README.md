# Devlofy landing page

The static marketing page for Devlofy, published to GitHub Pages at
<https://1-pankaj.github.io/Devlofy/>.

It is deliberately plain: `index.html`, `styles.css`, `main.js` and `assets/`.
No framework, no build step, no package manager and no runtime dependency. Fonts,
icons and screenshots are vendored, so the page makes **no third-party requests**
and renders the same offline as it does on Pages.

```
site/
  index.html                    the whole page, including the inline icon sprite
  styles.css                    design tokens and every section
  main.js                       parser demo, header, reveals, stack, spotlight, fireflies
  assets/app/                   screenshots captured from the running app (WebP)
  assets/brand/                 night mark + favicon
  assets/fonts/                 Mona Sans and Mona Sans Mono (SIL OFL 1.1)
  assets/phosphor/              source SVGs + MIT licence for the inlined sprite
  assets/og.png                 the 1200x630 social card
```

## Preview

Serve the folder over HTTP. A `file://` URL will not load the woff2 fonts.

```bash
python -m http.server 4173 --directory site
# or
npx serve site
```

Then open <http://localhost:4173/>. Every path is relative, so the page also
works under a subpath — which is how Pages serves it at `/Devlofy/`.

The page needs no COOP/COEP headers; only the app's web build does.

## Deploy

`.github/workflows/pages.yml` uploads `site/` as the Pages artifact on every push
to `master` that touches the page (or on a manual dispatch). Set **Settings →
Pages → Source: GitHub Actions** once; after that the URL above updates itself.
Only `site/` is published — never the app source, the docs vault or the tooling.

## Design

A GitHub-shaped page, not an editorial one:

- **Dark hero**, near-black `#08090c` with a violet wash, a fading dot field and
  the product window floating over its lower edge.
- **Light product sections** on white and `#f6f8fa`, with 1px borders, 10–14px
  radii and quiet shadows.
- **Dark garden and closing**, so the two 3D-heavy moments bookend the page.
- **Type**: Mona Sans throughout, Mona Sans Mono for labels, code and figures.
  Body is 18px, ledes 20–21px, section headings 60px on desktop and 36px on
  mobile, the hero 88px / 34px. Small labels are 12px and never carry copy.
- **Motion**: one duration against two curves in `styles.css`; no springs, no
  overshoot. Everything is disabled under `prefers-reduced-motion: reduce`.

All colour, spacing and type values live in `:root` at the top of `styles.css`.
Change them there, not in a section rule.

## Interactions

The component ideas came from [Skiper UI](https://skiper-ui.com/) and
[Aceternity UI](https://ui.aceternity.com/), reimplemented from scratch in
vanilla CSS/JS so the page keeps its no-dependency rule:

- a bounded pointer parallax on the hero product window;
- a sticky deck of three tour cards, each covering the last;
- pointer-tracked spotlight cards in the feature grid;
- a seamless evidence ticker (paused when it leaves the viewport);
- a conic "tracing beam" border around the install terminal;
- word-by-word line reveals and a firefly canvas in the garden.

The quick-add box is the one piece of real logic: `main.js` contains a port of
`src/lib/parse-task.ts` and renders the chips before anything would be saved.
When the grammar changes in the app, port the change here in the same commit.
If JavaScript is off, the page still reads: the demo keeps its example and the
checks matrix hides rather than showing an empty panel.

## Rules for edits

- **Paths stay relative.** Pages serves this from `/Devlofy/`, not a domain root.
- **Copy must be checkable against the repository.** No invented customers,
  downloads, benchmarks or dates. Current figures and where they come from:

  | Claim | Source |
  | --- | --- |
  | v0.8.0, Expo SDK 58, React Native 0.88, MIT | `package.json`, `LICENSE` |
  | 482 checks = 80 Bench + 122 Engine + 190 Notes + 90 Sentinel | `tools/checks/self-check.sh` |
  | 11 Bench tools | `src/lib/bench/tools.ts` |
  | 5 garden stages, 11 authored GLB props + bench/signpost in code | `assets/models/`, `src/lib/garden/props.ts` |
  | 55 / 30 / 15 growth split | `src/lib/garden/model.ts` |
  | 15-minute Sentinel freshness, 500 checks kept per target | `src/lib/sentinel/` |
  | 2h 40m at ₹2,500/h = ₹6,666.67 | `src/lib/db/seed.ts`, `src/lib/money.ts` |

- **A failed read is not an empty one.** The page has no reads, but the same
  house rule applies to any future live data: say it failed, do not paint zero.
- **No CDN, analytics, trackers or third-party runtime requests**, and no new
  dependency. Add a local asset instead.
- **One filled action per view.** The violet button is the action; everything
  else is a quiet link or an outline button.

## Assets and licences

| Asset | Source | Notes |
| --- | --- | --- |
| `assets/fonts/mona-sans*.woff2` | [github/mona-sans](https://github.com/github/mona-sans) | Vendored unmodified; `OFL.txt` beside them |
| `assets/phosphor/*.svg` + inline sprite | [phosphor-icons/core](https://github.com/phosphor-icons/core) | MIT (`assets/phosphor/LICENSE`); source files are not fetched at runtime |
| `assets/app/*.webp` | This app | Captured at 2× from the seeded demo data, then encoded to WebP |
| `assets/brand/favicon.png` | `assets/images/favicon.png` | Copy of the generated app icon |
| `assets/brand/mark-night.png` | Generated | Transparent night mark used in the header, footer and OG card |
| `assets/og.png` | Generated | `python tools/brand/make-og.py` |

The screenshots show what a new install sees (`src/lib/db/seed.ts`). If the seed
or the relevant screen changes, re-capture them rather than editing the image.

`make-og.py` caches Mona Sans under the system temp directory and fetches it
from GitHub the first time; that is a development-time request, not something
the page does. Re-run it after a headline or number changes:

```bash
python tools/brand/make-og.py
```

## Before committing

```bash
python -m http.server 4173 --directory site
```

- Check the console is clean and the page has no horizontal overflow at 1440,
  920 and 390px.
- Toggle reduced motion and JavaScript off; the page must still read.
- Run the repository gates from the root: `npx tsc --noEmit`, `npx eslint .`,
  `tools/checks/self-check.sh`.
