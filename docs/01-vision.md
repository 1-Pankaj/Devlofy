---
tags: [devlofy, vision]
created: 2026-10-17
---

# Vision

## What it is

Devlofy is a **personal super-app for a solo developer**: Notion-like notes, CRM-style clients, project timelines, time tracking, learning, and a Forest-style focus experience with a 3D garden — all in one app, all **offline-first**.

It is not a team tool, not a SaaS dashboard, and not another "AI wrapper". It is the tool its builder uses every day.

## The honest promise

> All your data always lives on your phone. Live integrations work when online and degrade gracefully with last-synced state.

- **No backend.** Local SQLite is the whole product. Export/backup is a v1 feature, not a rescue plan.
- **No cloud AI.** Intelligence is local: rules, scoring, spaced repetition, text algorithms. If on-device models arrive later, they arrive as "the Engine" — never a chat.
- **No account.** The app boots into your data.

## The wedge

> "Bonsai can't see your git and can't work on a plane — Devlofy can."

Existing tools each hold one slice: Notion (notes), Harvest (time), Bonsai (clients), Forest (focus). None of them know your git, and none of them work offline on a plane. Devlofy is the one place where a solo dev's day actually lives.

## Who it's for

The builder first: a solo developer doing **client work + game development** (working under **Codeloom**). Personal-first, scale later. Every feature must be something the builder touches weekly.

## Principles

1. **Data gravity stays local.** Features either work offline or degrade visibly and gracefully.
2. **The day is the entry point.** Open the app → see today → act.
3. **Growth over guilt.** The garden rewards consistency; it never scolds (no dead-plant punishment, no red numbers).
4. **Feature budget.** Every new feature displaces one or goes to [[08-backlog]]. (See [[07-decisions]], ADR-001.)
5. **3D is a vibe layer, never a gate.** If the GPU is weak or the context is wrong, the app is fully usable in 2D.
6. **Native feel, global reach.** One codebase: Android-first native feel, web-stable, iOS-ready.
