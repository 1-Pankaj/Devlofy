/**
 * SQL: re-indent a statement, uppercase its keywords, and stop there.
 *
 * This is deliberately **not** a parser. A formatter that claims to understand
 * SQL has to handle every dialect, every extension and every typo, and the
 * failure mode is mangled text in the one place you cannot afford it. So it does
 * the thing that is safe and covers most of the value: it tokenises (strings,
 * quoted identifiers, `--` and block comments are protected, so nothing inside
 * them is touched), joins multi-word keywords, upper-cases keywords only, and
 * re-breaks lines at top-level clauses, joins, boolean operators and list commas.
 * Keywords are the only thing it changes, and the UI says so.
 */

type TokenKind = 'word' | 'quoted' | 'number' | 'punct' | 'comment';
type Token = { kind: TokenKind; text: string };

/** Clause and operator words — nothing that could be a function name. */
const KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'group',
  'by',
  'order',
  'having',
  'limit',
  'offset',
  'fetch',
  'insert',
  'into',
  'values',
  'update',
  'set',
  'delete',
  'returning',
  'with',
  'recursive',
  'union',
  'intersect',
  'except',
  'all',
  'distinct',
  'as',
  'and',
  'or',
  'not',
  'null',
  'is',
  'in',
  'like',
  'ilike',
  'between',
  'exists',
  'any',
  'some',
  'case',
  'when',
  'then',
  'else',
  'end',
  'asc',
  'desc',
  'nulls',
  'first',
  'last',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'full',
  'cross',
  'natural',
  'on',
  'using',
  'create',
  'table',
  'index',
  'unique',
  'view',
  'if',
  'replace',
  'drop',
  'alter',
  'add',
  'column',
  'primary',
  'key',
  'foreign',
  'references',
  'default',
  'check',
  'constraint',
  'begin',
  'commit',
  'rollback',
  'transaction',
  'explain',
  'analyze',
  'true',
  'false',
  'cascade',
  'restrict',
  'returning',
  'window',
  'over',
  'partition',
  'rows',
  'range',
  'preceding',
  'following',
  'unbounded',
  'current',
  'row',
]);

/** Phrases that must stay on one line as a unit. */
const PHRASES: string[][] = [
  ['group', 'by'],
  ['order', 'by'],
  ['union', 'all'],
  ['insert', 'into'],
  ['delete', 'from'],
  ['is', 'not'],
  ['not', 'null'],
  ['primary', 'key'],
  ['foreign', 'key'],
  ['nulls', 'first'],
  ['nulls', 'last'],
  ['cross', 'join'],
  ['inner', 'join'],
  ['left', 'outer', 'join'],
  ['right', 'outer', 'join'],
  ['full', 'outer', 'join'],
  ['left', 'join'],
  ['right', 'join'],
  ['full', 'join'],
  ['outer', 'join'],
];

/** A clause that introduces an indented, comma-separated list. */
const LIST_CLAUSES = new Set(['select', 'group by', 'order by', 'returning', 'set', 'with', 'values']);
/** A clause that starts a fresh, unindented line. */
const CLAUSES = new Set([
  'select',
  'from',
  'where',
  'group by',
  'order by',
  'having',
  'limit',
  'offset',
  'fetch',
  'insert into',
  'values',
  'update',
  'set',
  'delete from',
  'returning',
  'with',
  'union',
  'union all',
  'intersect',
  'except',
]);
const JOINS = new Set(['join', 'left join', 'right join', 'inner join', 'outer join', 'full join', 'cross join']);
const BOOLEANS = new Set(['and', 'or']);

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '-' && sql[index + 1] === '-') {
      const end = sql.indexOf('\n', index);
      tokens.push({ kind: 'comment', text: sql.slice(index, end === -1 ? sql.length : end).trimEnd() });
      index = end === -1 ? sql.length : end;
      continue;
    }

    if (char === '/' && sql[index + 1] === '*') {
      const end = sql.indexOf('*/', index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      tokens.push({ kind: 'comment', text: sql.slice(index, stop) });
      index = stop;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      let cursor = index + 1;
      while (cursor < sql.length) {
        if (sql[cursor] === char) {
          if (sql[cursor + 1] === char) {
            cursor += 2;
            continue;
          }
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      tokens.push({ kind: 'quoted', text: sql.slice(index, cursor) });
      index = cursor;
      continue;
    }

    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(sql[index + 1] ?? ''))) {
      let cursor = index;
      while (cursor < sql.length && /[0-9a-fA-FxX._]/.test(sql[cursor])) cursor += 1;
      tokens.push({ kind: 'number', text: sql.slice(index, cursor) });
      index = cursor;
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let cursor = index;
      while (cursor < sql.length && /[A-Za-z0-9_$]/.test(sql[cursor])) cursor += 1;
      tokens.push({ kind: 'word', text: sql.slice(index, cursor) });
      index = cursor;
      continue;
    }

    tokens.push({ kind: 'punct', text: char });
    index += 1;
  }

  return tokens;
}

