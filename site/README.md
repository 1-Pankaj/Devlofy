# Devlofy landing page

The static marketing page for Devlofy, published to GitHub Pages at
<https://1-pankaj.github.io/Devlofy/>.

One file: `index.html` — markup, CSS, JavaScript and the Octicon sprite all
inline. No build step, no package manager, no framework.

```
site/
  index.html    the whole page
  README.md     this file
```

## Preview

Serve the folder over HTTP:

```bash
python -m http.server 4173 --directory site
# or
npx serve site
```

Then open <http://localhost:4173/>.

## Deploy

`.github/workflows/pages.yml` uploads `site/` as the Pages artifact on every push
to `master` that touches the page (or on a manual dispatch). Only `site/` is
published — never the app source, the docs vault or the tooling.

## What the page loads

Everything of substance is inline, but the page does make third-party requests.
Keep this list in step with reality if the page changes:

| Request | Used for |
| --- | --- |
| `fonts.googleapis.com` + `fonts.gstatic.com` | Mona Sans (SIL OFL 1.1) |
| `cdn.jsdelivr.net` — GSAP 3.13 + ScrollTrigger | scroll reveals, magnetic buttons |
| `cdn.jsdelivr.net` — Lenis 1.1.18 | smooth scrolling |
| `cdn.jsdelivr.net` — Swiper 11 | changelog carousel |
| `api.github.com/repos/1-Pankaj/Devlofy` | star / fork / watch / issue counters |

Blocked or offline, the page still reads: the reveal animation is skipped, the
changelog slides stack vertically, and the counters show a dash.

## Page map

`#top` hero · `#inside` the nine modules · `#readme` README panel + About ·
`#bench` eleven tools · `#garden` the tree · `#changelog` releases ·
`#privacy` security · `#checks` verification · closing CTA + footer.

A command palette opens on `/` or `Ctrl/⌘ K` and lists the Bench tools and the
page's own sections.

## Rules for edits

- **Copy must be checkable against the repository.** Version, SDK, check counts,
  tool counts and licence come from `package.json`, `tools/checks/self-check.sh`,
  `src/lib/bench/tools.ts`, `LICENSE` and `CHANGELOG.md`. No invented customers,
  downloads or benchmarks.
- **Anchors and `site/` paths stay as they are.** Pages serves this from
  `/Devlofy/`; the canonical and `og:url` point there.
- **One filled action per view.** The primary button is the action; everything
  else is a quiet button or a link.
- **Motion is optional.** Reveals, the marquee and the tree all respect
  `prefers-reduced-motion: reduce`.
- Re-check at 1440, 920 and 390px before pushing; there should be no horizontal
  overflow and no console errors beyond a blocked request.
