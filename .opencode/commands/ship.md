---
description: Verify, update the ledger, commit and push — one confirmation, never force
---

Prepare a release commit for $ARGUMENTS (empty means: whatever is uncommitted).

1. Read the current facts:

!`loom ship --prepare`

2. Run `loom check`. If it fails, stop and fix nothing outside the failure.

3. If the change is user-visible, update the release ledger in
   `docs/08-backlog.md` and any document the change made wrong. Keep doc edits
   to what actually changed.

4. Propose one commit message in the house style: `area: what changed` on the
   subject line, and a body that says *why* when it is not obvious. Show me the
   message and the file list, then stop and wait for my yes.

5. Only after I say yes, run:

   `loom ship --yes -m "<subject>" -m "<body>"`

Never force-push, never amend an existing commit, never push a tag.
