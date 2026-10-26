# Contributing

Thanks for taking a look. Devlofy is a small, opinionated app, so the fastest way to get a change merged is to follow the rules it already uses.

## Read first

- [AGENTS.md](AGENTS.md): product context, architecture rules, and the style reviews check.
- [docs/07-decisions.md](docs/07-decisions.md): why the app is built this way. If your change contradicts a decision, say so in the pull request and explain why.

`opencode.json` points some agent tooling at `docs/handoffs/latest.md`. That file is gitignored on purpose (it is local session notes), so a missing file there is normal.

## Setup

```bash
git clone https://github.com/1-Pankaj/Devlofy.git
cd Devlofy
npm install
npx expo start
```

Use Node 22 or newer. When you add a package, use `npx expo install <package>` so Expo picks the version that matches the SDK.

## Before you push

```bash
npm run check
```

This runs the type check, the linter, and 482 tests. Pull requests that fail it will not be merged.

If you change a pure module (`src/lib/bench`, `src/lib/notes`, `src/lib/sentinel`, `src/lib/engine`), add a case to that folder's `self-check.ts` for the bug you fixed.

If you change 3D geometry, also run the renderer. It checks the model rules and writes an image:

```bash
NODE_PATH=$PWD/node_modules node tools/preview/render.js
```

## Rules the app follows

- **Use design tokens.** Colors, spacing, text styles and motion values come from `src/theme/`. Do not hardcode them in components.
- **Platform code goes in adapters.** A feature is `x.ts` plus `x.native.ts` and `x.web.ts`. Shared code does not import a library that only works on one platform.
- **Handle all four states.** Loading, error, empty and ready. A failed read shows an error with a retry, not an empty screen.
- **No springs.** Motion uses a duration and one of the two curves in `theme/motion`. Nothing bounces.
- **SQL lives in `src/lib/db/repo.ts`.** Migrations are append-only, and `docs/06-data-model.md` is updated in the same change.
- **New tables go into `exportAll()`.** Users must be able to export every table the app creates.
- **One main button per screen.** The floating action button is the only filled action. Indigo is the brand color; amber is used only for time and focus.
- **Add one feature, remove one.** If the app does not lose something, the feature waits in [docs/08-backlog.md](docs/08-backlog.md).

## Pull requests

- One change per pull request.
- Say what you ran. `npm run check` passing is usually enough.
- For UI changes, add screenshots from Android and web, at a phone width and a wide width.
- New dependencies need a short note on why an existing one does not work. The app has no backend and no cloud AI, and it would like to keep it that way.

## Bugs

Open an issue with the form. Include your platform, the app version from **More**, and whether the screen was empty or showed an error. Those are different bugs in this app.

## License

By contributing, you agree that your work is licensed under the MIT license in [LICENSE](LICENSE).
