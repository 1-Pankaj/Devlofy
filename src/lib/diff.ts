/**
 * A small line diff — enough to show a user exactly what they are about to
 * commit, and nothing more.
 *
 * The commit confirmation is a promise ("Commit to `fix/copy` — 1 file, +2 −3")
 * and a diff view is how that promise is kept. This is a plain LCS over lines,
 * after trimming the common prefix and suffix, which is what makes it cheap for
 * the real case: a 900-line file with four lines changed. Files too large to
 * diff are reported as `truncated` rather than silently flattened, and the
 * caller says so in words.
 *
 * GitHub sends its own `patch` text for pull-request files; this module is for
 * *our* edits, before they exist anywhere but on this device.
 */

export type DiffLineKind = 'context' | 'add' | 'remove';

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
  /** 1-based line number in the original file, or null on an added line. */
  beforeNo: number | null;
  /** 1-based line number in the new file, or null on a removed line. */
  afterNo: number | null;
};

export type DiffHunk = {
  beforeStart: number;
  afterStart: number;
  lines: DiffLine[];
};

export type LineDiff = {
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** Identical inputs — there is nothing to commit. */
  unchanged: boolean;
  /** Too large for a line diff; only the counts are meaningful. */
  truncated: boolean;
};

const CONTEXT = 3;
/** n·m ceiling for the LCS table — about 1400×1400 lines of leftover middle. */
const CELL_CAP = 2_000_000;

function splitLines(text: string): string[] {
  // A trailing newline is a line terminator, not an empty final line — the same
  // reading `git` uses, and the reason a file with one blank line at the end
  // does not read as "1 line added".
  const lines = text.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** LCS over the differing middle only, so the DP table stays small in practice. */
function middleOps(before: string[], after: string[]): ('same' | 'add' | 'remove')[] {
  const n = before.length;
  const m = after.length;

  if (n === 0) return after.map(() => 'add' as const);
  if (m === 0) return before.map(() => 'remove' as const);

  if (n * m > CELL_CAP) {
    return [
      ...before.map(() => 'remove' as const),
      ...after.map(() => 'add' as const),
    ];
  }

  const width = m + 1;
  const table = new Int32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + (j + 1)] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + (j + 1)]);
    }
  }

  const ops: ('same' | 'add' | 'remove')[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push('same');
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + (j + 1)]) {
      ops.push('remove');
      i += 1;
    } else {
      ops.push('add');
      j += 1;
    }
  }
  while (i < n) {
    ops.push('remove');
    i += 1;
  }
  while (j < m) {
    ops.push('add');
    j += 1;
  }
  return ops;
}

export function diffLines(beforeText: string, afterText: string): LineDiff {
  if (beforeText === afterText) {
    return { hunks: [], added: 0, removed: 0, unchanged: true, truncated: false };
  }

  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);

  // Trim the ends: an edit is usually a few lines inside a mostly-shared file.
  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const changedBefore = beforeLines.length - prefix - suffix;
  const changedAfter = afterLines.length - prefix - suffix;
  const truncated = changedBefore * changedAfter > CELL_CAP;

  const ops = middleOps(
    beforeLines.slice(prefix, prefix + changedBefore),
    afterLines.slice(prefix, prefix + changedAfter),
  );

  // Walk the ops into numbered lines, then fold into hunks with context.
  const all: DiffLine[] = [];
  let beforeNo = 1;
  let afterNo = 1;

  const pushContext = (count: number) => {
    for (let k = 0; k < count; k += 1) {
      // The line number we are about to hand out *is* the index: this works for
      // the prefix (beforeNo is 1) and for the suffix (beforeNo has been walked
      // to the first shared line at the end) without a second formula. The old
      // `prefix + k` was wrong for both, and printed the wrong text on every
      // diff whose two sides start with a shared line — which is most of them.
      const index = beforeNo - 1 + k;
      all.push({
        kind: 'context',
        text: beforeLines[index] ?? '',
        beforeNo: beforeNo + k,
        afterNo: afterNo + k,
      });
    }
    beforeNo += count;
    afterNo += count;
  };

  pushContext(prefix);

  for (const op of ops) {
    if (op === 'same') {
      all.push({
        kind: 'context',
        text: beforeLines[beforeNo - 1] ?? '',
        beforeNo,
        afterNo,
      });
      beforeNo += 1;
      afterNo += 1;
    } else if (op === 'remove') {
      all.push({ kind: 'remove', text: beforeLines[beforeNo - 1] ?? '', beforeNo, afterNo: null });
      beforeNo += 1;
    } else {
      all.push({ kind: 'add', text: afterLines[afterNo - 1] ?? '', beforeNo: null, afterNo });
      afterNo += 1;
    }
  }

  pushContext(suffix);

  const added = all.filter((line) => line.kind === 'add').length;
  const removed = all.filter((line) => line.kind === 'remove').length;

  return {
    hunks: truncated ? [] : toHunks(all),
    added,
    removed,
    unchanged: false,
    truncated,
  };
}

/** Keep `CONTEXT` lines around each change, and merge hunks that nearly touch. */
function toHunks(lines: DiffLine[]): DiffHunk[] {
  const changedIndexes = lines
    .map((line, index) => (line.kind === 'context' ? -1 : index))
    .filter((index) => index >= 0);

  if (changedIndexes.length === 0) return [];

  const ranges: { start: number; end: number }[] = [];
  for (const index of changedIndexes) {
    const start = Math.max(0, index - CONTEXT);
    const end = Math.min(lines.length - 1, index + CONTEXT);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  return ranges.map((range) => {
    const slice = lines.slice(range.start, range.end + 1);
    return {
      beforeStart: slice.find((line) => line.beforeNo !== null)?.beforeNo ?? 1,
      afterStart: slice.find((line) => line.afterNo !== null)?.afterNo ?? 1,
      lines: slice,
    };
  });
}

/**
 * `@@ -1,3 +1,4 @@` — the hunk header, in its real spelling.
 *
 * The abbreviated form (`@@ -1 +1 @@`) is only correct when a side contributes
 * exactly one line, so the counts are omitted per side rather than always. Both
 * the rendered diff and the patch text go through here, so a hunk can never be
 * labelled two different ways in the same app.
 */
export function hunkHeader(hunk: DiffHunk): string {
  const beforeCount = hunk.lines.filter((line) => line.kind !== 'add').length;
  const afterCount = hunk.lines.filter((line) => line.kind !== 'remove').length;
  const before = beforeCount === 1 ? `${hunk.beforeStart}` : `${hunk.beforeStart},${beforeCount}`;
  const after = afterCount === 1 ? `${hunk.afterStart}` : `${hunk.afterStart},${afterCount}`;
  return `@@ -${before} +${after} @@`;
}

/** "+2 −3" — the arithmetic a confirmation can state without a screenshot. */
export function describeDiff(diff: LineDiff): string {
  if (diff.unchanged) return 'no changes';
  const parts: string[] = [];
  if (diff.added > 0) parts.push(`+${diff.added}`);
  if (diff.removed > 0) parts.push(`−${diff.removed}`);
  return parts.join(' ') || 'no line changes';
}

export function describeLines(count: number): string {
  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}
