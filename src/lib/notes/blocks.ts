/**
 * The block model — Notion's editing, markdown's guarantees.
 *
 * A note is still **markdown in a text column**. A block is a *view over one or
 * more source lines*, never a new storage format: `parseBlocks()` reads the saved
 * body into blocks to draw, and every edit is a pure function from one body
 * string to the next (`splitBlock`, `setBlockType`, `indentBlock`, `moveBlock`,
 * …). Nothing here touches SQLite, so nothing here can fail to reproduce a note
 * it was handed.
 *
 * Why lines and not a JSON document per note (which is what a block editor
 * usually stores):
 *
 *  - **Every note already written is markdown** and stays readable, in place, with
 *    no migration and nothing to lose. The alternative means converting the whole
 *    library on upgrade and owning the conversion forever.
 *  - **The rest of the app keeps working**: `searchEverything()` is one `LIKE`
 *    over `body`, the JSON export is still plain text, and Bench's markdown-ish
 *    tools still apply. A proprietary blob would need a search index and a
 *    serializer built for it.
 *  - **The file stays a file.** A note copied out of the app is complete, not a
 *    rendering of a database.
 *  - The one thing the JSON model buys that this cannot do — inline formatting
 *    *inside* a block — is the one thing a plain `TextInput` cannot render either
 *    (see `inline.ts`). So it is not paid for twice.
 *
 * Two rules keep the surgery safe:
 *
 *  1. **Only touched lines are rewritten.** A `Block` carries its verbatim source
 *    lines, and an operation rebuilds *just* the blocks it changed, so a note's
 *    untouched text is never subtly reformatted by an unrelated edit.
 *  2. **There is always at least one block.** An empty body parses to one empty
 *    paragraph, so "the note" is never nothing.
 *
 * Consequence, stated plainly: a block's canonical form is one line (code blocks
 * excepted, which are fenced and multi-line). So Enter ends a block and starts the
 * next one — which is exactly the behaviour a block editor is expected to have.
 */
import { WIKILINK_PATTERN } from './inline';

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'bullet'
  | 'numbered'
  | 'task'
  | 'quote'
  | 'code'
  | 'divider';

export type Block = {
  type: BlockType;
  /** The content with the block's own syntax removed — what the user edits. */
  text: string;
  /** 0–3. Lists and quotes only; every other type keeps its own leading space. */
  indent: number;
  /** The bullet character as written (`-`, `*`, `+`), or a divider's character. */
  marker: string;
  /** Headings: how many `#` were written (1–6). */
  hashes: number;
  /** Numbered lists: the number as written. */
  number: number | null;
  /** Numbered lists: `.` or `)`. */
  delimiter: string;
  /** Tasks only. */
  checked: boolean;
  /** Code only: the opening fence verbatim, e.g. ` ```ts `. */
  fence: string;
  /** Code only: the language between the fences. */
  lang: string;
  /** The verbatim source lines this block was parsed from. */
  lines: string[];
};

export type Focus = { body: string; focus: number; caret?: number };

/** A parsed block paired with the lines that should be written back out. */
type Row = { block: Block; lines: string[] };

