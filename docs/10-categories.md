---
tags: [devlofy, roadmap, categories]
created: 2026-10-19
---

# Category candidates — the next big things

A **category** here means the same thing Garden means: a place in the app that is
not a list. It is derived from your own data, it is *visual* about it, and it gets
more valuable the longer you use the app. Today, Garden, Work, Notes, More are
categories. Anything below has to clear that bar or it is a feature, not a
category.

Two constraints decide the shelf they can live on:

- **Tab budget.** Compact gets five slots (Today · Garden · Work · Notes · More).
  A sixth category therefore either displaces one (the feature-budget rule,
  [[07-decisions]] ADR-001) or is reached from a shelf — most likely **More**,
  which would become the hub it already half is.
- **Platform tiers** decide *when* it can ship, not whether it is wanted
  ([[09-platform-ceiling]]): **A** = HTTPS + JSON, runs on Android *and* web in
  Expo Go today; **B** = sockets/exec/PTY, needs a development build and is
  Android-only; **C** = blocked by the OS.

Every category below is **Tier A** unless it says otherwise, and every one needs
an ADR before it ships (house rule).

## The recommendation, in order

| # | Category | Axis it fills | Effort | Ships in |
|---|---|---|---|---|
| 1 | **Bench** — the offline dev toolbox — **shipped v0.6** | tools | M | Expo Go + web |
| 2 | **Sentinel** — is production up? | the outside world | M | Expo Go (+ web caveat) |
| 3 | **Ledger** — the getting-paid loop | the business | M–L | Expo Go + web, offline |
| 4 | **Atelier** — your 3D asset library | the craft | M–L | Expo Go; web degrades |
| 5 | **Chronicle** — the timeline of everything | memory | M | Expo Go + web, offline |
| 6 | **Flow** — local automations | leverage | L | Expo Go; app-open only |

Deferred deliberately: **Deploy** (Vercel/Netlify/Cloudflare watching — a fine
pair to GitHub, but it is three more integrations), **Vault** (encrypted secrets
plus the `.devlofy` backup/restore that [[02-scope]] already calls mandatory),
and **Terminal/SSH** (Tier B — Android-only, impossible on web, and it needs the
transport spike in [[08-backlog]] first).

---

## 1 · Bench — the offline dev toolbox *(built · v0.6)*

**What it is.** A shelf of small, sharp, instant tools, each one a real screen.
The premium promise is the one a web tool cannot make: **the payload never leaves
the device** — your JWTs, tokens, configs and diffs are processed locally and
thrown away unless you save them.

**Why it is big.** Unlike a dashboard, it is used *every day, several times a
day*, and it is the honest answer to "Termux-like utility belt" without shipping
a terminal ([[09-platform-ceiling]]). It is also the cheapest big thing on this
list, because Phase A left us the hard parts: `src/lib/highlight.ts` (our own
tokenizer, already colour-driven from `src/theme`), `src/lib/diff.ts` (the diff
engine, plus `src/lib/bench/patch.ts` to write a patch back out), and
`src/lib/base64.ts`.

**What shipped** (v0.6, offline, no new dependency) — eleven tools, grouped
*data · text · security · time · design*, each computing as you type:

| Tool | Reuses |
|---|---|
| JSON: format / minify / sort keys / types + stats, with the app's own error locator | `highlight.ts` |
| SQL formatter (dialect-aware, keyword casing) | — |
| Diff: two texts or a paste-able unified patch | `diff.ts`, `bench/patch.ts`, `diff-view.tsx` |
| Regex tester: live match highlighting, groups, replace preview, recipes | `highlight.ts` |
| Text stats (words, characters, bytes, reading time) + nine case conversions | — |
| Base64 / URL / HTML-entity / hex encode-decode, with byte previews | `base64.ts` |
| JWT decoder: header / claims, expiry in words, **and never verified — said out loud** | `base64.ts`, `bench/jwt.ts` |
| Hash: SHA-1 / SHA-256 against an expected digest · Epoch: parse + format + now | `bench/hash.ts` |
| Cron: a full parser that says the schedule in words and the next five runs | — |
| Colour: hex/rgb/hsl, WCAG contrast grades, a tonal ramp with per-step ratios | `src/theme` |

**Cut on purpose, not shipped:** **YAML / TOML / XML** pretty-printing (a
half-parser that is wrong on real documents is worse than no tool, and the app
ships no parser dependency) and a **timestamp/ID/slug scratchpad** (the parts
worth having are covered by Epoch, Hash and Encode). The original estimate of
"~14 tools" was trimmed to eleven that each do one thing correctly: **realism,
not padding** ([[07-decisions]] ADR-021).

**Shape.** `src/app/bench/index.tsx` is the shelf (grouped by kind: *data*,
*text*, *security*, *time*, *design*, plus a filtered search and the kept-snippets row);
`src/app/bench/[tool].tsx` is one host that renders the chosen tool, so adding a
tool is one entry in `src/lib/bench/tools.ts` plus one component in
`src/components/bench/`. Pure logic lives in `src/lib/bench/*`, covered by
**eighty known-answer checks** in `src/lib/bench/self-check.ts` — run under Node
against emitted JS, no test runner ([[03-architecture]]).

