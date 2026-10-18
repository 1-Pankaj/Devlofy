---
tags: [devlofy, research]
created: 2026-10-18
---

# Platform ceiling — what Devlofy can become

> **Status: research, no decision taken.** Written 2026-10-18 in answer to a request for a *fully* two-way GitHub client (edit, commit, push, login), SSH, and a Termux-like terminal — "huge features, premium-worthy". Every claim below was checked against vendor documentation, a live API response, or a package's published README; anything unverified is marked **UNVERIFIED**. The ADRs come *after* a choice is made, not before.

## The one thing that decides every feature

Every request in that list falls into one of three tiers, and the tier — not the difficulty of the UI — decides whether it is buildable, where it runs, and what it costs.

| Tier | Needs | Runs on | Testing story | Cost |
|---|---|---|---|---|
| **A — HTTPS + JSON** | `fetch` only | Android **and web**, inside Expo Go | unchanged (tablet, Expo Go) | often zero new dependencies |
| **B — raw sockets / `exec` / a PTY** | a native module | Android only, in a **development build** | you must stop testing in Expo Go; install a dev build once, JS still hot-reloads | a real milestone: EAS Build (or `expo run:android`) |
| **C — a Linux userland on the device** | `execve` from writable storage | **blocked by the OS** (see below) | — | not worth it at any price |

The important consequence: **the GitHub request is Tier A in its entirety, including writes.** Nothing about "editing, committing and pushing" needs a native module. SSH and the terminal are Tier B, and they are the *only* reason this app would ever have to leave Expo Go. A Termux clone is Tier C and is the one item on the list that is a hard no.

## Tier A · the whole of GitHub, in both directions

All of it is HTTPS + JSON against `api.github.com`, which **does** send CORS headers — so web keeps parity, unlike every Tier B feature. These are the exact endpoints and the scopes they need (verified against `docs.github.com`):

| Capability | Endpoint | Classic scope | Fine-grained |
|---|---|---|---|
| Browse a repo tree / read a file | `GET /repos/{o}/{r}/contents/{path}`, `/git/trees/{sha}?recursive=1` | `repo` (public: none) | Contents:read |
| **Edit a file and commit it** | `PUT /repos/{o}/{r}/contents/{path}` (`sha` required to update) | `repo` | Contents:write |
| **Commit many files atomically** | blobs → trees → commits → `PATCH /git/refs/heads/{branch}` | `repo` | Contents:write |
| Branch / delete / compare | `POST|DELETE /git/refs`, `GET /compare/{base}...{head}` | `repo` | Contents:write / read |
| **Create a pull request** | `POST /repos/{o}/{r}/pulls` | `repo` | Pull requests:write |
| Request reviewers | `POST /pulls/{n}/requested_reviewers` | `repo` | Pull requests:write |
| **Review it** (approve / request changes / comment) | `POST /pulls/{n}/reviews` (`event=APPROVE|REQUEST_CHANGES|COMMENT`) | `repo` | Pull requests:write |
| **Merge it** (merge / squash / rebase) | `PUT /pulls/{n}/merge` | `repo` | Pull requests:write |
| Mark ready for review (un-draft) | GraphQL `markPullRequestReadyForReview` | `repo` | Pull requests:write |
| Issues: create / label / assign / comment / close | `POST|PATCH /repos/{o}/{r}/issues[/{n}][/labels|/assignees|/comments]` | `repo` | Issues:write |
| **CI: trigger / re-run / cancel** | `POST /actions/workflows/{id}/dispatches`, `/runs/{id}/rerun`, `/runs/{id}/cancel` | `repo` | Actions:write |
| CI logs | `GET /actions/runs/{id}/logs` → 302 to a ZIP that expires in ~60 s | `repo` | Actions:read |
| Releases, incl. generated notes | `POST /repos/{o}/{r}/releases` | `repo` | Contents:write |
| Gists (a personal snippet store) | `POST /gists`, `PATCH /gists/{id}` | `gist` | Gists:write |
| Notifications inbox | `GET /notifications`, `PATCH /notifications` | `notifications` — **classic only** | not supported |
| Search (code / issues / repos) | `GET /search/*` | `repo` | Metadata:read |

**What "pushing" honestly means.** A commit written through the Git Data API *is* a push — it moves the ref. What you do **not** get is a working tree: no local clone, no rebase, no submodules, no LFS, no `git` binary. So the truthful product is *read any file, edit it, commit to a branch, open a pull request, review it, merge it* — which is the whole of normal solo-dev GitHub work, minus local git.

**What is impossible even in Tier A.** Creating check runs (GitHub App only — a user token posts *commit statuses* instead), Copilot, Git LFS, anything in the org-admin/billing surface, and (with a fine-grained token) notifications plus multi-owner access.

