/**
 * A unified diff, written out of `LineDiff`.
 *
 * `DiffView` draws the changes; this turns the same structure into the text you
 * would paste into a code review, a `.patch` file or a commit message. It is a
 * *rendering* of the diff — no attempt is made to be `git apply`-compatible,
 * because a patch that looks applicable but is not is worse than one that is
 * plainly a report.
 */
import { hunkHeader, type LineDiff } from '../diff';

export function unifiedPatch(diff: LineDiff, beforeLabel = 'before', afterLabel = 'after'): string {
  if (diff.unchanged) return '';

  const header = `--- ${beforeLabel}\n+++ ${afterLabel}`;
  const hunks = diff.hunks.map((hunk) => {
    const body = hunk.lines
      .map((line) => `${line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}${line.text}`)
      .join('\n');
    return `${hunkHeader(hunk)}\n${body}`;
  });

  return `${header}\n${hunks.join('\n')}\n`;
}