/** Folds runs of words into known phrases, so "group by" cannot be split. */
function phraseTokens(tokens: Token[]): { text: string; kind: TokenKind; keyword: boolean }[] {
  const out: { text: string; kind: TokenKind; keyword: boolean }[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.kind === 'word') {
      let matched: string[] | null = null;
      for (const phrase of PHRASES) {
        if (index + phrase.length > tokens.length) continue;
        const candidate = tokens
          .slice(index, index + phrase.length)
          .map((item) => (item.kind === 'word' ? item.text.toLowerCase() : null));
        if (candidate.every((item, position) => item === phrase[position])) {
          matched = phrase;
          break;
        }
      }
      if (matched) {
        out.push({ text: matched.join(' '), kind: 'word', keyword: true });
        index += matched.length;
        continue;
      }
      out.push({ text: token.text, kind: 'word', keyword: KEYWORDS.has(token.text.toLowerCase()) });
      index += 1;
      continue;
    }
    out.push({ text: token.text, kind: token.kind, keyword: false });
    index += 1;
  }

  return out;
}

export type SqlOptions = { uppercase?: boolean; indent?: number };

export type SqlResult = { text: string; statements: number };

export function formatSql(input: string, options: SqlOptions = {}): SqlResult {
  const { uppercase = true, indent = 2 } = options;
  const pad = ' '.repeat(indent);

  const tokens = phraseTokens(tokenize(input));
  const lines: string[] = [];
  let current = '';
  let level = 0;
  let depth = 0;
  let clause: string | null = null;
  let statements = 0;
  let spaceBefore = true;
  let previousKind: TokenKind | 'none' = 'none';
  let previousText = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) lines.push(`${pad.repeat(level)}${trimmed}`);
    current = '';
  };

  const push = (text: string, space: boolean) => {
    if (!current) current = text;
    else current += space ? ` ${text}` : text;
  };

  /** Ends the line and sets the indent level for the one that starts next. */
  const breakTo = (nextLevel: number) => {
    flush();
    level = Math.max(0, Math.min(nextLevel, 3));
  };

  for (const token of tokens) {
    if (token.kind === 'comment') {
      breakTo(depth > 0 ? 1 : 0);
      push(token.text, false);
      flush();
      spaceBefore = true;
      previousKind = token.kind;
      previousText = token.text;
      continue;
    }

    if (token.kind === 'punct') {
      if (token.text === '(') {
        const glues =
          previousKind === 'word' ||
          previousKind === 'quoted' ||
          previousKind === 'number' ||
          previousText === ')';
        push('(', glues ? false : spaceBefore);
        depth += 1;
        spaceBefore = false;
      } else if (token.text === ')') {
        push(')', false);
        depth = Math.max(0, depth - 1);
        spaceBefore = true;
      } else if (token.text === ',') {
        push(',', false);
        if (depth === 0 && clause && LIST_CLAUSES.has(clause)) breakTo(1);
        else spaceBefore = true;
      } else if (token.text === '.') {
        push('.', false);
        spaceBefore = false;
      } else if (token.text === ';') {
        push(';', false);
        flush();
        statements += 1;
        level = 0;
        clause = null;
        depth = 0;
        lines.push('');
        spaceBefore = true;
      } else {
        push(token.text, spaceBefore);
        spaceBefore = true;
      }
      previousKind = token.kind;
      previousText = token.text;
      continue;
    }

    const lower = token.kind === 'word' ? token.text.toLowerCase() : '';
    const isKeyword = token.kind === 'word' && token.keyword;
    const text = isKeyword && uppercase ? token.text.toUpperCase() : token.text;

    if (isKeyword && CLAUSES.has(lower)) {
      breakTo(depth > 0 ? depth : 0);
      push(text, false);
      clause = lower;
      // A clause that introduces a list opens an indented block; FROM and WHERE
      // keep their operand on the same line.
      if (LIST_CLAUSES.has(lower)) breakTo(depth > 0 ? depth : 1);
      else spaceBefore = true;
    } else if (isKeyword && JOINS.has(lower)) {
      breakTo(depth > 0 ? depth : 0);
      push(text, false);
      spaceBefore = true;
    } else if (isKeyword && BOOLEANS.has(lower) && depth === 0) {
      breakTo(1);
      push(text, false);
      spaceBefore = true;
    } else {
      push(text, spaceBefore);
      spaceBefore = true;
    }

    previousKind = token.kind;
    previousText = text;
  }

  flush();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (statements === 0 && lines.length > 0) statements = 1;

  return { text: `${lines.join('\n')}\n`, statements };
}