**The limits that would bite a mobile client** (and the reasons to design around them): 5 000 requests/hour authenticated, **30/min on search and 10/min on code search** (so never poll search for "what needs me" — use `/notifications`, or conditional `GET`s, where a `304` costs no quota), 1 MB for JSON file contents (larger files need the Git Data blobs path), `409` when a commit is based on a stale `sha`, and `mergeable: null` on a fresh PR (re-`GET` before offering a Merge button).

**One principle has to be overturned, deliberately.** [[07-decisions]] ADR-019 says GitHub is *read-only*, on the grounds that "a dashboard should not be able to break the thing it reports on." Writing reverses that. It is worth reversing — but only with a design that keeps the original promise intact:

- the default action is **never to `main`**: edit → new branch → PR, and pushing straight to the default branch becomes an explicit, confirmed choice;
- **every write shows its diff first**, and every write has a plain-language confirmation ("Commit to `fix/login-copy` — 1 file, +2 −3");
- **no force-push, no branch deletion, no merge conflict resolution** — if GitHub says `409` or `405`, the app shows the reason and stops;
- the app's own write scope is bounded: it can write **file contents and commits**, never settings, secrets, workflows-without-scope, or repository configuration.

That is a new ADR (020) whenever it is built.

## Tier A · notifications and background work (both verified)

Two Expo modules matter here, and both behave better than expected:

- **`expo-background-task`** is listed for Android/iOS **and Expo Go**, and is built on Android's `WorkManager` — so *polling GitHub while the app is closed works today, without leaving Expo Go*. Minimum interval 15 minutes on Android, system-decided on iOS; on web it always reports `Restricted`.
- **`expo-notifications`** is Android/iOS only (**no web at all**). Remote push needs a development build (Expo Go on Android lost remote push in SDK 53), but the docs are explicit that **local notifications still work in Expo Go**.

Together that is a premium feature available in the cheap tier: a background task notices *your check went red* or *a review was requested*, and posts a local notification — with no server, no push credentials, and no dev build. This is worth doing early because it is the first feature that makes Devlofy feel like it is *watching your back* while closed.

## Tier A · the offline toolbox (premium with zero dependency risk)

