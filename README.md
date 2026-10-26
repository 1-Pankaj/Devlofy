# Devlofy

**The offline-first command center for solo developers.** Plan your day, run your clients, ship your projects, get paid, and watch it grow — with a 3D focus garden for the time you actually spend.

All data lives on your device. No account, no backend, no cloud AI, no telemetry. Local SQLite is the product.

Targets: **Android native (phones and tablets) and web**, as equal partners. iOS comes later; the code stays iOS-safe in the meantime. Desktop mode ships from day one — expanded widths get a side rail, compact widths keep the floating tab bar.

## What's in it — v0.8

| Screen | What it does |
|---|---|
| **Today** | Greeting, one live focus session, streak strip, today's tasks. Quick-add reads `!3` (priority), `45m` (estimate), `tomorrow` (due) and `#Project`, and the preview chips state exactly what will be created before you commit |
| **Garden** | A 3D tree that grows from your real focus data — Blender-authored GLBs, with a code-authored prop kit behind them so the clearing is never empty |
| **Work** | Projects and milestones, clients, rates → billable blocks → an invoice draft you can copy. Money is a view over the session log, never a stored document |
| **Engine** | No model, no network: pure functions over your own rows for what to do next (every score carries a reason the UI shows), when you actually work, and how far your estimates drift |
| **Notes** | Blocks that are a view over the markdown lines already on disk — markdown input rules, `[[wikilinks]]` with backlinks, to-dos that become real tasks, focus-on-this-note |
| **Bench** | The offline dev toolbox: JSON, SQL, Diff, Regex, Text, Encode, JWT, Hash, Epoch, Cron, Colour. Eleven tools that compute as you type; your tokens, configs and diffs never leave the device |
| **Sentinel** | Is anything of mine down? Status, latency, incidents and uptime over the URLs you own. Checks run when you look, never on a timer — and a browser run says *reachable*, never "up" |
| **GitHub** | Two-way but branch-bounded: browse and edit files, commit to a branch (never the default one), review, merge, triage issues, watch Actions, read the inbox |
| **Search** | One search over projects, clients, notes, tasks and watch targets — plus the Bench tools, so `sha256` opens the tool. `⌘K` / `Ctrl-K` on web |
| **More** | Theme (System / Ink / Paper), desktop mode, data stats, and a full JSON export of everything you own |

Bench and Sentinel are reached as cards on the More shelf rather than extra tabs, and Sentinel's standing also surfaces as a strip on Today.

## Run it

Node 22+ and Expo SDK 58.

```bash
npm install
npx expo start        # then: a → Android, w → web
```

The web build runs SQLite as wasm, which needs cross-origin isolation. The dev server sets COOP/COEP itself; `app.json` carries the same headers for deployment. Details in [`docs/03-architecture.md`](docs/03-architecture.md).

## Checks

```bash
npm run check                    # typecheck + lint + the three known-answer suites (360 checks)
npx expo export --platform web   # the full web bundle (validates wasm and the 3D runtime)
```

`npm run check` is what CI runs, and it must be clean before any commit. The pure modules are verified by known-answer checks that live beside them rather than by a test runner — hashes against published vectors, RFC semantics for base64/URL/JWT, every Sentinel verdict, and every block edit Notes can make. Recipe: [`docs/03-architecture.md`](docs/03-architecture.md#checking-the-pure-modules-without-a-test-runner).

## Stack

Expo SDK 58 · React 19 · expo-router · expo-sqlite (native SQLite, wasm + OPFS on web) · three + react-three-fiber (expo-gl on native, WebGL on web) · reanimated 4 · zustand · Phosphor icons · Geist + Space Grotesk + JetBrains Mono.

## Documentation

Everything lives in [`docs/`](docs/index.md) — an Obsidian vault, so `[[wikilinks]]` render as a graph:

- [Vision](docs/01-vision.md) · [Scope](docs/02-scope.md) · [Architecture](docs/03-architecture.md)
- [Design language](docs/04-design-language.md) · [Blender pipeline](docs/05-blender-pipeline.md)
- [Data model](docs/06-data-model.md) · [Decision log](docs/07-decisions.md) · [Backlog](docs/08-backlog.md)

The decision log is the interesting one: it records *why* the app has no backend, why a focus block is a session row, and why a GitHub write is bounded to a branch.

## Contributing

Read [`AGENTS.md`](AGENTS.md) first — it is the contributor guide, and it is enforced in review: tokens only, platform code behind adapters, motion that never overshoots, a failed read is never rendered as an empty one. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the short version and the commands.

## License

MIT — see [`LICENSE`](LICENSE). Third-party attributions: [`NOTICE`](NOTICE).
