# Contributing

Thanks for looking. Devlofy is a personal-first app built in the open, and it holds opinions on purpose — so the fastest path to a merged change is to match the ones it already holds.

## Before you start

Read [`AGENTS.md`](AGENTS.md). It is the real contributor guide: product context, architecture rules, and the conventions reviews enforce. [`docs/07-decisions.md`](docs/07-decisions.md) explains why the architecture is what it is — if a change contradicts an ADR, say so in the pull request and argue it, don't route around it.

## Setup

```bash
npm install
npx expo start        # a → Android, w → web
```

Node 22+. Dependencies are installed with `npx expo install <package>`, never a bare `npm install <package>`, because Expo resolves the SDK-compatible version.

## Must pass before you push

```bash
npm run check
```

That is typecheck + lint + the four known-answer suites (482 checks). CI runs the same command and will refuse a red pull request. If you touch a pure module — `src/lib/bench`, `src/lib/notes`, `src/lib/sentinel`, `src/lib/engine` — add the case that would have caught your change to the folder's `self-check.ts`.

Touch the 3D kit? Then also run the GPU-less renderer, which asserts the geometry invariants and writes a contact sheet:

```bash
NODE_PATH=$PWD/node_modules node tools/preview/render.js
```

## The rules that get a change sent back

- **Tokens only.** No hardcoded colors, spacing, type or motion — they come from `src/theme/`.
- **Adapters for platform code.** `x.ts` (type anchor) + `x.native.ts` + `x.web.ts`. Core never imports a platform-only library.
- **A failed read is never an empty screen.** An error with no data gets `ErrorState` with the query's `refresh`; "empty" requires a successful read that came back empty.
- **Motion never overshoots.** There is no spring anywhere in the app — a duration against one of the two curves in `theme/motion`.
- **All SQL lives in `src/lib/db/repo.ts`.** Migrations are append-only, and the same change updates `docs/06-data-model.md`.
- **Every table you create goes into `exportAll()`** in the same change. The user owns their data; the export dump carries a version.
- **Feature budget.** A new feature displaces one or waits in [`docs/08-backlog.md`](docs/08-backlog.md).
- **One filled action per screen** — the FAB. Accent (indigo) is the brand; ember (amber) is time and focus only.

## Pull requests

- Keep one change to one thing; a fix and a refactor in one diff is two reviews.
- Say what you ran. `npm run check` green plus anything else you exercised is enough.
- Screenshots help for UI work — Android and web, compact and expanded widths.
- No new dependency without a note on why the standard library or an existing one won't do. The app has no backend and no cloud AI, and it would like to keep both records.

## Reporting a bug

Open an issue with the platform (Android version or browser), what you expected, what happened, and whether the screen was showing stale or empty data — that last one is its own class of bug here.

## License

By contributing you agree your work is licensed under the MIT license in [`LICENSE`](LICENSE).
