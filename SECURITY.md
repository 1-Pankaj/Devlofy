# Security policy

Devlofy runs on your device with no server and no account, so the list of things that can go wrong is short. This page covers which versions get fixes, how to report a problem, and what the app does about the obvious risks.

## Supported versions

Only the latest release on `master` gets fixes. Older versions do not receive patches.

| Version | Supported |
| --- | --- |
| 0.8.x | yes |
| older | no |

## Reporting a problem

Do not open a public issue for a security problem. Use GitHub private reporting: [Report a vulnerability](https://github.com/1-Pankaj/Devlofy/security/advisories/new). If that does not work, email **pankajisrani17@gmail.com** with `SECURITY` in the subject.

Please include:

- the platform (Android version, or browser and OS)
- the app version shown in **More**
- what you expected and what happened
- whether the problem survives a reinstall, if data is involved

This is a one-person project, so expect a reply within a few days. Please give reasonable time before publishing. Credit is offered in the changelog unless you prefer to stay anonymous.

## What is in scope

The app has one credential and two networked features. Most reports concern those.

### The GitHub token

A user's GitHub token is the only secret the app stores. It is checked against `GET /user` before it is saved, and it is kept in the app's key-value store: `expo-sqlite/kv-store` on native, `localStorage` on web. It is never written to the SQLite tables and never included in the JSON export.

We want to hear about:

- a token leaking into the export file, a log, a URL, the clipboard, or a share sheet
- a token shown on screen in any way
- a write that goes further than intended: a commit to the default branch, a forced ref update, a deleted branch or repository, or a commit that was never shown as a diff
- an out-of-date file version being ignored instead of reported as a conflict

### Sentinel checks

Sentinel sends requests to URLs the user enters, and only when the user opens the board or presses check. A URL returning an unexpected status is not a bug; that is what the feature reports. The browser cannot read cross-origin status codes, so web checks report "reachable", not "up".

We want to hear about:

- a redirect that leads to a `file:`, `javascript:`, or other non-HTTP scheme
- a response body or header that ends up being executed or rendered as markup
- storage growing without a limit (checks are trimmed to the newest 500 per site)

### Local data

- SQL injection through user input, including `LIKE` patterns that do not escape `%` and `_`
- script or markup injection through a note body
- the export writing outside the app folder, or leaving out a table the user owns
- a migration that loses or reorders rows

### Web build

The web build uses SQLite in WebAssembly and needs cross-origin isolation (COOP and COEP headers). We want to hear about any way for third-party content to reach the database or the key-value store.

## Out of scope

- a rooted or otherwise compromised device
- someone with physical access to an unlocked device (there is no app lock; it is on the backlog)
- broad permissions the user granted on GitHub itself
- rate limits, GitHub downtime, or a monitored site that is genuinely down
- problems in Expo, React Native or other dependencies that upstream has not fixed yet. Report those upstream, but tell us so we can pin the version.

## How the code handles common risks

- no `eval`, no `new Function`, no `dangerouslySetInnerHTML`, no shell commands from app code
- file paths are chosen by the app, not by user input
- no secrets in the repository. The GitHub client ID in `app.json` is a public identifier; device flow needs no client secret. The git history was scanned for tokens before the first public push.
- the app adds no test runner, no HTTP wrapper library and no extra state library

## Dependencies

`npm audit` reports high-severity advisories in transitive dependencies of the Expo CLI (for example `zod` and `node-forge`). The fix npm suggests is a downgrade to Expo SDK 44, which would break the project. These packages run at build time, not inside the shipped app. We track them and update when Expo updates.

## Credit

Reports that lead to a fix are credited in [CHANGELOG.md](CHANGELOG.md) and in the release notes, unless you ask us not to.