const FENCE_RE = /^\s*```\s*([\w+#-]*)\s*$/;
const HEADING_RE = /^(\s*)(#{1,6})\s+(.*)$/;
const DIVIDER_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const TASK_RE = /^([\t ]*)([-*+])\s+\[([ xX])\]\s?(.*)$/;
const NUMBERED_RE = /^([\t ]*)(\d+)([.)])\s+(.*)$/;
const BULLET_RE = /^([\t ]*)([-*+])\s+(.*)$/;
const QUOTE_RE = /^([\t ]*)>\s?(.*)$/;

const MAX_INDENT = 3;

/** A tab is two spaces of structure, the way every markdown editor treats it. */
function indentOf(lead: string): number {
  const spaces = lead.replace(/\t/g, '  ').length;
  return Math.min(MAX_INDENT, Math.floor(spaces / 2));
}

function pad(indent: number): string {
  return '  '.repeat(Math.max(0, Math.min(MAX_INDENT, indent)));
}

/** Parse a body into blocks. Always returns at least one (an empty paragraph). */
export function parseBlocks(body: string): Block[] {
  const source = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  let index = 0;
  while (index < source.length) {
    const line = source[index];
    const fence = FENCE_RE.exec(line);

    if (fence) {
      const lang = fence[1] ?? '';
      const inner: string[] = [];
      const lines = [line];
      let cursor = index + 1;
      while (cursor < source.length && !FENCE_RE.test(source[cursor])) {
        inner.push(source[cursor]);
        lines.push(source[cursor]);
        cursor += 1;
      }
      if (cursor < source.length) {
        lines.push(source[cursor]);
        cursor += 1;
      }
      blocks.push({
        type: 'code',
        text: inner.join('\n'),
        indent: 0,
        marker: '-',
        hashes: 0,
        number: null,
        delimiter: '.',
        checked: false,
        fence: line.trim(),
        lang,
        lines,
      });
      index = cursor;
      continue;
    }

    const base = {
      indent: 0,
      marker: '-',
      hashes: 0,
      number: null as number | null,
      delimiter: '.',
      checked: false,
      fence: '```',
      lang: '',
      lines: [line],
    };

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({
        ...base,
        type: 'heading',
        text: heading[3],
        hashes: heading[2].length,
        indent: indentOf(heading[1]),
      });
      index += 1;
      continue;
    }

    // Dividers before bullets: `- - -` is a break, not a list item.
    if (DIVIDER_RE.test(line)) {
      blocks.push({ ...base, type: 'divider', text: '', marker: line.trim()[0] });
      index += 1;
      continue;
    }

    const task = TASK_RE.exec(line);
    if (task) {
      blocks.push({
        ...base,
        type: 'task',
        text: task[4],
        indent: indentOf(task[1]),
        marker: task[2],
        checked: task[3].toLowerCase() === 'x',
      });
      index += 1;
      continue;
    }

    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      blocks.push({
        ...base,
        type: 'numbered',
        text: numbered[4],
        indent: indentOf(numbered[1]),
        number: Number(numbered[2]),
        delimiter: numbered[3],
      });
      index += 1;
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      blocks.push({
        ...base,
        type: 'bullet',
        text: bullet[3],
        indent: indentOf(bullet[1]),
        marker: bullet[2],
      });
      index += 1;
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      blocks.push({
        ...base,
        type: 'quote',
        text: quote[2],
        indent: indentOf(quote[1]),
      });
      index += 1;
      continue;
    }

    blocks.push({ ...base, type: 'paragraph', text: line });
    index += 1;
  }

  if (blocks.length === 0) {
    blocks.push({
      type: 'paragraph',
      text: '',
      indent: 0,
      marker: '-',
      hashes: 0,
      number: null,
      delimiter: '.',
      checked: false,
      fence: '```',
      lang: '',
      lines: [''],
    });
  }
  return blocks;
}

/** The canonical source lines for a block. Only ever used for edited blocks. */
export function renderBlock(block: Block): string[] {
  switch (block.type) {
    case 'heading':
      return [`${'#'.repeat(Math.max(1, Math.min(6, block.hashes)))} ${block.text}`];
    case 'bullet':
      return [`${pad(block.indent)}${block.marker} ${block.text}`];
    case 'numbered':
      return [
        `${pad(block.indent)}${block.number ?? 1}${block.delimiter} ${block.text}`,
      ];
    case 'task':
      return [`${pad(block.indent)}${block.marker} [${block.checked ? 'x' : ' '}] ${block.text}`];
    case 'quote':
      return [`${pad(block.indent)}>${block.text ? ` ${block.text}` : ''}`];
    case 'divider':
      return [block.marker.repeat(3)];
    case 'code':
      return block.text === ''
        ? [block.fence, '```']
        : [block.fence, ...block.text.split('\n'), '```'];
    case 'paragraph':
    default:
      return [block.text];
  }
}

function rowsOf(body: string): Row[] {
  return parseBlocks(body).map((block) => ({ block, lines: block.lines }));
}

function writeRows(rows: Row[]): string {
  const lines: string[] = [];
  for (const row of rows) lines.push(...row.lines);
  return lines.join('\n');
}

/** Replace a block's lines with its canonical rendering. */
function rewrite(block: Block, patch: Partial<Block> = {}): Row {
  const next = { ...block, ...patch };
  return { block: next, lines: renderBlock(next) };
}

const isList = (type: BlockType) =>
  type === 'bullet' || type === 'numbered' || type === 'task' || type === 'quote';

/** The half-open range of a block *and its children* (deeper-indented followers). */
function subtreeEnd(rows: Row[], index: number): number {
  const block = rows[index].block;
  if (!isList(block.type)) return index + 1;
  let cursor = index + 1;
  while (cursor < rows.length) {
    const next = rows[cursor].block;
    if (!isList(next.type) || next.indent <= block.indent) break;
    cursor += 1;
  }
  return cursor;
}

/**
 * Renumber every numbered run so it reads 1, 2, 3 again after a structural edit.
 * Only lines that actually change are rewritten.
 */
