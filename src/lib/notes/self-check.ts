/**
 * Notes' own known-answer checks.
 *
 * The block model makes claims a screenshot cannot confirm: that an operation
 * rewrites *only* the lines it touched, that a list continues on Enter, that
 * `[[Wikilinks]]` survive a round trip, that `snake_case` is not italicised.
 * Those are checked here instead, in one function that returns results rather
 * than printing them. Nothing imports this module, so it never reaches a bundle:
 * run it with `npx tsc` + node (see the commit message).
 */
import {
  applyInputRules,
  commitBlockText,
  duplicateBlock,
  indentBlock,
  insertBlock,
  mergeWithPrevious,
  moveBlock,
  noteRefs,
  openTasks,
  outlineOf,
  parseBlocks,
  plainPreview,
  removeBlock,
  renderBlock,
  setBlockType,
  splitBlock,
  stripInline,
  toggleTask,
  visibleText,
} from './blocks';
import { activeMarks, applyLink, parseInline, toggleInline } from './inline';

export type CheckResult = { name: string; pass: boolean; detail: string };

function check(name: string, actual: unknown, expected: unknown): CheckResult {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return { name, pass: a === e, detail: a === e ? a : `got ${a}, wanted ${e}` };
}

export function runSelfCheck(): CheckResult[] {
  const results: CheckResult[] = [];

  // ── parsing ────────────────────────────────────────────────────────────────
  results.push(
    check('empty body is one empty paragraph', parseBlocks('').map((b) => [b.type, b.text]), [
      ['paragraph', ''],
    ]),
    check('heading level is kept', parseBlocks('### Notes')[0].hashes, 3),
    check('heading text is bare', parseBlocks('## Plan')[0].text, 'Plan'),
    check('a hash without a space is a paragraph', parseBlocks('#tag')[0].type, 'paragraph'),
    check('bullet marker is kept', parseBlocks('* one')[0].marker, '*'),
    check('bullet text is bare', parseBlocks('- one')[0].text, 'one'),
    check('nested bullet counts two spaces as a level', parseBlocks('    - deep')[0].indent, 2),
    check('a tab counts as a level', parseBlocks('\t- deep')[0].indent, 1),
    check('indent stops at three', parseBlocks('            - deep')[0].indent, 3),
    check('task checked state', parseBlocks('- [x] done')[0].checked, true),
    check('task unchecked state', parseBlocks('- [ ] todo')[0].checked, false),
    check('task keeps its own marker', parseBlocks('+ [ ] todo')[0].marker, '+'),
    check('numbered keeps its number', parseBlocks('3. third')[0].number, 3),
    check('numbered keeps its delimiter', parseBlocks('3) third')[0].delimiter, ')'),
    check('quote text is bare', parseBlocks('> said the client')[0].text, 'said the client'),
    check('a lone quote is empty text', parseBlocks('>')[0].text, ''),
    check('dashes are a divider', parseBlocks('---')[0].type, 'divider'),
    check('spaced marks are a divider', parseBlocks('- - -')[0].type, 'divider'),
    check('a fence captures its language', parseBlocks('```ts\nlet a = 1;\n```')[0].lang, 'ts'),
    check('a fence captures its body', parseBlocks('```ts\nlet a = 1;\n```')[0].text, 'let a = 1;'),
    check('an unclosed fence runs to the end', parseBlocks('```\nlet a = 1;')[0].text, 'let a = 1;'),
    check('blank lines are paragraphs', parseBlocks('a\n\nb').map((b) => b.text), ['a', '', 'b']),
  );

  // ── round trips: an untouched block re-renders byte-for-byte ───────────────
  const samples = [
    '# Title',
    '## Subtitle',
    '###### Deep',
    '- one',
    '  - nested',
    '* star',
    '+ plus',
    '1. first',
    '2) second',
    '- [ ] todo',
    '- [x] done',
    '> quoted',
    '>',
    '---',
    '***',
    'a plain line',
    '',
    '```\n```',
    '```ts\n```',
  ];
  for (const sample of samples) {
    const block = parseBlocks(sample)[0];
    results.push(check(`round trip: ${JSON.stringify(sample)}`, renderBlock(block), sample.split('\n')));
  }
  results.push(
    check(
      'round trip: a fence keeps its interior',
      renderBlock(parseBlocks('```ts\nlet a = 1;\nlet b = 2;\n```')[0]),
      ['```ts', 'let a = 1;', 'let b = 2;', '```'],
    ),
    check(
      'an unclosed fence is closed when its block is edited',
      renderBlock(parseBlocks('```')[0]),
      ['```', '```'],
    ),
  );

  // ── setBlockType ───────────────────────────────────────────────────────────
  results.push(
    check('paragraph to heading keeps the text', setBlockType('hello', 0, 'heading', 2).body, '## hello'),
    check('heading to paragraph drops the hashes', setBlockType('## hello', 0, 'paragraph').body, 'hello'),
    check('paragraph to task starts unchecked', setBlockType('send it', 0, 'task').body, '- [ ] send it'),
    check('bullet to numbered starts at one', setBlockType('- a', 0, 'numbered').body, '1. a'),
    check('paragraph to divider keeps a clean break', setBlockType('x', 0, 'divider').body, '---'),
    check('paragraph to code fences it', setBlockType('let a = 1;', 0, 'code').body, '```\nlet a = 1;\n```'),
    check(
      'code to paragraph splits per line',
      setBlockType('```\na\nb\n```', 0, 'paragraph').body,
      'a\nb',
    ),
    check('a list keeps its indent when re-typed', setBlockType('  - a', 0, 'task').body, '  - [ ] a'),
    check(
      'text after the target block is untouched',
      setBlockType('one\n    two\nthree', 1, 'paragraph').body,
      'one\n    two\nthree',
    ),
  );

  // ── toggleTask ─────────────────────────────────────────────────────────────
  results.push(
    check('toggle opens a task', toggleTask('- [ ] a', 0).body, '- [x] a'),
    check('toggle closes a task', toggleTask('- [x] a', 0).body, '- [ ] a'),
    check('toggle ignores non-tasks', toggleTask('- a', 0).body, '- a'),
  );

  // ── splitBlock: Enter ──────────────────────────────────────────────────────
  results.push(
    check('Enter splits a paragraph', splitBlock('hello world', 0, 5).body, 'hello\n world'),
    check('Enter mid-paragraph keeps both halves', splitBlock('a\nb', 0, 1).body, 'a\n\nb'),
    check('Enter continues a bullet', splitBlock('- one', 0, 5).body, '- one\n- '),
    check('Enter on an empty bullet leaves the list', splitBlock('- one\n- ', 1, 0).body, '- one\n'),
    check('Enter exits a list in the middle', splitBlock('- a\n- \n- b', 1, 0).body, '- a\n\n- b'),
    check('Enter on an empty to-do leaves the list', splitBlock('- [ ] ', 0, 0).body, ''),
    check('Enter on an empty quote leaves the quote', splitBlock('> a\n>', 1, 0).body, '> a\n'),
    check('Enter continues a numbered list at n+1', splitBlock('1. a', 0, 4).body, '1. a\n2. '),
    check('Enter continues a task as unchecked', splitBlock('- [x] a', 0, 7).body, '- [x] a\n- [ ] '),
    check('Enter continues a quote', splitBlock('> a', 0, 3).body, '> a\n>'),
    check('Enter continues the indent', splitBlock('  - a', 0, 5).body, '  - a\n  - '),
    check('Enter inside a fence adds a line, not a block', splitBlock('```\na\n```', 0, 4).body, '```\na\n\n```'),
    check('Enter keeps the caret at the head of the new block', splitBlock('hello', 0, 2).caret, 0),
    check('Enter focuses the new block', splitBlock('hello', 0, 2).focus, 1),
    check('Enter on a divider makes a paragraph below it', splitBlock('---', 0, 3).body, '---\n'),
    check('Enter at the end of a heading starts a paragraph', splitBlock('## a', 0, 4).body, '## a\n'),
    check('Enter inside a heading keeps a heading', splitBlock('## ab', 0, 1).body, '## a\n## b'),
    check('Enter on an empty heading starts a paragraph', splitBlock('# ', 0, 0).body, '# \n'),
  );

  // ── mergeWithPrevious: Backspace at the start ──────────────────────────────
  results.push(
    check('Backspace folds a block up', mergeWithPrevious('one\ntwo', 1).body, 'onetwo'),
    check('Backspace keeps the caret at the join', mergeWithPrevious('one\ntwo', 1).caret, 3),
    check('Backspace on the first block does nothing', mergeWithPrevious('one', 0).body, 'one'),
    check('Backspace will not eat a fence', mergeWithPrevious('```\na\n```', 1).body, '```\na\n```'),
  );

  // ── insert / remove / duplicate ────────────────────────────────────────────
  results.push(
    check('insert lands below and takes focus', insertBlock('one\ntwo', 0).body, 'one\n\ntwo'),
    check('insert focuses the new block', insertBlock('one\ntwo', 0).body && insertBlock('one\ntwo', 0).focus, 1),
    check('remove drops the block', removeBlock('one\ntwo', 1).body, 'one'),
    check('remove takes the children with it', removeBlock('- a\n  - a1\n- b', 0).body, '- b'),
    check('remove renumbers what is left', removeBlock('1. a\n2. b\n3. c', 1).body, '1. a\n2. c'),
    check('removing everything leaves one empty block', removeBlock('only', 0).body, ''),
    check('duplicate copies below itself', duplicateBlock('one\ntwo', 0).body, 'one\none\ntwo'),
    check('duplicate copies a subtree', duplicateBlock('- a\n  - a1', 0).body, '- a\n  - a1\n- a\n  - a1'),
  );

  // ── indent ─────────────────────────────────────────────────────────────────
  results.push(
    check('indent pushes a bullet in', indentBlock('- a', 0, 1).body, '  - a'),
    check('outdent pulls it back', indentBlock('  - a', 0, -1).body, '- a'),
    check('indent will not go below zero', indentBlock('- a', 0, -1).body, '- a'),
    check('indent stops at three', indentBlock('      - a', 0, 1).body, '      - a'),
    check('indent leaves a paragraph alone', indentBlock('text', 0, 1).body, 'text'),
  );

  // ── move ───────────────────────────────────────────────────────────────────
  results.push(
    check('move down swaps neighbours', moveBlock('one\ntwo\nthree', 0, 1).body, 'two\none\nthree'),
    check('move up swaps back', moveBlock('one\ntwo\nthree', 1, -1).body, 'two\none\nthree'),
    check('move down at the end is a no-op', moveBlock('one\ntwo', 1, 1).body, 'one\ntwo'),
    check('move up at the top is a no-op', moveBlock('one\ntwo', 0, -1).body, 'one\ntwo'),
    check('move follows the focused block', moveBlock('one\ntwo', 0, 1).focus, 1),
    check(
      'move takes the children along',
      moveBlock('- a\n  - a1\n- b', 0, 1).body,
      '- b\n- a\n  - a1',
    ),
    check('move renumbers a list', moveBlock('1. a\n2. b\n3. c', 2, -1).body, '1. a\n2. c\n3. b'),
  );

  // ── input rules, applied as you type ───────────────────────────────────────
  results.push(
    check('"# " becomes a heading', applyInputRules('# ', 'paragraph', 1), {
      type: 'heading',
      hashes: 1,
      text: '',
    }),
    check('"## " becomes a second-level heading', applyInputRules('## ', 'paragraph', 1)?.hashes, 2),
    check('"- " becomes a bullet', applyInputRules('- ', 'paragraph', 1)?.type, 'bullet'),
    check('"1. " becomes a numbered list', applyInputRules('1. ', 'paragraph', 1)?.type, 'numbered'),
    check('"[] " becomes a task', applyInputRules('[] ', 'paragraph', 1)?.type, 'task'),
    check('"> " becomes a quote', applyInputRules('> ', 'paragraph', 1)?.type, 'quote'),
    check('"---" becomes a divider', applyInputRules('---', 'paragraph', 1)?.type, 'divider'),
    check('plain text changes nothing', applyInputRules('hello', 'paragraph', 1), null),
    check('a shortcut mid-sentence does nothing', applyInputRules('say - ', 'paragraph', 1), null),
    check('rules apply inside a bullet too', applyInputRules('[] ', 'bullet', 1)?.type, 'task'),
  );

  // ── commitBlockText: what one keystroke tells us ───────────────────────────
  results.push(
    check('typing rewrites only the block it happened in', commitBlockText('one\ntwo', 1, 'two!').body, 'one\ntwo!'),
    check('typing keeps the marker it found', commitBlockText('* one', 0, 'one!').body, '* one!'),
    check('typing keeps the heading level', commitBlockText('### a', 0, 'ab').body, '### ab'),
    check('a newline starts the next block', commitBlockText('one', 0, 'one\ntwo').body, 'one\ntwo'),
    check('a newline focuses the block it made', commitBlockText('one', 0, 'one\ntwo').focus, 1),
    check('a pasted paragraph becomes several blocks', commitBlockText('x', 0, 'x\ny\nz').body, 'x\ny\nz'),
    check('a newline continues a list', commitBlockText('- a', 0, 'a\nb').body, '- a\n- b'),
    check('a newline continues a task unchecked', commitBlockText('- [x] a', 0, 'a\nb').body, '- [x] a\n- [ ] b'),
    check('a newline inside a fence is a line break', commitBlockText('```\na\n```', 0, 'a\nb').body, '```\na\nb\n```'),
    check('typing "# " turns a paragraph into a heading', commitBlockText('x', 0, '# ').body, '# '),
    check('typing "- " turns a paragraph into a bullet', commitBlockText('x', 0, '- ').body, '- '),
    check('typing "[] " turns a paragraph into a task', commitBlockText('x', 0, '[] ').body, '- [ ] '),
    check('typing "---" turns a paragraph into a divider', commitBlockText('x', 0, '---').body, '---'),
    check('a newline in an empty list item keeps the caret there', commitBlockText('- [ ] ', 0, '\n').focus, 0),
    check('a newline in an empty list item exits the list', commitBlockText('- [ ] ', 0, '\n').body, ''),
    check('a newline in a filled list item moves on', commitBlockText('- a', 0, 'a\n').focus, 1),
    check('typing text that only looks like a shortcut is left alone', commitBlockText('x', 0, 'a # b').body, 'a # b'),
  );

  // ── previews and extraction ────────────────────────────────────────────────
  results.push(
    check('preview skips an empty first block', plainPreview('\n\nHello there'), 'Hello there'),
    check('preview skips a divider', plainPreview('---\nReal text'), 'Real text'),
    check('preview strips inline marks', plainPreview('**bold** and `code`'), 'bold and code'),
    check('preview unwraps a wikilink', plainPreview('see [[Phase 2]]'), 'see Phase 2'),
    check('preview unwraps a markdown link', plainPreview('[docs](https://x.test)'), 'docs'),
    check('preview of an empty note is empty', plainPreview(''), ''),
    check('stripInline keeps prose', stripInline('a *b* c'), 'a b c'),
    check('visibleText drops block markers', visibleText('## Title\n- [ ] Buy milk'), 'Title\nBuy milk'),
    check('visibleText drops inline marks', visibleText('- **Bold** idea'), 'Bold idea'),
    check('visibleText keeps code as written', visibleText('```\nlet x = 1;\n```'), 'let x = 1;'),
    check('visibleText drops a divider', visibleText('a\n---\nb'), 'a\n\nb'),
    check('visibleText of an empty note is empty', visibleText(''), ''),
  );

  results.push(
    check('open tasks lists only unchecked ones', openTasks('- [ ] a\n- [x] b\n- [ ] c').map((t) => t.text), [
      'a',
      'c',
    ]),
    check('open tasks ignores empty ones', openTasks('- [ ] \n- [ ] real').map((t) => t.text), ['real']),
    check('open tasks knows where they are', openTasks('- [ ] a').map((t) => t.index), [0]),
  );

  results.push(
    check('wikilinks are found', noteRefs('see [[Phase 2]]'), ['Phase 2']),
    check('wikilink aliases are unwrapped', noteRefs('[[Phase 2|the plan]]'), ['Phase 2']),
    check('repeated links are listed once', noteRefs('[[a]] and [[A]]'), ['a']),
    check('links inside a fence still count', noteRefs('```\n[[a]]\n```'), ['a']),
    check('no links means no refs', noteRefs('nothing here'), []),
  );

  results.push(
    check('outline lists headings in order', outlineOf('# a\nx\n## b').map((h) => h.text), ['a', 'b']),
    check('outline records the level', outlineOf('# a').map((h) => h.hashes), [1]),
    check('outline records the block index', outlineOf('x\n# a').map((h) => h.index), [1]),
    check('outline skips an empty heading', outlineOf('# '), []),
  );

  // ── inline: what a reader sees ─────────────────────────────────────────────
  results.push(
    check('plain text is one span', parseInline('hello'), [{ kind: 'text', text: 'hello' }]),
    check('bold', parseInline('**b**'), [{ kind: 'bold', text: 'b' }]),
    check('underscore bold', parseInline('__b__'), [{ kind: 'bold', text: 'b' }]),
    check('italic', parseInline('*i*'), [{ kind: 'italic', text: 'i' }]),
    check('underscore italic', parseInline('_i_'), [{ kind: 'italic', text: 'i' }]),
    check('strike', parseInline('~~s~~'), [{ kind: 'strike', text: 's' }]),
    check('highlight', parseInline('==h=='), [{ kind: 'highlight', text: 'h' }]),
    check('code', parseInline('`c`'), [{ kind: 'code', text: 'c' }]),
    check('bold wraps italic', parseInline('***x***'), [{ kind: 'bold', text: '*x*' }]),
    check('a link becomes a span', parseInline('[a](https://x.test)'), [
      { kind: 'link', text: 'a', href: 'https://x.test' },
    ]),
    check('an empty link label falls back to the href', parseInline('[](https://x.test)'), [
      { kind: 'link', text: 'https://x.test', href: 'https://x.test' },
    ]),
    check('a wikilink becomes a span', parseInline('[[Phase 2]]'), [
      { kind: 'wikilink', text: 'Phase 2', target: 'Phase 2' },
    ]),
    check('a wikilink alias is displayed', parseInline('[[Phase 2|the plan]]'), [
      { kind: 'wikilink', text: 'the plan', target: 'Phase 2' },
    ]),
    check('snake_case is not italicised', parseInline('snake_case_name'), [
      { kind: 'text', text: 'snake_case_name' },
    ]),
    check('an unmatched star stays literal', parseInline('2 * 3'), [{ kind: 'text', text: '2 * 3' }]),
    check('a lone star pair stays literal', parseInline('**'), [{ kind: 'text', text: '**' }]),
    check('an escaped star draws a star', parseInline('\\*not italic\\*'), [
      { kind: 'text', text: '*not italic*' },
    ]),
    check('text around a mark is kept', parseInline('a **b** c'), [
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' c' },
    ]),
    check('bold does not swallow a following italic', parseInline('**a** *b*'), [
      { kind: 'bold', text: 'a' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'b' },
    ]),
    check('code is not recursive', parseInline('`**a**`'), [{ kind: 'code', text: '**a**' }]),
    check('the first two of three stars still close', parseInline('**a**b**c**'), [
      { kind: 'bold', text: 'a' },
      { kind: 'text', text: 'b' },
      { kind: 'bold', text: 'c' },
    ]),
  );

  // ── the format bar's arithmetic ────────────────────────────────────────────
  results.push(
    check('bold wraps a selection', toggleInline('hello', { start: 0, end: 5 }, '**'), {
      text: '**hello**',
      start: 2,
      end: 7,
    }),
    check('bold unwraps what it wrapped', toggleInline('**hello**', { start: 2, end: 7 }, '**'), {
      text: 'hello',
      start: 0,
      end: 5,
    }),
    check('bold toggles off from the outside', toggleInline('**hi**', { start: 0, end: 6 }, '**'), {
      text: 'hi',
      start: 0,
      end: 2,
    }),
    check('an empty selection drops in a pair', toggleInline('ab', { start: 1, end: 1 }, '**'), {
      text: 'a****b',
      start: 3,
      end: 3,
    }),
    check('italic wraps and unwraps', toggleInline('*i*', { start: 1, end: 2 }, '*').text, 'i'),
    check('strike wraps', toggleInline('x', { start: 0, end: 1 }, '~~').text, '~~x~~'),
    check('code wraps', toggleInline('x', { start: 0, end: 1 }, '`').text, '`x`'),
    check('highlight wraps', toggleInline('x', { start: 0, end: 1 }, '==').text, '==x=='),
    check('a backwards selection is clamped to the caret', toggleInline('abc', { start: 2, end: 0 }, '**'), {
      text: 'ab****c',
      start: 4,
      end: 4,
    }),
    check('wrap survives an out-of-range selection', toggleInline('ab', { start: 9, end: 12 }, '**').text, 'ab****'),
  );

  results.push(
    check('a link wraps a selection', applyLink('docs', { start: 0, end: 4 }, 'https://x.test'), {
      text: '[docs](https://x.test)',
      start: 0,
      end: '[docs](https://x.test)'.length,
    }),
    check('a link with no selection leaves the caret in the label', applyLink('ab', { start: 1, end: 1 }, 'https://x.test'), {
      text: 'a[](https://x.test)b',
      start: 2,
      end: 2,
    }),
    check(
      'a link re-points an existing link',
      applyLink('[docs](https://old.test)', { start: 0, end: '[docs](https://old.test)'.length }, 'https://new.test')
        .text,
      '[docs](https://new.test)',
    ),
    check('a link needs an href', applyLink('docs', { start: 0, end: 4 }, '  ').text, 'docs'),
  );

  results.push(
    check('bold is open inside its markers', activeMarks('**bo|ld**'.replace('|', ''), { start: 4, end: 4 }), ['bold']),
    check('nothing is open in plain text', activeMarks('plain', { start: 3, end: 3 }), []),
    check('italic is open inside its markers', activeMarks('*it*', { start: 3, end: 3 }), ['italic']),
    check('code is open inside a fence of backticks', activeMarks('`code`', { start: 4, end: 4 }), ['code']),
    check('strike is open inside its markers', activeMarks('~~s~~', { start: 3, end: 3 }), ['strike']),
    check('bold and italic are both open in a triple', activeMarks('***x***', { start: 4, end: 4 }), [
      'bold',
      'italic',
    ]),
    check('a closed pair is not open', activeMarks('**a** b', { start: 6, end: 6 }), []),
  );

  return results;
}
