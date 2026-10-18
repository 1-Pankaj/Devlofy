/**
 * JSON: check it, format it, shrink it, sort it, and turn it into types.
 *
 * Every function returns a **result object** rather than throwing, because the
 * only caller is a screen and the screen has to render the failure anyway.
 *
 * The error position is found by **this file**, not by the host. Runtimes report
 * JSON failures differently and neither of the ones that matter here gives a
 * usable offset: Hermes (Android, the primary platform) says only "JSON Parse
 * error", and modern V8 replaced "at position 42" with a quoted snippet. So a
 * small validator walks the text, stops exactly where the structure breaks, and
 * reports a line and column that are the same on every platform — with its own
 * sentence ("Expected a value, found }") rather than a paraphrased runtime
 * string.
 */

export type JsonError = {
  message: string;
  line: number | null;
  column: number | null;
};

export type JsonResult<T> = { ok: true; value: T } | { ok: false; error: JsonError };

export function parseJson(text: string): JsonResult<unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: { message: 'Nothing to check yet.', line: null, column: null } };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    const located = locate(trimmed);
    if (located) {
      const before = trimmed.slice(0, located.index).split('\n');
      return {
        ok: false,
        error: {
          message: located.message,
          line: before.length,
          column: before[before.length - 1].length + 1,
        },
      };
    }
    return { ok: false, error: { message: hostMessage(error), line: null, column: null } };
  }
}

/** The runtime's own words, cleaned of the tail that differs between engines. */
function hostMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return (
    raw
      .replace(/\s*in JSON at position \d+.*$/i, '')
      .replace(/\s*\(line \d+ column \d+\)$/i, '')
      .replace(/^JSON\.parse:\s*/i, '')
      .replace(/^JSON Parse error:\s*/i, '')
      .trim() || 'That is not valid JSON.'
  );
}

type Located = { index: number; message: string };

/**
 * A validator, not a parser: it answers "is this well-formed, and where does it
 * stop being" and nothing else. That keeps it small enough to trust — there is
 * no number conversion, no string building and no depth limit to get wrong.
 */
function locate(text: string): Located | null {
  let at = 0;
  const length = text.length;

  const fail = (message: string, index = at): Located => ({ index, message });

  const skipWhitespace = () => {
    while (at < length && /\s/.test(text[at])) at += 1;
  };

  const readString = (): Located | null => {
    const start = at;
    at += 1;
    while (at < length) {
      const char = text[at];
      if (char === '\\') {
        const next = text[at + 1];
        if (next === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(at + 2, at + 6))) {
            return fail('That \\u escape is not four hex digits.', at);
          }
          at += 6;
          continue;
        }
        if (next && '"\\/bfnrt'.includes(next)) {
          at += 2;
          continue;
        }
        return fail('That is not a valid escape inside a string.', at);
      }
      if (char === '"') {
        at += 1;
        return null;
      }
      if (char === '\n') return fail('The string is not closed before the end of the line.', at);
      at += 1;
    }
    return fail('The string is never closed.', start);
  };

  const readNumber = (): Located | null => {
    const start = at;
    if (text[at] === '-') at += 1;
    if (text[at] === '0') at += 1;
    else if (/[1-9]/.test(text[at] ?? '')) while (/[0-9]/.test(text[at] ?? '')) at += 1;
    else return fail('That is not a valid number.', start);

    if (text[at] === '.') {
      at += 1;
      if (!/[0-9]/.test(text[at] ?? '')) return fail('A decimal point needs digits after it.', start);
      while (/[0-9]/.test(text[at] ?? '')) at += 1;
    }
    if (text[at] === 'e' || text[at] === 'E') {
      at += 1;
      if (text[at] === '+' || text[at] === '-') at += 1;
      if (!/[0-9]/.test(text[at] ?? '')) return fail('An exponent needs digits after it.', start);
      while (/[0-9]/.test(text[at] ?? '')) at += 1;
    }
    return null;
  };

  const readArray = (): Located | null => {
    at += 1; // [
    skipWhitespace();
    if (text[at] === ']') {
      at += 1;
      return null;
    }
    for (;;) {
      const bad = readValue();
      if (bad) return bad;
      skipWhitespace();
      if (text[at] === ',') {
        at += 1;
        continue;
      }
      if (text[at] === ']') {
        at += 1;
        return null;
      }
      return fail(at >= length ? 'The array is never closed.' : "Expected ',' or ']' here.");
    }
  };

  const readObject = (): Located | null => {
    at += 1; // {
    skipWhitespace();
    if (text[at] === '}') {
      at += 1;
      return null;
    }
    for (;;) {
      skipWhitespace();
      if (text[at] !== '"') {
        return fail(at >= length ? 'The object is never closed.' : 'Expected a property name in double quotes.');
      }
      const badKey = readString();
      if (badKey) return badKey;
      skipWhitespace();
      if (text[at] !== ':') return fail("Expected ':' after the property name.");
      at += 1;
      const badValue = readValue();
      if (badValue) return badValue;
      skipWhitespace();
      if (text[at] === ',') {
        at += 1;
        continue;
      }
      if (text[at] === '}') {
        at += 1;
        return null;
      }
      return fail(at >= length ? 'The object is never closed.' : "Expected ',' or '}' here.");
    }
  };

  function readValue(): Located | null {
    skipWhitespace();
    if (at >= length) return fail('The value stops here.');
    const char = text[at];
    if (char === '{') return readObject();
    if (char === '[') return readArray();
    if (char === '"') return readString();
    if (char === '-' || /[0-9]/.test(char)) return readNumber();
    for (const literal of ['true', 'false', 'null']) {
      if (text.startsWith(literal, at)) {
        at += literal.length;
        return null;
      }
    }
    return fail(`Expected a value, found "${char}".`);
  }

  const bad = readValue();
  if (bad) return bad;
  skipWhitespace();
  if (at < length) return fail('There is extra content after the value.');
  return null;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export type FormatOptions = {
  indent?: number;
  sortKeys?: boolean;
};