function renumber(rows: Row[]): Row[] {
  const out = rows.slice();
  for (let index = 0; index < out.length; index += 1) {
    const block = out[index].block;
    if (block.type !== 'numbered') continue;
    let previous: Row | null = null;
    for (let back = index - 1; back >= 0; back -= 1) {
      const candidate = out[back].block;
      if (candidate.type === 'numbered' && candidate.indent === block.indent) {
        previous = out[back];
        break;
      }
      if (isList(candidate.type) && candidate.indent < block.indent) break;
      if (!isList(candidate.type)) break;
    }
    const expected = previous ? (previous.block.number ?? 0) + 1 : 1;
    if (block.number !== expected) {
      out[index] = rewrite(block, { number: expected });
    }
  }
  return out;
}

const emptyBlock = (type: BlockType, hashes = 1): Block => ({
  type,
  text: '',
  indent: 0,
  marker: '-',
  hashes,
  number: type === 'numbered' ? 1 : null,
  delimiter: '.',
  checked: false,
  fence: '```',
  lang: '',
  lines: [],
});

/** Turn into — one block's type changes; the text comes with it. */
export function setBlockType(
  body: string,
  index: number,
  type: BlockType,
  hashes = 1,
): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row) return { body, focus: index };

  // A fenced block is the only multi-line one: converting it to a line type
  // splits it into one block per line, which is the only honest mapping.
  if (row.block.type === 'code' && type !== 'code' && type !== 'divider') {
    const parts = row.block.text.split('\n');
    const replacement: Row[] = parts.map((text) => {
      const block = { ...emptyBlock(type, hashes), text, indent: row.block.indent };
      return rewrite(block);
    });
    rows.splice(index, 1, ...replacement);
    return { body: writeRows(renumber(rows)), focus: index };
  }

  const patch: Partial<Block> = {
    type,
    hashes: type === 'heading' ? hashes : row.block.hashes,
    number: type === 'numbered' ? (row.block.number ?? 1) : null,
    checked: type === 'task' ? row.block.checked || false : false,
  };
  rows[index] = rewrite(row.block, patch);
  return { body: writeRows(renumber(rows)), focus: index };
}

/** The task box, flipped. */
export function toggleTask(body: string, index: number): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row || row.block.type !== 'task') return { body, focus: index };
  rows[index] = rewrite(row.block, { checked: !row.block.checked });
  return { body: writeRows(rows), focus: index };
}

/**
 * Replace one block's text, keeping its type, indent and marker. The toolbar's
 * inline actions and the editor's own keystrokes both land here, so a bolded
 * list item is still a list item.
 */
export function setBlockText(body: string, index: number, text: string): string {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row) return body;
  rows[index] = rewrite(row.block, { text });
  return writeRows(rows);
}

/**
 * Enter. In a fenced block it inserts a line break (the block is multi-line
 * already); everywhere else it starts a new block, carrying the type — a list
 * item continues the list, a task continues as an *unchecked* task, and a
 * divider gets out of the way with a paragraph.
 */
export function splitBlock(body: string, index: number, offset: number): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row) return { body, focus: index };
  const block = row.block;

  if (block.type === 'code') {
    const next = `${block.text.slice(0, offset)}\n${block.text.slice(offset)}`;
    rows[index] = rewrite(block, { text: next });
    return { body: writeRows(rows), focus: index, caret: offset + 1 };
  }

  const head = block.text.slice(0, offset);
  const tail = block.text.slice(offset);

  if (block.type === 'divider') {
    // A divider never takes the caret: Enter below it starts a paragraph.
    rows.splice(index + 1, 0, rewrite(emptyBlock('paragraph')));
    return { body: writeRows(rows), focus: index + 1, caret: 0 };
  }

  // Enter on an empty list item leaves the list — the second Enter is how you
  // get out of a bullet, in every editor that has ever had bullets.
  if (isList(block.type) && block.text === '') {
    rows[index] = rewrite(block, {
      type: 'paragraph',
      hashes: 1,
      number: null,
      checked: false,
      indent: 0,
    });
    return { body: writeRows(renumber(rows)), focus: index, caret: 0 };
  }

  // A heading continues as a heading only when it is split *inside*; pressing
  // Enter at the end of a heading starts the body text below it, which is the
  // one flow every writer actually uses.
  const tailType: BlockType =
    block.type === 'paragraph' || (block.type === 'heading' && offset >= block.text.length)
      ? 'paragraph'
      : block.type;
  const tailBlock: Block = {
    ...emptyBlock(tailType, block.hashes),
    text: tail,
    indent: block.indent,
    marker: block.marker,
    delimiter: block.delimiter,
    number: block.type === 'numbered' ? (block.number ?? 1) + 1 : null,
    checked: false,
  };

  rows[index] = rewrite(block, { text: head });
  rows.splice(index + 1, 0, rewrite(tailBlock));
  return { body: writeRows(renumber(rows)), focus: index + 1, caret: 0 };
}

