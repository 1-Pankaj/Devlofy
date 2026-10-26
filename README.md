# Devlofy

[![MIT license](https://img.shields.io/badge/license-MIT-4B5AA0)](LICENSE)
[![release](https://img.shields.io/github/v/release/1-Pankaj/Devlofy?color=4B5AA0)](https://github.com/1-Pankaj/Devlofy/releases)
![platforms](https://img.shields.io/badge/platforms-Android%20%7C%20web-4B5AA0)

**The offline-first command center for solo developers.** One app for tasks, focus time, client work, invoices and markdown notes. All data stays in a local SQLite database on your device.

No account, no backend, no cloud AI, no telemetry. Android and web are equal targets. iOS is planned. Current version: 0.8.

## Features

| Screen | What it does |
| --- | --- |
| **Today** | Daily task list, one running focus timer, streaks, and a quick-add box that understands `!3`, `45m`, `tomorrow` and `#Project` |
| **Garden** | A 3D tree that grows from your real focus time. Blender models plus a code-built prop kit, so it renders on any device |
| **Work** | Projects, milestones, clients, hourly rates, billable time, and an invoice draft you can copy |
| **Notes** | Markdown notes in blocks, with `[[wikilinks]]`, backlinks, tickable to-dos, and to-dos that become real tasks |
| **Bench** | 11 offline developer tools: JSON, SQL, Diff, Regex, Text, Encode, JWT, Hash, Epoch, Cron and Colour |
| **Sentinel** | Uptime and latency checks for your own URLs, with incidents and history stored locally |
| **GitHub** | Read notifications, issues and pull requests; edit files, commit to a branch, review and merge |
| **Search** | One search across projects, clients, notes, tasks, watched sites and Bench tools (`Ctrl/Cmd + K` on web) |
| **Engine** | Local rules that suggest what to do next, when you usually work, and how far your estimates drift |

Bench and Sentinel open from cards in **More**, not from extra tabs. Desktop mode is built in: wide screens get a side rail, phones keep the bottom tab bar.

## Requirements

- Node.js 22 or newer
- npm
- Android for the native app (Expo Go or a development build), or a modern browser with WebAssembly support for web

## Getting started

```bash
git clone https://github.com/1-Pankaj/Devlofy.git
cd Devlofy
npm install
npx expo start
```

Then press `a` to open Android, or `w` to open web.

The web build runs SQLite as WebAssembly, which needs cross-origin isolation. The dev server sets the COOP and COEP headers for you; `app.json` has the same headers for deployment. More detail in [docs/03-architecture.md](docs/03-architecture.md).

## Checks

```bash
npm run check                    # typecheck, lint, and 482 known-answer checks
npx expo export --platform web   # full web build, validates wasm and 3D
```

`npm run check` must pass before any commit. It runs `tsc --noEmit`, `eslint .`, and four small test suites that live next to the code they test.

## Tech stack

- Expo SDK 58, React 19, React Native 0.88, TypeScript
- expo-router for navigation, expo-sqlite for storage (SQLite on native, wasm + OPFS on web)
- three.js and react-three-fiber for the garden, expo-gl on native and WebGL on web
- Reanimated 4 for motion, Zustand for small state, Phosphor for icons

## Project structure

```
src/app/          screens and navigators (file-based routes)
src/components/   UI, grouped by feature; ui/ holds shared components
src/lib/          app logic: db, engine, notes, bench, sentinel, github, garden, three
src/theme/        design tokens (color, spacing, type, motion)
assets/models/    Blender GLB files
docs/             full documentation, decisions and roadmap
tools/            Blender scripts, 3D preview renderer, check runner
```

## Data and privacy

- Everything you create stays in SQLite on the device. The JSON export in **More** dumps all of it.
- Two features use the network: GitHub (only when you connect an account) and Sentinel (only when you open the board or press check).
- A GitHub token is checked against GitHub before it is saved. It is kept out of the export file.
- The app has no analytics and no crash reporting service.

Security reporting instructions are in [SECURITY.md](SECURITY.md).

## Documentation

The full docs are in [`docs/`](docs/index.md), written as an Obsidian vault:

- [Vision](docs/01-vision.md), [Scope](docs/02-scope.md), [Architecture](docs/03-architecture.md)
- [Design language](docs/04-design-language.md), [Blender pipeline](docs/05-blender-pipeline.md)
- [Data model](docs/06-data-model.md), [Decision log](docs/07-decisions.md), [Backlog](docs/08-backlog.md)

The decision log explains why the app has no backend, how focus sessions are stored, and why GitHub writes are limited to branches.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Bug reports use the issue form; security issues go through [SECURITY.md](SECURITY.md), never a public issue.

## License

MIT. See [LICENSE](LICENSE). Third-party credits are in [NOTICE](NOTICE).

## FAQ

**Is there a server or an account?**
No. There is no backend, no sign-in, and no sync service. Data is local, and the JSON export is the backup.

**Does it work offline?**
Yes. Only GitHub and Sentinel make network requests, and both need you to open them first.

**Which platforms are supported?**
Android (phones and tablets) and the web. iOS is planned; the code is kept iOS-safe in the meantime.

**Does it use AI?**
No. The "Engine" that suggests what to do next is a fixed set of local rules over your own data, and it shows the reason for every suggestion.

**How do I back up my data?**
Open **More**, then **Export**. It writes a JSON file with every table the app owns.