A section of pure-JS utilities runs on both platforms, offline, instantly, with no native code: an HTTP/API client with saved requests and environments (a solo dev's mini-Insomnia, and it reuses the credential store GitHub just gave us), JSON/YAML/TOML tools, a JWT decoder, a regex tester, a cron parser, a diff viewer, hash/UUID/base64, timestamp conversion, colour/contrast checks, and TLS-certificate expiry lookup. None of it needs the network except the last, and all of it is "fast on a tablet" by construction. This is the honest answer to "Termux-like utility belt" without the terminal — and it is where a dev-toolbox section earns its place in the app.

## Tier B · SSH

The transport is the hard part, and the current state of the ecosystem is genuinely thin:

| Option | State | Verdict |
|---|---|---|
| `react-native-ssh-sftp` | the well-known wrapper over libssh2/native code; **no npm release in over 12 months**, legacy-bridge era; community forks exist (`@dylankenneally/…`, `react-native-updated-ssh-sftp-client`) | New-Arch support **UNVERIFIED** — and this app is New-Arch-only, since RN 0.82 removed the opt-out (SDK 58 is RN 0.88). An unported native module is a hard stop, not a warning. |
| Pure-JS `ssh2` + a TCP socket module | `ssh2` is real but written for node's `net`/`crypto`; Hermes has neither. Would need `react-native-tcp-socket` (maintained, 396★; New-Arch support not stated in its README) plus crypto polyfills | **UNCERTAIN** — this is a spike, not a plan. Never promise it before proving it on the tablet. |
| Key generation | Ed25519 keygen and OpenSSH-format encoding are doable in **pure JS** | ✅ cheap, and the public key can be pushed to GitHub's `/user/keys` (a genuinely premium touch: "add this key to GitHub" in one tap) |
| Key storage | `expo-secure-store` (Android Keystore) is **in Expo Go** | ✅ — and this corrects ADR-019's deferral: token hardening does **not** need a dev build |
| Web | none possible — browsers cannot open raw TCP | ❌ SSH is Android-only forever |

Which is why an honest SSH feature is a **thin client to a server** (the heavy lifting happens on the remote box), not a local shell. If it ships, the valuable parts are: a saved host list, host-key verification on first connect, one-tap "open a shell on this project's server", and running the odd one-shot command (`git status`, `docker compose up -d`, `systemctl restart …`) — all with the block timer running, which is the one thing an off-the-shelf SSH app cannot do.

## Tier B · the terminal — the *view* is solved, the *transport* is not

A real terminal emulator in React Native now exists, which changes the answer from "no" to "not yet":

- **`expo-libghostty` 0.8.1** (MIT) renders via ghostty's actual VT core — Metal on iOS, a Canvas renderer over `libghostty-vt` on Android — with IME input, a keyboard accessory bar with sticky Ctrl/Alt, scrollback, and pinch-to-zoom. The published README is explicit that it is **bring-your-own-PTY**: *"the view only renders bytes and reports input/resizes — transport and session lifecycle stay on your side."* It also says **Expo SDK 57** (ours is 58 — needs a compatibility check), ships native libraries from a postinstall script (~50 MB on iOS), has ~750 weekly downloads and nine versions, and **does not support web**.
- The fallback view is **xterm.js inside `react-native-webview`** (webview *is* included in Expo Go) connected to the same native PTY bridge. Same transport problem, a heavier renderer.

So the terminal is Tier B end-to-end, and the terminal *view* is the easy half. A local shell would be `fork`/`exec` of `/system/bin/sh` as the app's own UID: you would get toybox (`ls`, `cat`, `grep`, `sed`, `vi`…) and **no package manager** — as a native module, in a dev build, Android-only, with the renderer above. Compared with the Termux already installed on the tablet, that is a worse terminal in a prettier frame.

**The honest recommendation:** if a terminal is built, make it **remote-only** (SSH), theme it from `src/theme` so it looks like Devlofy rather than another black rectangle, and keep the local-shell idea dead. The unique value is not "a shell" — it is "a shell on *this project's* server, started from the same screen that is billing the time."

## Tier C · why a Termux clone inside Devlofy is a no

This is a platform fact, not a preference. Since **Android 10 (API 29)** an app may no longer `execve()` a file in its own writable data directory — the W^X rule that stops an app from writing and then executing code (`termux/termux-app#1072`, Google issue 128554619). Executables must live in the APK's native library directory, which the installer keeps read-only and executable.

That is precisely why Termux works the way it does: it ships its **entire userland inside its APK** (in `jniLibs`) plus its own `$PREFIX` and an apt repository. To reproduce "Termux" inside Devlofy you would bake a distribution into the APK, and for a Linux rootfs with `apt` you would add **proot + a rootfs image** on top — hundreds of megabytes, slow first-run extraction, and a permanent tax on the "fast on a tablet, offline-first" promise — in an app that would then duplicate the Termux the user already has on the same device.

Verdict: **no.** If a real Linux userland is a goal, it is a Termux concern, not a Devlofy one.

## Where the value actually is

Ranked by (value to a solo dev) ÷ (platform risk), the order is not the order the request came in:

1. **GitHub, the other half (Tier A).** Make it two-way: browse and read any file with real syntax highlighting, edit, commit to a branch, open and review and merge a PR, triage issues, control and watch CI, releases on generated notes, gists, a notification inbox. Then **stop it being a separate screen**: bind a repo to a project so the project page shows *its* open PRs and *its* CI — which is the thing no GitHub client does, because it means knowing what the code is *for*.
2. **The loop nobody else closes (Tier A).** A failed check becomes a task in Today with a focus block and an estimate; a merged PR becomes an invoice line ("PR #42 · auth fix · 3 h 20 m × ₹1 200"); your commit activity feeds the rhythm heatmap, and the Garden grows on a merged PR. That is *plan → focus → track → bill → ship → grow* in one place — the actual moat, and it is all Tier A.
3. **Watching your back while closed (Tier A).** Background CI/review polling plus a local notification, in Expo Go.
4. **The offline toolbox (Tier A).** The HTTP client, the JSON/JWT/regex/cron/diff set, the snippet vault.
5. **Connect (Tier B, dev build, Android only).** SSH hosts and keys, a remote shell, SFTP, and the Devlofy-themed terminal — gated behind a **spike that proves the transport** before any of it is promised.

Items 1–4 need **no new native dependency**; item 5 needs `expo-dev-client` and a decision to leave Expo Go, and it permanently breaks web parity on those screens.

## What is not doable, stated plainly

- A real git client: no clone, no working tree, no rebase/merge tooling, no LFS, no submodules. Commits via the API, or nothing.
- An IDE: no language servers, no build toolchains, no debugger. Editing is for real but *scoped* — small and medium changes, review comments, config, docs. Writing an app in it is not a use case.
- SSH or a terminal in a browser, ever.
- Background tasks or notifications on web.
- A Termux-class environment on-device without baking a distribution into the APK.
- Check runs, Copilot, org admin, billing.
- Anything server-side: no relay, no proxy, no push service of our own (ADR-002). EAS Build is a *build* service used by the developer, not a runtime dependency of the app — the distinction matters and is worth stating in any ADR.