/** Backspace at the very start of a block: fold it into the one above. */
export function mergeWithPrevious(body: string, index: number): Focus {
  const rows = rowsOf(body);
  if (index <= 0 || index >= rows.length) return { body, focus: index };
  const previous = rows[index - 1].block;
  const block = rows[index].block;
  if (previous.type === 'code' || block.type === 'code') {
    return { body, focus: index };
  }
  const caret = previous.text.length;
  const joined = previous.text + block.text;
  rows[index - 1] = rewrite(previous, { text: joined });
  rows.splice(index, 1);
  return { body: writeRows(rows), focus: index - 1, caret };
}

/** Insert an empty block after `index` and hand back the index to focus. */
export function insertBlock(body: string, index: number, type: BlockType = 'paragraph'): Focus {
  const rows = rowsOf(body);
  const after = Math.min(rows.length, index + 1);
  const block = emptyBlock(type);
  rows.splice(after, 0, rewrite(block));
  return { body: writeRows(renumber(rows)), focus: after };
}

/** Delete a block and its children; the last remaining block empties instead. */
export function removeBlock(body: string, index: number): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row) return { body, focus: index };
  const end = subtreeEnd(rows, index);
  if (end - index >= rows.length) {
    const only = rewrite(emptyBlock('paragraph'));
    return { body: writeRows([only]), focus: 0 };
  }
  rows.splice(index, end - index);
  return { body: writeRows(renumber(rows)), focus: Math.max(0, index - 1) };
}

/** Duplicate a block (and its children) directly underneath. */
export function duplicateBlock(body: string, index: number): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row) return { body, focus: index };
  const end = subtreeEnd(rows, index);
  const copies = rows
    .slice(index, end)
    .map((source) => rewrite(source.block));
  rows.splice(end, 0, ...copies);
  return { body: writeRows(renumber(rows)), focus: end };
}

/**
 * Move a block (and its children) past its neighbour, one step at a time.
 * Renumbered afterwards, so `1. 2. 3.` survives a reorder. Moving past a parent,
 * or moving the first child above its parent, is a no-op rather than a surprise.
 */
export function moveBlock(body: string, index: number, delta: number): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row || delta === 0) return { body, focus: index };

  const size = subtreeEnd(rows, index) - index;
  const moved = rows.splice(index, size);
  const restore = (): Focus => {
    rows.splice(index, 0, ...moved);
    return { body, focus: index };
  };

  if (delta < 0) {
    if (index === 0) return restore();
    let previous = index - 1;
    while (
      previous >= 0 &&
      isList(rows[previous].block.type) &&
      rows[previous].block.indent > row.block.indent
    ) {
      previous -= 1;
    }
    if (previous < 0) return restore();
    if (rows[previous].block.indent < row.block.indent) return restore();
    rows.splice(previous, 0, ...moved);
    return { body: writeRows(renumber(rows)), focus: previous };
  }

  if (index >= rows.length) return restore();
  const next = rows[index].block;
  if (isList(next.type) && next.indent < row.block.indent) return restore();
  const after = subtreeEnd(rows, index);
  rows.splice(after, 0, ...moved);
  return { body: writeRows(renumber(rows)), focus: after };
}

/** Indent a list item or quote in or out. Anything else is left alone. */
export function indentBlock(body: string, index: number, delta: number): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row || !isList(row.block.type)) return { body, focus: index };
  const indent = Math.max(0, Math.min(MAX_INDENT, row.block.indent + delta));
  if (indent === row.block.indent) return { body, focus: index };
  rows[index] = rewrite(row.block, { indent });
  return { body: writeRows(rows), focus: index };
}

/**
 * Markdown shortcuts, applied as you type: `# ` becomes a heading, `- ` a list,
 * `[] ` a task, `> ` a quote, ``` a fence. Returns null when nothing applies —
 * the caller then leaves the text exactly as typed.
 */
