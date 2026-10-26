## What this changes

<!-- One or two sentences. If it fixes an issue: "Closes #123". -->

## Why

<!-- The problem, or the reason the current behaviour is wrong. If it contradicts
an ADR in docs/07-decisions.md, say so and argue it rather than routing around it. -->

## How I checked it

- [ ] `npm run check` — types, lint, 482 known-answer checks
- [ ] Exercised it on: <!-- Android / web / both -->
- [ ] Expanded width (side rail) and compact width, if this touches layout
- [ ] Screenshots or a short clip, if this is user-visible
- [ ] If a pure module changed: the case that would have caught it is in that folder's `self-check.ts`
- [ ] If geometry changed: `NODE_PATH=$PWD/node_modules node tools/preview/render.js`

## House rules this change keeps

- [ ] Tokens only — no hardcoded colour, spacing, type or motion outside `src/theme/`
- [ ] Platform code behind an adapter (`x.ts` + `x.native.ts` + `x.web.ts`); core imports no platform-only library
- [ ] Every state handled: loading / error / empty / ready — and a failed read is never rendered as an empty one
- [ ] No spring, no overshoot; haptics on native only
- [ ] All SQL in `src/lib/db/repo.ts`; migrations append-only; new tables added to `exportAll()` in the same change
- [ ] No new dependency — or a paragraph in this PR on why the alternative was worse
- [ ] Feature budget respected: what this displaces, or why it is a fix

## Notes for the reviewer

<!-- Anything that is deliberately unfinished, or that you are unsure about. -->