export function formatJson(text: string, options: FormatOptions = {}): JsonResult<string> {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const { indent = 2, sortKeys = false } = options;
  const value = sortKeys ? sortDeep(parsed.value) : parsed.value;
  return { ok: true, value: `${JSON.stringify(value, null, indent)}\n` };
}

export function minifyJson(text: string): JsonResult<string> {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, value: JSON.stringify(parsed.value) };
}

export type JsonStats = {
  bytes: number;
  keys: number;
  depth: number;
  nodes: number;
};

export function jsonStats(value: unknown): JsonStats {
  let keys = 0;
  let nodes = 0;
  let depth = 0;

  const walk = (current: unknown, level: number) => {
    nodes += 1;
    depth = Math.max(depth, level);
    if (Array.isArray(current)) {
      for (const item of current) walk(item, level + 1);
      return;
    }
    if (current && typeof current === 'object') {
      for (const item of Object.values(current as Record<string, unknown>)) {
        keys += 1;
        walk(item, level + 1);
      }
    }
  };

  walk(value, 0);
  return { bytes: JSON.stringify(value).length, keys, depth, nodes };
}

// ───────────────────────── JSON → TypeScript ─────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function wordFor(key: string): string {
  const cleaned = key
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const named = cleaned || 'Value';
  return /^[0-9]/.test(named) ? `N${named}` : named;
}

/** "items" → "item", "line_items" → "LineItem". A heuristic, and said so in the UI. */
function singular(hint: string): string {
  if (/ies$/i.test(hint)) return hint.replace(/ies$/i, 'y');
  if (/(?:ses|xes|zes|ches|shes)$/i.test(hint)) return hint.slice(0, -2);
  if (/s$/i.test(hint) && !/ss$/i.test(hint)) return hint.slice(0, -1);
  return hint;
}

function quoteKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

type Shape = { obj: Record<string, unknown>; optional: Set<string> };

/** Union of the keys across array elements; a key missing from some is optional. */
function mergeObjects(items: Record<string, unknown>[]): Shape {
  const obj: Record<string, unknown> = {};
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!(key in obj)) obj[key] = value;
    }
  }

  const optional = new Set<string>();
  for (const [key, count] of counts) if (count < items.length) optional.add(key);
  return { obj, optional };
}

/**
 * Generates `export interface`s from a value. Nested objects become named
 * interfaces ("user" → `User`, "line_items" → `LineItems`); arrays of objects
 * are merged, with keys missing from some elements marked optional, which is the
 * only honest reading of a sample that is not a schema. Identical shapes share
 * one interface; different shapes under the same name get a numeric suffix
 * rather than being silently collapsed.
 */
export function jsonToTypeScript(value: unknown, rootName = 'Root'): string {
  const root = wordFor(rootName);
  const shapes = new Map<string, { signature: string; body: string }>();
  const order: string[] = [];

  const nameFor = (preferred: string, signature: string): string => {
    const existing = shapes.get(preferred);
    if (!existing) {
      shapes.set(preferred, { signature, body: '' });
      order.push(preferred);
      return preferred;
    }
    if (existing.signature === signature) return preferred;
    let index = 2;
    while (shapes.has(`${preferred}${index}`)) {
      if (shapes.get(`${preferred}${index}`)?.signature === signature) return `${preferred}${index}`;
      index += 1;
    }
    shapes.set(`${preferred}${index}`, { signature, body: '' });
    order.push(`${preferred}${index}`);
    return `${preferred}${index}`;
  };

  const objectType = (shape: Shape, hint: string): string => {
    const name = nameFor(hint, JSON.stringify(shape.obj));
    const registered = shapes.get(name);
    if (!registered?.body) {
      const lines = Object.entries(shape.obj).map(
        ([key, item]) =>
          `  ${quoteKey(key)}${shape.optional.has(key) || item === null ? '?' : ''}: ${typeOf(item, wordFor(key))};`,
      );
      if (registered) registered.body = lines.join('\n');
    }
    return name;
  };

  function typeOf(current: unknown, hint: string): string {
    if (current === null) return 'null';
    if (Array.isArray(current)) {
      if (current.length === 0) return 'unknown[]';
      if (current.every(isPlainObject)) return `${objectType(mergeObjects(current), singular(hint))}[]`;
      const parts: string[] = [];
      for (const item of current) {
        const type = typeOf(item, singular(hint));
        if (!parts.includes(type)) parts.push(type);
      }
      return parts.length === 1 ? `${parts[0]}[]` : `Array<${parts.join(' | ')}>`;
    }
    if (isPlainObject(current)) return objectType({ obj: current, optional: new Set() }, hint);
    if (typeof current === 'string') return 'string';
    if (typeof current === 'number') return 'number';
    if (typeof current === 'boolean') return 'boolean';
    return 'unknown';
  }

  if (!isPlainObject(value)) {
    return `export type ${root} = ${typeOf(value, root)};\n`;
  }

  objectType({ obj: value, optional: new Set() }, root);

  const interfaces = order
    .filter((name) => shapes.get(name)?.body)
    .map((name) => `export interface ${name} {\n${shapes.get(name)?.body}\n}`);

  return `${interfaces.join('\n\n')}\n`;
}
