---
description: Run the verification gate (types, lint, self-checks) and fix only what it reports
---

Run `loom check` in the project.

If a check fails:

- fix only what the output names — no refactoring, renaming or tidying nearby;
- re-run `loom check` once after fixing;
- if the same failure survives two attempts, stop and show me the output instead
  of guessing.

Finish with three short lines: what failed, what you changed, and whether the
gate is green now. If this change touches routing or bundling, also run
`loom check --web`.
