## What changed

<!-- One or two sentences. Use "Closes #123" if this fixes an issue. -->

## Why

<!-- What was wrong, or what the change is for. If it conflicts with a decision in
docs/07-decisions.md, say so and explain why. -->

## How I tested it

- [ ] `npm run check` passes (types, lint, 482 tests)
- [ ] Tried it on: <!-- Android / web / both -->
- [ ] Checked a phone width and a wide width, if this touches layout
- [ ] Added screenshots, if this is visible in the UI
- [ ] Added a test in `self-check.ts`, if a pure module changed
- [ ] Ran `NODE_PATH=$PWD/node_modules node tools/preview/render.js`, if 3D changed

## Project rules

- [ ] Colors, spacing, text styles and motion come from `src/theme/`
- [ ] Platform code is in `x.native.ts` / `x.web.ts`; shared code imports no platform-only library
- [ ] All four states handled: loading, error, empty, ready. A failed read shows an error, not an empty screen
- [ ] No springs, no overshoot; haptics on native only
- [ ] SQL is in `src/lib/db/repo.ts`; migrations are append-only; new tables added to `exportAll()`
- [ ] No new dependency, or a note here on why an existing one does not work
- [ ] Feature budget respected: this replaces something, or it is a fix

## Notes for the reviewer

<!-- Anything unfinished, or anything you are unsure about. -->
