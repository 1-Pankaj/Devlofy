# Devlofy

**The offline-first command center for solo developers.** Plan your day, run your clients, ship your projects, get paid, and level up — with a 3D focus garden for the time you actually spend.

All data lives on your device. No account, no backend, no cloud AI.

## Status — v0.1 foundation

| Screen | What works today |
|---|---|
| **Today** | Greeting, live focus session timer, streak strip, today's tasks, craft tip |
| **Garden** | Procedural 3D tree that grows from your real focus data + session history |
| **Work** | Projects with progress, project detail (milestones + tasks), clients, create flows |
| **Notes** | Search, pinned notes, autosaving editor |
| **More** | Name, theme (System/Ink/Paper), **desktop mode**, data stats, JSON export |

Targets: **Android (native, phones + tablets)** and **web** — equally. iOS comes later.
Desktop mode is built in: expanded widths (tablets, wide web) get a side-rail layout automatically.

## Run it

```bash
npm install
npx expo start        # then: a → Android, w → web
```

Checks that must pass before any commit:

```bash
npx tsc --noEmit
npx eslint .
```

## Stack

Expo SDK 58 · React 19 · expo-router · expo-sqlite (native SQLite / wasm+OPFS on web) · three + react-three-fiber (expo-gl native / WebGL web) · reanimated 4 · zustand · Phosphor icons · Geist + Space Grotesk + JetBrains Mono.

## Documentation

Everything lives in [`docs/`](docs/index.md) — an Obsidian vault:

- [Vision](docs/01-vision.md) · [Scope](docs/02-scope.md) · [Architecture](docs/03-architecture.md)
- [Design language](docs/04-design-language.md) · [Blender pipeline](docs/05-blender-pipeline.md)
- [Data model](docs/06-data-model.md) · [Decision log](docs/07-decisions.md) · [Backlog](docs/08-backlog.md)

## 3D

The garden renders Blender-authored GLBs (sprout/sapling/canopy, authored through the live Blender MCP) with a procedural fallback (`src/lib/garden/model.ts` → `src/lib/garden/models.ts`, see `docs/05-blender-pipeline.md`). One scene, two runtimes: `src/lib/three` resolves the native expo-gl renderer or the web renderer per platform.

## Project rules

- Lint + typecheck clean before "done".
- Tokens only: no hardcoded colors/spacing outside `src/theme/`.
- Platform-specific code uses adapter files (`feature.native.ts` / `feature.web.ts`).
- Feature budget: every new feature displaces one or goes to the backlog.