export function applyInputRules(
  text: string,
  type: BlockType,
  hashes: number,
): { type: BlockType; hashes: number; text: string } | null {
  if (type !== 'paragraph' && type !== 'bullet') return null;

  const heading = /^(#{1,6})\s$/.exec(text);
  if (heading) return { type: 'heading', hashes: heading[1].length, text: '' };

  const bullet = /^[-*+]\s$/.exec(text);
  if (bullet) return { type: 'bullet', hashes, text: '' };

  const numbered = /^(\d+)[.)]\s$/.exec(text);
  if (numbered) return { type: 'numbered', hashes, text: '' };

  const task = /^\[([ xX]?)\]\s$/.exec(text);
  if (task) {
    return { type: 'task', hashes, text: '' };
  }

  const quote = /^>\s$/.exec(text);
  if (quote) return { type: 'quote', hashes, text: '' };

  const fence = /^```([\w+#-]*)$/.exec(text);
  if (fence) return { type: 'code', hashes, text: '' };

  if (/^(---|\*\*\*|___)$/.test(text)) return { type: 'divider', hashes, text: '' };

  return null;
}

/**
 * Everything one `TextInput` tells us at once: the block's new text, a newline
 * that means "start the next block", and the markdown shortcuts (`# `, `- `,
 * `[] `, `> `, `---`) that turn a paragraph into something else as you type.
 * One entry point, so typing cannot take a different path than the toolbar.
 */
export function commitBlockText(body: string, index: number, value: string): Focus {
  const rows = rowsOf(body);
  const row = rows[index];
  if (!row) return { body, focus: index };
  const block = row.block;

  // A fence owns its newlines: Enter inside code is a line break, not a block.
  if (block.type === 'code') {
    rows[index] = rewrite(block, { text: value });
    return { body: writeRows(rows), focus: index };
  }

  if (!value.includes('\n')) {
    const rule = applyInputRules(value, block.type, block.hashes);
    if (rule) {
      rows[index] = rewrite(block, { type: rule.type, hashes: rule.hashes, text: rule.text });
      return { body: writeRows(renumber(rows)), focus: index, caret: 0 };
    }
    rows[index] = rewrite(block, { text: value });
    return { body: writeRows(rows), focus: index };
  }

  // A newline (typed or pasted) starts the next block. The first one goes
  // through `splitBlock`, so "Enter on a list item" has exactly one
  // implementation; any further pasted lines keep the type that produced.
  // Note the focus: `splitBlock` may *convert* the block instead of splitting it
  // (Enter on an empty bullet leaves the list), so the caret index comes from it.
  const parts = value.split('\n');
  let next = setBlockText(body, index, parts[0]);
  let focus = index;
  for (const line of parts.slice(1)) {
    const text = parseBlocks(next)[focus]?.text ?? '';
    const split = splitBlock(next, focus, text.length);
    next = setBlockText(split.body, split.focus, line);
    focus = split.focus;
  }
  return { body: next, focus, caret: 0 };
}

/** The first thing worth reading, as prose — the notes list's one-line preview. */
export function plainPreview(body: string, limit = 160): string {
  for (const block of parseBlocks(body)) {
    if (block.type === 'divider') continue;
    const text = stripInline(block.text).replace(/\s+/g, ' ').trim();
    if (text) return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
  }
  return '';
}

/**
 * The note as a reader sees it: block markers off, inline marks off, code left
 * alone. This is what the word count counts, so a to-do's `- [ ]` is not three
 * words and `**bold**` is one.
 */
export function visibleText(body: string): string {
  return parseBlocks(body)
    .map((block) =>
      block.type === 'divider'
        ? ''
        : block.type === 'code'
          ? block.text
          : stripInline(block.text),
    )
    .join('\n');
}

/** Inline markdown reduced to its words — for previews and for counting. */
export function stripInline(text: string): string {
  return text
    .replace(WIKILINK_PATTERN, (_match, target: string, alias?: string) => alias ?? target)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*\*|\*\*|\*|___|__|_|~~|==)/g, '');
}

/** Every unchecked task in the note, in reading order — the "extract" source. */
export function openTasks(body: string): { index: number; text: string }[] {
  return parseBlocks(body)
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'task' && !block.checked)
    .map(({ block, index }) => ({ index, text: block.text.trim() }))
    .filter((task) => task.text.length > 0);
}

/** `[[Target]]` and `[[Target|Alias]]` → the targets, unique, in order. */
export function noteRefs(body: string): string[] {
  const seen = new Set<string>();
  const found: string[] = [];
  for (const block of parseBlocks(body)) {
    for (const match of block.text.matchAll(WIKILINK_PATTERN)) {
      const target = (match[1] ?? '').trim();
      if (!target) continue;
      const key = target.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(target);
    }
  }
  return found;
}

/** Headings, for the outline: what the note is about, in order. */
export function outlineOf(body: string): { index: number; hashes: number; text: string }[] {
  return parseBlocks(body)
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'heading' && block.text.trim().length > 0)
    .map(({ block, index }) => ({ index, hashes: block.hashes, text: stripInline(block.text) }));
}
