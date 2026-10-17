# Devlofy — agent guide

This is **Devlofy**, an offline-first command center for solo developers (Expo/React Native + web). Read this before any task.

## Product context (short)

- Personal-first app; user does client work + game dev under "Codeloom".
- **No backend, no cloud AI.** Local SQLite is the product. Intelligence = local rules/algorithms ("the Engine"), never a chat.
- Platforms: **Android native (primary, tablets included) + web (equal partner)**. iOS is later — keep code iOS-safe but don't build UI hunting for it.
- **Desktop mode is core scope**: expanded widths (≥840) get a side rail; compact gets the floating tab bar.
- **3D day one**: procedural garden now; Blender-authored GLBs layer in via the live Blender MCP (`get_addon_status` first).
- Docs vault: `docs/` (wikilinks, Obsidian). Decision log: `docs/07-decisions.md` — read it before proposing architecture changes. Feature budget rule applies: new feature displaces one or goes to `docs/08-backlog.md`.

## Verify before writing API code

Expo changes every SDK. This project is **SDK 58** (react 19.3, RN 0.88, reanimated 4.7). Before touching Expo/RN APIs: read the major version in `package.json`, fetch `https://docs.expo.dev/versions/v58.0.0/`, and for anything else use `https://docs.expo.dev/llms.txt`. Never answer from memory.

## Commands

```bash
npx expo start                 # dev server (a=Android, w=web)
npx expo install <package>     # ALWAYS for deps — resolves SDK versions
npx tsc --noEmit               # typecheck — must be clean
npx eslint .                   # lint — must be clean
npx expo export --platform web # validates the full web bundle (wasm, r3f)
npx expo-doctor
```

Run **lint + typecheck before declaring any task done.** If a task touches UI, sanity-check the rules in `docs/04-design-language.md`.

## Architecture rules

- Routes only in `src/app/` (`_layout.tsx` = navigators). Everything else lives outside.
- **Adapters**: platform code is `x.ts` (type anchor) + `x.native.ts` + `x.web.ts`. Core never imports a platform-only lib. The 3D shim is `src/lib/three`.
- **Tokens only**: colors/spacing/type/motion come from `src/theme` — no hardcoded values in components.
- **Data**: all SQL lives in `src/lib/db/repo.ts`; screens use `useLiveQuery`. Migrations are append-only in `src/lib/db/migrations.ts` (update `docs/06-data-model.md` in the same change).
- **Reanimated 4 (compiler-safe)**: shared values use `.get()`/`.set()`; no `runOnJS` (use `scheduleOnRN`); press feedback via `PressableScale`; entrances via `FadeUp`; tokens from `theme/motion`.
- **Web SQLite**: wasm in `metro.config.js` assetExts + COOP/COEP headers (dev: metro middleware; deploy: `app.json` headers / host config). FTS5 is native-only — guard capability.
- Motion manners: haptics for selection/commits (never web), tab switches don't animate, respect reduced motion.

## Skills & tooling installed

- `.agents/skills/` — Expo official skills (expo-overview, expo-design-system, expo-native-ui, expo-animation, expo-router, expo-ui, expo-sqlite, …) and taste skills (high-end-visual-design, design-taste-frontend, minimal ui variants). **Load the matching skill before big UI/DB/navigation work.**
- `graphify` — `graphify update .` rebuilds the code graph (`graphify-out/`); `graphify export obsidian` emits vault notes. Re-run after large refactors.
- Blender MCP — check `get_addon_status`; author models in-session; follow `docs/05-blender-pipeline.md` (GLB, Y-up, low-poly, base origin).

## Conventions

- Files kebab-case; components `PascalCase` inside; hooks `use-*`.
- Icons: Phosphor (`weight="light"|"regular"|"fill"`), never emoji.
- Every screen handles loading / error / empty / ready.
- Every control does something; non-actionable rows are not pressable.
- One accent (sprout green) action per screen; ember is for focus/time only.

## Expo specifics (still apply)

- If `ios/`/`android/` don't exist they're generated — never hand-edit native folders; configure via `app.json` + config plugins.
- After adding native-code deps, a development build is needed: `npx expo run:android` or `eas build --profile development`.
- Prefer official Expo modules; check skills before adding dependencies. EAS docs: https://docs.expo.dev/eas/index.md
