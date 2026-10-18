/**
 * A unified diff, from text into the same shape our own diff produces.
 *
 * GitHub hands back a `patch` string per pull-request file, and our editor
 * produces a `LineDiff`. Both should look like the same thing on screen, and the
 * cheapest way to get there is to parse the patch into `DiffHunk`s rather than
 * write a second renderer. Line numbers are recovered from the `@@` header, so
 * the rows line up with what GitHub's own web view shows.
 *
 * Patches are truncated by GitHub for large diffs — the parser reads what is
 * there and stops at the first line it does not understand, which is exactly the
 * behaviour a diff view wants.
 */
import type { DiffHunk, DiffLine } from '@/lib/diff';

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parsePatch(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let beforeNo = 0;
  let afterNo = 0;

  for (const raw of patch.split('\n')) {
    const header = HUNK_HEADER.exec(raw);
    if (header) {
      beforeNo = Number(header[1]);
      afterNo = Number(header[2]);
      current = { beforeStart: beforeNo, afterStart: afterNo, lines: [] };
      hunks.push(current);
      continue;
    }

    if (!current) continue; // anything before the first `@@` is a file header

    const marker = raw[0];
    const text = raw.slice(1);

    if (raw.startsWith('\\')) {
      // "\ No newline at end of file" — true, and worth keeping.
      const lines: DiffLine[] = [
        { kind: 'context', text: raw, beforeNo: null, afterNo: null },
      ];
      current.lines.push(...lines);
      continue;
    }

    if (marker === '+') {
      current.lines.push({ kind: 'add', text, beforeNo: null, afterNo });
      afterNo += 1;
    } else if (marker === '-') {
      current.lines.push({ kind: 'remove', text, beforeNo, afterNo: null });
      beforeNo += 1;
    } else if (marker === ' ' || raw.length === 0) {
      current.lines.push({ kind: 'context', text, beforeNo, afterNo });
      beforeNo += 1;
      afterNo += 1;
    }
    // Anything else — a truncated patch, or a stray line — is ignored.
  }

  return hunks;
}
