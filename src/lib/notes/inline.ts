/**
 * Inline markdown, tokenized.
 *
 * Two callers, one parser. The **renderer** turns a block's text into spans to
 * draw (bold is actually bold, `[x](y)` is actually tappable); the **format bar**
 * asks which marks are open at the caret so its buttons can light up, and wraps
 * or unwraps the selection. Keeping both on one tokenizer is what stops the
 * toolbar and the reading view from ever disagreeing about the same note.
 *
 * Deliberately small and total: a malformed `**` is just a `**`, never an error,
 * and nothing here can throw. Escapes are honoured, so `\*` draws a star —
 * the source keeps the backslash, only the drawing is reduced.
 */
export type InlineKind =
  | 'text'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'highlight'
  | 'link'
  | 'wikilink';

export type InlineSpan = {
  kind: InlineKind;
  /** The text to draw — without the markers. */
  text: string;
  /** `link` only. */
  href?: string;
  /** `wikilink` only: the note this points at (`[[Target|Alias]]` → `Target`). */
  target?: string;
};

/** The marker that opens each inline kind, for the format bar. */
export const INLINE_MARKERS: Partial<Record<InlineKind, string>> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
  highlight: '==',
};

/** Scan-friendly: `[[Target]]` / `[[Target|Alias]]` anywhere in a string. */
export const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

const WIKILINK_AT = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
const LINK_AT = /^\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!~=|>]/;

/** The next unescaped closing `marker` at or after `from`, or -1. */
function findClose(text: string, from: number, marker: string, wordBoundary: boolean): number {
  let cursor = from;
  while (cursor <= text.length - marker.length) {
    const at = text.indexOf(marker, cursor);
    if (at < 0) return -1;
    const after = text[at + marker.length];
    // Part of a longer run (`***` is not `**` followed by `*`).
    if (after === marker[0]) {
      cursor = at + 1;
      continue;
    }
    // `_italic_` needs a non-word neighbour, so snake_case_names survive.
    if (wordBoundary && after !== undefined && /\w/.test(after)) {
      cursor = at + 1;
      continue;
    }
    return at;
  }
  return -1;
}