**Data.** Snippets are *your content*, so they belong in SQLite, not KV:
**migration v3** adds `bench_snippets` (id, tool, title, body, language,
created_at, updated_at, deleted_at) — [[06-data-model]] carries it, `exportAll()`
carries it, and opening a snippet **re-opens it in the tool that made it**. There
is no recent-input history stored anywhere: the tools are stateless by design.

**Explicitly not in v1:** the HTTP/API client (saved requests + environments),
because it needs the credential store, a network path, and an honest story about
CORS on web — that is Bench's *second* release, not its first ([[08-backlog]]).

**Open question — answered: a shelf inside More, not a sixth tab.** A tab is a
place the app's day runs through; Bench is a place you visit with an errand, and
sixth-tab real estate would have demoted one of the five that already work. The
tab bar is unchanged; More gains an `offline` section whose row says exactly what
Bench is ("11 tools that run on this device — nothing is uploaded").

---

## 2 · Sentinel — is production up?

**What it is.** You register the URLs you actually own, and the app watches them:
status, latency, "three failures in a row is an incident", maintenance windows,
uptime %, a sparkline per site, and an incident timeline — all stored locally, so
the history is yours and needs no account.

**Why it is big.** It collapses a whole SaaS category (Pingdom, Better Stack) into
one offline-first board, and it is the most Garden-like idea here: a living board
that is worth more every week you keep it. It also fits this user exactly — a
dozen client sites and counting.

**The honest caveat, designed around rather than hidden.** Browsers cannot read
another origin's status (CORS), so on **web** a check can only prove *reachable /
not reachable + how long it took*; **native** — what the tablet runs — gets real
status codes, headers and bodies. The screen says which one it is showing.

**Screens.** `/sentinel` (the board: worst first, not alphabetical), a site's
detail (latency chart, incident log, uptime for 24h/7d/30d), and an add/edit
form. Optional badge on the tab when something is down.

**Data.** New tables (`watch_sites`, `watch_checks`) — this *is* user content:
your targets and your history, queryable, prunable, exportable. Migration + data
model update.

**Not in v1:** TLS expiry (needs the handshake, not `fetch`), DNS, and anything
that requires being always-on — checks run when you open the board, with the
timestamp shown, exactly like GitHub's dated snapshot.

---

## 3 · Ledger — the getting-paid loop

**What it is.** Three connected surfaces over data that already exists:
a **retro** (this week/month vs last: what shipped from commits/PRs/releases,
time split per client, estimate drift, invoice value, what stalled, one-tap
carry-over), a **scope → proposal** generator (tasks + estimates × rates =
phased proposal you can copy or share), and an **invoice proper** (numbering,
draft/sent, PDF on web / share on Android).

**Why it is big.** It closes focus → billable → proposal → invoice, and it is the
most *sellable* screen in the app: a report that looks like something you would
pay for, built from local data with no backend.

**Data.** Mostly views (ADR-017: invoices are views, not documents) plus one new
table for proposal/invoice *documents* when numbering is real.

**Note.** The retro overlaps the "weekly review ritual" already in [[02-scope]],
which means it can absorb a v1 line instead of adding one.

---

## 4 · Atelier — your 3D asset library

**What it is.** A browsable shelf of the models and textures *you* made, with a
live 3D preview, polycount, tags, and "which build used it".

**Why it is big.** It is the closest thing to Garden in character — visual,
personal, compounding — and it plugs into the Blender MCP pipeline already in the
repo ([[05-blender-pipeline]]).

**Honest constraints.** Assets are binaries, so they belong on the filesystem
(`expo-file-system` + document picker), not SQLite; web degrades to a
metadata-only view. And **no new Blender art can be authored in this
environment**: the gardening library that exists (5 growth stages + 11 props) is
what we have, and anything new would be code-authored geometry or a flagged
blocker for a desktop Blender session.

---

## 5 · Chronicle — the timeline of everything

**What it is.** One scrubbable, filterable history: sessions, tasks completed,
commits, notes, releases, invoices — "what was I doing on the 3rd?" answered in
one screen.

**Why it is big.** It turns a set of screens into a story, and it is cheap: it is
almost entirely views over tables that already exist. Very Garden in feel
(a record of *you*, not a list of records).

**Data.** None new — a read model over existing tables (which also makes it the
best candidate for the app's first real export).

---

## 6 · Flow — local automations

**What it is.** "When a block ends → log a note." "When a check goes red → create
a task with a block and an estimate." "When an invoice is overdue → tell me."
Rules you can see, edit, and dry-run, with a visible *what it did* log.

**Why it is big.** It is the Engine extended from *suggesting* to *acting*, which
is the difference between an app and a system.

**Honest constraint.** With no backend, rules run **while the app is open** (web
has no background at all; Android can poll via `expo-background-task`, Tier A but
a separate step). The UI must say that out loud or it feels broken. This is the
largest build on the list, which is why it is last.

---

## Decided against (so it is on the record)

- **A local shell / Termux-in-app** — Tier C, blocked by Android's W^X since API
  29 ([[09-platform-ceiling]]). Unchanged by anything here.
- **A chat assistant** — ADR-002; "intelligence" in this app means algorithms.
- **A second snippet store in the cloud** — that was the gists idea, dropped in
  v0.5 for the same reason it would be dropped here: snippets are local content
  now, and Bench gives them a home.
