# Security policy

Devlofy is local-first: there is no server, no account and no telemetry. That removes most of the attack surface a hosted product has, and it leaves a short, specific list of things that *can* go wrong. This file says what they are, which versions get fixes, and how to report one privately.

## Supported versions

The latest release on `master` is the only supported version. Fixes ship as a new release rather than as patches to old tags.

| Version | Supported |
|---|---|
| 0.8.x | ✅ |
| < 0.8 | ❌ |

## Reporting a vulnerability

**Do not open a public issue for a vulnerability.** Use GitHub's private reporting: [Security → Report a vulnerability](https://github.com/1-Pankaj/Devlofy/security/advisories/new). If that is unavailable, email **pankajisrani17@gmail.com** with `SECURITY` in the subject.

Please include the platform (Android version, or browser and OS), the version shown in the app's **More** screen, what you expected, what happened, and — if the issue involves data — whether it survives a reinstall. A reproduction is worth more than a severity guess.

You can expect an acknowledgement within a few days. This is a single-maintainer project, so please allow reasonable time before disclosure; credit in the release notes is offered unless you prefer otherwise.

## What is actually in scope

The app has exactly two networked features and one credential, and most of the threat model is about those.

**1. The GitHub token**

A user's GitHub token is the only secret the app ever holds. It is proved against `GET /user` before being stored, then kept in the app's KV store — `expo-sqlite/kv-store` on native, `localStorage` on web — never in the app's SQLite tables, and never in `exportAll()`'s JSON dump.

In scope:

- A path where the token reaches the export dump, a log, an intent extra, a clipboard write, or a URL
- A token rendered in the UI (screen, share text, error message, notification)
- A write path that exceeds the design: commits landing on the **default branch**, force-updating a ref, deleting a branch or repository, or a diff being committed without being shown first
- A stale blob `sha` being silently ignored instead of surfaced as GitHub's `409`

**2. Sentinel's probes**

Sentinel makes HTTP requests to URLs the user supplies, and only when the user opens the board or presses check. Out of scope by design: a URL that returns an unexpected status (that is the feature), and the browser's inability to read cross-origin status codes (documented, and labelled *reachable* rather than "up").

In scope:

- A probe that follows a redirect to `file:`, `javascript:` or another scheme
- A response body or header that is executed, injected into the UI, or rendered as markup
- Unbounded storage: checks are pruned to the newest 500 per target, and that bound failing

**3. Local data handling**

- SQL injection through a user-supplied string in any query (`LIKE` patterns must escape `%` and `_`)
- Notes' markdown and `[[wikilinks]]` rendering script or markup from a note body
- The JSON export writing somewhere it should not, or omitting a table the user owns
- A schema migration that loses or reorders existing rows

**4. Web build specifics**

The web build runs SQLite as wasm and requires cross-origin isolation (COOP/COEP). In scope: a way for third-party content to reach the database or the KV store, and any place where the app trusts `window` state a page could have set.

## Out of scope

- A rooted or compromised device — the app cannot defend a database from root, and neither can any other local-only app
- Physical access to an unlocked device (there is no app lock, by design — see the backlog)
- Abuse of a token the user has already granted broad scopes on GitHub itself; that is GitHub's permission model, not the app's
- Rate limits, GitHub API outages, or a target URL being genuinely down
- Vulnerabilities in Expo, React Native, or a dependency that the upstream project has not yet fixed — report those upstream, but do tell us so the version can be pinned

## How this project handles the obvious hazards

- **No `eval`**, no `new Function`, no `dangerouslySetInnerHTML`, no shelling out from app code
- **No arbitrary file paths** from user input: the app writes to app-private storage, and the only filenames it chooses are its own
- **No secrets in the repository**: the committed GitHub OAuth **client ID** is public by design (device flow never needs a client secret), and history was scanned for credentials before the first public push
- **No dependency without a reason**: the app ships no test runner, no network client wrapper and no state library beyond what the stack already had

## Acknowledgements

Thanks to everyone who reports responsibly. Fixes that come from a report are credited in [`CHANGELOG.md`](CHANGELOG.md) and the release notes.