/** Tokenize one block's text. Bold/italic/strike/highlight nest; code does not. */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      spans.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };

  while (i < text.length) {
    const rest = text.slice(i);
    const char = rest[0];

    if (char === '\\' && i + 1 < text.length && ESCAPABLE.test(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (char === '`') {
      const close = rest.indexOf('`', 1);
      if (close > 0) {
        flush();
        spans.push({ kind: 'code', text: rest.slice(1, close) });
        i += close + 1;
        continue;
      }
    }

    const wiki = WIKILINK_AT.exec(rest);
    if (wiki) {
      flush();
      spans.push({
        kind: 'wikilink',
        text: (wiki[2] ?? wiki[1]).trim(),
        target: wiki[1].trim(),
      });
      i += wiki[0].length;
      continue;
    }

    const link = LINK_AT.exec(rest);
    if (link) {
      flush();
      spans.push({ kind: 'link', text: link[1] || link[2], href: link[2] });
      i += link[0].length;
      continue;
    }

    if (rest.startsWith('==')) {
      const close = findClose(text, i + 2, '==', false);
      if (close > i + 2) {
        flush();
        spans.push({ kind: 'highlight', text: text.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
    }

    if (rest.startsWith('**') || rest.startsWith('__')) {
      const marker = rest.slice(0, 2);
      const boundary = marker === '__';
      const opens = !boundary || i === 0 || !/\w/.test(text[i - 1]);
      if (opens) {
        const close = findClose(text, i + 2, marker, boundary);
        if (close > i + 2) {
          flush();
          spans.push({ kind: 'bold', text: text.slice(i + 2, close) });
          i = close + 2;
          continue;
        }
      }
    }

    if (rest.startsWith('~~')) {
      const close = findClose(text, i + 2, '~~', false);
      if (close > i + 2) {
        flush();
        spans.push({ kind: 'strike', text: text.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
    }

    if (char === '*' || char === '_') {
      const boundary = char === '_';
      const opens = !boundary || i === 0 || !/\w/.test(text[i - 1]);
      if (opens) {
        const close = findClose(text, i + 1, char, boundary);
        if (close > i + 1) {
          flush();
          spans.push({ kind: 'italic', text: text.slice(i + 1, close) });
          i = close + 1;
          continue;
        }
      }
    }

    buffer += char;
    i += 1;
  }

  flush();
  return spans;
}

export type Selection = { start: number; end: number };
export type Edit = { text: string; start: number; end: number };

function clampSelection(text: string, selection: Selection): Selection {
  const start = Math.max(0, Math.min(text.length, selection.start));
  const end = Math.max(start, Math.min(text.length, selection.end));
  return { start, end };
}

/**
 * Bold / italic / strike / code / highlight, toggled. Already wrapped (inside or
 * around) means unwrap; an empty selection drops the markers in and sits between
 * them; anything else wraps. One function, because they only differ by marker.
 */
export function toggleInline(text: string, selection: Selection, marker: string): Edit {
  const { start, end } = clampSelection(text, selection);
  const width = marker.length;

  if (
    start >= width &&
    text.slice(start - width, start) === marker &&
    text.slice(end, end + width) === marker
  ) {
    return {
      text: text.slice(0, start - width) + text.slice(start, end) + text.slice(end + width),
      start: start - width,
      end: end - width,
    };
  }

  if (
    end - start > width * 2 &&
    text.slice(start, start + width) === marker &&
    text.slice(end - width, end) === marker
  ) {
    return {
      text: text.slice(0, start) + text.slice(start + width, end - width) + text.slice(end),
      start,
      end: end - width * 2,
    };
  }

  if (start === end) {
    return {
      text: text.slice(0, start) + marker + marker + text.slice(end),
      start: start + width,
      end: start + width,
    };
  }

  return {
    text: text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end),
    start: start + width,
    end: end + width,
  };
}

/** Wrap the selection in a link, or re-point an existing one. */
export function applyLink(text: string, selection: Selection, href: string): Edit {
  const { start, end } = clampSelection(text, selection);
  const target = href.trim();
  if (!target) return { text, start, end };

  if (end > start) {
    const selected = text.slice(start, end);
    const existing = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(selected);
    const label = existing ? existing[1] : selected;
    const next = `[${label}](${target})`;
    return { text: text.slice(0, start) + next + text.slice(end), start, end: start + next.length };
  }

  const inserted = `[](${target})`;
  return {
    text: text.slice(0, start) + inserted + text.slice(end),
    start: start + 1,
    end: start + 1,
  };
}

function countBefore(text: string, at: number, marker: string): number {
  const head = text.slice(0, at);
  let count = 0;
  let cursor = 0;
  for (;;) {
    const found = head.indexOf(marker, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + marker.length;
  }
  return count;
}

const enclosed = (text: string, at: number, marker: string) =>
  countBefore(text, at, marker) % 2 === 1;

/**
 * Which marks are open at the caret — what lights the toolbar's buttons up.
 * Counting delimiters on either side is enough here and stays cheap on a long
 * line; `**a**` is even (bold is a pair), `**a` is odd (bold is open).
 */
export function activeMarks(text: string, selection: Selection): InlineKind[] {
  const { start } = clampSelection(text, selection);
  const marks: InlineKind[] = [];

  const doubles = countBefore(text, start, '**');
  const singles = countBefore(text, start, '*') - doubles * 2;
  const underscores = countBefore(text, start, '__');
  const underscoresSingles = countBefore(text, start, '_') - underscores * 2;

  if (doubles % 2 === 1 || underscores % 2 === 1) marks.push('bold');
  if (singles % 2 === 1 || underscoresSingles % 2 === 1) marks.push('italic');
  if (enclosed(text, start, '~~')) marks.push('strike');
  if (enclosed(text, start, '==')) marks.push('highlight');
  if (enclosed(text, start, '`')) marks.push('code');
  return marks;
}
