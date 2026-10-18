/**
 * Regex: try a pattern against text and show exactly what it caught.
 *
 * Two things make a regex tool feel broken, and both are handled here rather
 * than by the screen: a pattern that does not compile, and a pattern that matches
 * the empty string (which makes a naive `exec` loop spin forever). Flags are the
 * four that change *meaning* — i, m, s, u; `g` is not offered because listing
 * matches is always global, and "replace all" is its own switch. Matches are
 * capped and the cap is reported, so a pattern that matches every character
 * shows a bounded list and says it was bounded.
 */
export type RegexMatch = {
  index: number;
  text: string;
  groups: string[];
};

export type RegexRun = {
  ok: true;
  matches: RegexMatch[];
  truncated: boolean;
  total: number;
};

export type RegexFailure = { ok: false; message: string };

export type RegexOutcome = RegexRun | RegexFailure;

export type RegexFlags = { ignoreCase: boolean; multiline: boolean; dotAll: boolean; unicode: boolean };

export const NO_FLAGS: RegexFlags = {
  ignoreCase: false,
  multiline: false,
  dotAll: false,
  unicode: false,
};

export function flagString(flags: RegexFlags): string {
  return `${flags.ignoreCase ? 'i' : ''}${flags.multiline ? 'm' : ''}${flags.dotAll ? 's' : ''}${
    flags.unicode ? 'u' : ''
  }`;
}

export function flagLabels(flags: RegexFlags): string {
  const parts: string[] = [];
  if (flags.ignoreCase) parts.push('i — ignore case');
  if (flags.multiline) parts.push('m — ^ and $ per line');
  if (flags.dotAll) parts.push('s — . matches newlines');
  if (flags.unicode) parts.push('u — unicode mode');
  return parts.length > 0 ? parts.join(', ') : 'no flags';
}

export function compile(pattern: string, flags: RegexFlags): { ok: true; regex: RegExp } | RegexFailure {
  try {
    return { ok: true, regex: new RegExp(pattern, `${flagString(flags)}g`) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'That pattern did not compile.',
    };
  }
}

/** Longest input we will scan — past this the answer stops being worth the wait. */
const MAX_TEXT = 200_000;
const MAX_MATCHES = 300;

export function runRegex(pattern: string, flags: RegexFlags, text: string, limit = MAX_MATCHES): RegexOutcome {
  if (!pattern) return { ok: false, message: 'Nothing to match yet.' };
  const compiled = compile(pattern, flags);
  if (!compiled.ok) return compiled;

  const haystack = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  const regex = compiled.regex;
  const matches: RegexMatch[] = [];
  let total = 0;

  // The empty-match guard: `exec` on a zero-length match does not advance, so a
  // pattern like `a*` against "bbb" would loop forever without this.
  let guard = 0;
  let result = regex.exec(haystack);
  while (result && guard < MAX_TEXT) {
    guard += 1;
    total += 1;
    if (matches.length < limit) {
      matches.push({
        index: result.index,
        text: result[0],
        groups: result.slice(1).map((group) => group ?? ''),
      });
    }
    const matched = result[0];
    if (matched === '') {
      regex.lastIndex += /[\uD800-\uDBFF]/.test(haystack[regex.lastIndex] ?? '') ? 2 : 1;
    }
    if (regex.lastIndex > haystack.length) break;
    result = regex.exec(haystack);
  }

  return { ok: true, matches, truncated: total > matches.length, total };
}

/**
 * `$1`, `$&`, `$$` and `$<name>` in a replacement string.
 *
 * Written out rather than handed to `String.replace` because that callback form
 * changes shape when a pattern has named groups (the trailing argument becomes
 * the groups object instead of the subject), which is exactly the pattern a
 * regex tool is most likely to be given.
 */
function expandReplacement(template: string, match: RegExpExecArray): string {
  return template.replace(/\$(\$|&|\d{1,2}|<[A-Za-z0-9_]+>)/g, (token, reference: string) => {
    if (reference === '$') return '$';
    if (reference === '&') return match[0];
    if (reference.startsWith('<')) {
      const groups = match.groups as Record<string, string | undefined> | undefined;
      return groups?.[reference.slice(1, -1)] ?? token;
    }
    return match[Number(reference)] ?? token;
  });
}

/**
 * Runs a replacement and returns the result plus how many places changed.
 * `all` is the caller's switch, not a flag.
 */
export function runReplace(
  pattern: string,
  flags: RegexFlags,
  text: string,
  replacement: string,
  all: boolean,
): { ok: true; text: string; count: number } | RegexFailure {
  if (!pattern) return { ok: false, message: 'Nothing to match yet.' };
  const compiled = compile(pattern, flags);
  if (!compiled.ok) return compiled;

  const haystack = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  const regex = compiled.regex;
  let out = '';
  let cursor = 0;
  let count = 0;
  let guard = 0;
  let result = regex.exec(haystack);

  while (result && guard < MAX_TEXT) {
    guard += 1;
    out += haystack.slice(cursor, result.index);
    out += expandReplacement(replacement, result);
    cursor = result.index + result[0].length;
    count += 1;
    if (!all) break;

    if (result[0] === '') {
      // Same empty-match guard as the matcher: copy one code point and move on.
      const width = /[\uD800-\uDBFF]/.test(haystack[cursor] ?? '') ? 2 : 1;
      out += haystack.slice(cursor, cursor + width);
      cursor += width;
      regex.lastIndex = cursor;
    }
    if (regex.lastIndex > haystack.length) break;
    result = regex.exec(haystack);
  }

  out += haystack.slice(cursor);
  return { ok: true, text: out, count };
}

export type Segment = { text: string; match: boolean };

/** Splits text into matched and unmatched runs, for a highlighted preview. */
export function segmentsOf(text: string, matches: RegexMatch[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), match: false });
    if (match.text.length > 0) {
      segments.push({ text: match.text, match: true });
      cursor = match.index + match.text.length;
    }
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments.filter((segment) => segment.text.length > 0);
}

export type Recipe = { name: string; pattern: string; flags: RegexFlags; sample: string };

/** A few patterns worth starting from — the tool's own examples, editable. */
export const RECIPES: Recipe[] = [
  {
    name: 'Email',
    pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
    flags: { ...NO_FLAGS },
    sample: 'Write to hi@devlofy.app or support@example.co.uk before Friday.',
  },
  {
    name: 'URL',
    pattern: 'https?://[^\\s]+',
    flags: { ...NO_FLAGS },
    sample: 'Docs at https://docs.expo.dev/versions/v58.0.0/ and a mirror on http://localhost:8081',
  },
  {
    name: 'Hex colour',
    pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b',
    flags: { ...NO_FLAGS },
    sample: 'accent #4F46E5, ember #F59E0B, surface #FFFFFF, near-black #111',
  },
  {
    name: 'ISO date',
    pattern: '\\d{4}-\\d{2}-\\d{2}',
    flags: { ...NO_FLAGS },
    sample: 'shipped 2026-10-19, reverted 2026-10-20, redone 2026-11-01',
  },
  {
    name: 'Repeated word',
    pattern: '\\b(\\w+)\\s+\\1\\b',
    flags: { ignoreCase: true, multiline: false, dotAll: false, unicode: false },
    sample: 'the the client brief was was late',
  },
  {
    name: 'TODO with owner',
    pattern: 'TODO\\((?<who>[^)]+)\\):\\s*(.+)',
    flags: { ...NO_FLAGS },
    sample: 'TODO(pankaj): ship Bench\nTODO(sam): review the PR',
  },
];
