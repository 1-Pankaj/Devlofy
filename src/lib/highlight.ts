/**
 * A small syntax highlighter, because a code view that is one flat colour is a
 * text file, not a code view.
 *
 * Three deliberate choices:
 *
 *  - **No dependency.** `react-syntax-highlighter` ships its own themes with
 *    pinned hex colours, which would be the only hardcoded colours in this app.
 *    A tokenizer that emits *kinds* lets the component colour from `src/theme`,
 *    so the code view is dark-mode-correct by construction.
 *  - **Line at a time.** There is no grammar here, no parsing, no state between
 *    lines. That is enough for reading code on a tablet, and it means one bad
 *    regex can only mis-colour one line.
 *  - **Honest about scope.** A handful of languages are understood properly;
 *    everything else falls back to the generic code rules, which is still
 *    monospaced and still readable.
 */

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'function'
  | 'type'
  | 'property'
  | 'punctuation'
  | 'heading'
  | 'link'
  | 'tag'
  | 'attribute';

export type Token = { kind: TokenKind; text: string };

export type HighlightLanguage =
  | 'code'
  | 'json'
  | 'markdown'
  | 'css'
  | 'html'
  | 'yaml'
  | 'python'
  | 'shell'
  | 'sql'
  | 'plain';

/** The common core of C-family languages, plus enough Go/Rust/Kotlin/Python. */
const CODE_KEYWORDS = [
  'abstract', 'and', 'as', 'assert', 'async', 'await', 'base', 'break', 'case',
  'catch', 'class', 'const', 'constructor', 'continue', 'def', 'default', 'del',
  'delete', 'do', 'dyn', 'elif', 'else', 'enum', 'except', 'export', 'extends',
  'false', 'final', 'finally', 'fn', 'for', 'from', 'func', 'function', 'global',
  'go', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'is',
  'lambda', 'let', 'local', 'match', 'mod', 'mut', 'new', 'nil', 'None', 'nonlocal',
  'not', 'null', 'of', 'or', 'override', 'package', 'pass', 'private', 'protected',
  'pub', 'public', 'raise', 'readonly', 'return', 'self', 'static', 'struct',
  'super', 'switch', 'satisfies', 'then', 'this', 'throw', 'trait', 'true', 'try',
  'True', 'False', 'type', 'typeof', 'undefined', 'union', 'use', 'val', 'var',
  'void', 'where', 'while', 'with', 'yield', 'impl', 'unsafe', 'defer', 'extern',
];

const PYTHON_KEYWORDS = [
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass',
  'raise', 'return', 'True', 'try', 'while', 'with', 'yield', 'self',
];

const SHELL_KEYWORDS = [
  'alias', 'case', 'cd', 'do', 'done', 'echo', 'elif', 'else', 'esac', 'exit',
  'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'read', 'return', 'set',
  'source', 'then', 'unset', 'while',
];

const SQL_KEYWORDS = [
  'add', 'all', 'alter', 'and', 'as', 'asc', 'begin', 'by', 'case', 'column',
  'commit', 'constraint', 'create', 'default', 'delete', 'desc', 'distinct', 'drop',
  'else', 'exists', 'foreign', 'from', 'group', 'having', 'if', 'in', 'index',
  'inner', 'insert', 'into', 'join', 'key', 'left', 'like', 'limit', 'not', 'null',
  'offset', 'on', 'or', 'order', 'outer', 'primary', 'references', 'right', 'rollback',
  'select', 'set', 'table', 'then', 'union', 'unique', 'update', 'values', 'when',
  'where', 'with',
];

function keywordPattern(words: string[]): RegExp {
  return new RegExp(`(?:${words.join('|')})\\b`, 'y');
}

type Rule = { kind: TokenKind; pattern: RegExp };

const STRING_RULE: Rule = {
  kind: 'string',
  pattern: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/y,
};
const NUMBER_RULE: Rule = {
  kind: 'number',
  pattern: /0[xX][0-9a-fA-F]+|0[bB][01]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?/y,
};
const IDENTIFIER_RULE: Rule = { kind: 'plain', pattern: /[A-Za-z_$][\w$]*/y };
const PUNCTUATION_RULE: Rule = { kind: 'punctuation', pattern: /[{}()[\];,.:?+\-*/%=<>!&|^~@]+/y };
const SPACE_RULE: Rule = { kind: 'plain', pattern: /[^\S\n]+/y };

function codeRules(language: HighlightLanguage): Rule[] {
  const keywords =
    language === 'python'
      ? PYTHON_KEYWORDS
      : language === 'shell'
        ? SHELL_KEYWORDS
        : language === 'sql'
          ? SQL_KEYWORDS
          : CODE_KEYWORDS;

  const rules: Rule[] = [
    { kind: 'comment', pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    STRING_RULE,
    NUMBER_RULE,
    { kind: 'keyword', pattern: keywordPattern(keywords) },
    // `name(` reads as a call; a capitalised bare word reads as a type.
    { kind: 'function', pattern: /[A-Za-z_$][\w$]*(?=\s*\()/y },
    { kind: 'type', pattern: /[A-Z][A-Za-z0-9_]*/y },
    IDENTIFIER_RULE,
    PUNCTUATION_RULE,
    SPACE_RULE,
  ];

  // `#` comments are real in Python, shell, YAML and Ruby — not in T-SQL.
  if (language !== 'sql') rules.splice(1, 0, { kind: 'comment', pattern: /#[^\n]*/y });
  return rules;
}

function jsonRules(): Rule[] {
  return [
    { kind: 'property', pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/y },
    STRING_RULE,
    NUMBER_RULE,
    { kind: 'keyword', pattern: /(?:true|false|null)\b/y },
    PUNCTUATION_RULE,
    SPACE_RULE,
    IDENTIFIER_RULE,
  ];
}

function markdownRules(): Rule[] {
  return [
    { kind: 'heading', pattern: /^\s{0,3}#{1,6}\s[^\n]*/y },
    { kind: 'punctuation', pattern: /^\s{0,3}(?:[-*+]|\d+\.)\s/y },
    { kind: 'comment', pattern: /^\s{0,3}>[^\n]*/y },
    { kind: 'punctuation', pattern: /^\s*```[^\n]*/y },
    { kind: 'string', pattern: /`[^`\n]*`/y },
    { kind: 'link', pattern: /!?\[[^\]\n]*\]\([^)\n]*\)/y },
    { kind: 'keyword', pattern: /\*\*[^*\n]+\*\*|__[^_\n]+__/y },
    { kind: 'property', pattern: /(?:https?:\/\/|\/)[^\s)\]]+/y },
    SPACE_RULE,
  ];
}

function htmlRules(): Rule[] {
  return [
    { kind: 'comment', pattern: /<!--[\s\S]*?-->/y },
    { kind: 'tag', pattern: /<\/?[A-Za-z][\w:-]*/y },
    { kind: 'attribute', pattern: /[A-Za-z-]+(?==)/y },
    STRING_RULE,
    { kind: 'punctuation', pattern: /\/?>/y },
    SPACE_RULE,
  ];
}

function cssRules(): Rule[] {
  return [
    { kind: 'comment', pattern: /\/\*[\s\S]*?\*\//y },
    { kind: 'keyword', pattern: /@[A-Za-z-]+/y },
    { kind: 'property', pattern: /[A-Za-z-]+(?=\s*:)/y },
    { kind: 'number', pattern: /#[0-9a-fA-F]{3,8}\b|\d[\d.]*(?:px|rem|em|%|vh|vw|s|ms|deg)?/y },
    STRING_RULE,
    { kind: 'punctuation', pattern: /[{}();:,>+~*]/y },
    SPACE_RULE,
  ];
}

function yamlRules(): Rule[] {
  return [
    { kind: 'comment', pattern: /#[^\n]*/y },
    { kind: 'property', pattern: /^[ \t-]*[A-Za-z_.][\w.\- ]*(?=\s*:)/y },
    STRING_RULE,
    NUMBER_RULE,
    { kind: 'keyword', pattern: /(?:true|false|null|yes|no|on|off)\b/iy },
    { kind: 'punctuation', pattern: /^[ \t]*-|[:|>-]/y },
    SPACE_RULE,
    IDENTIFIER_RULE,
  ];
}

function rulesFor(language: HighlightLanguage): Rule[] {
  switch (language) {
    case 'json':
      return jsonRules();
    case 'markdown':
      return markdownRules();
    case 'html':
      return htmlRules();
    case 'css':
      return cssRules();
    case 'yaml':
      return yamlRules();
    case 'plain':
      return [];
    default:
      return codeRules(language);
  }
}

/** Extension → language. Unknown extensions fall back to the generic rules. */
export function languageOf(pathOrName: string): HighlightLanguage {
  const name = (pathOrName.split('/').pop() ?? '').toLowerCase();
  if (name === 'makefile' || name === 'dockerfile' || name.startsWith('dockerfile.'))
    return 'shell';
  if (name === '.gitignore' || name === '.env' || name === '.npmrc') return 'shell';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';

  switch (ext) {
    case 'json':
    case 'jsonc':
    case 'geojson':
      return 'json';
    case 'md':
    case 'mdx':
    case 'markdown':
      return 'markdown';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'html':
    case 'htm':
    case 'xml':
    case 'svg':
    case 'vue':
      return 'html';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'py':
    case 'pyi':
      return 'python';
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
    case 'env':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'txt':
    case 'log':
    case 'csv':
    case 'lock':
    case 'glb':
    case 'png':
    case 'jpg':
      return 'plain';
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
    case 'go':
    case 'rs':
    case 'java':
    case 'kt':
    case 'kts':
    case 'swift':
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cs':
    case 'php':
    case 'rb':
    case 'dart':
    case 'lua':
    case 'toml':
    case 'ini':
    case 'gradle':
      return 'code';
    default:
      return ext.length > 0 ? 'code' : 'plain';
  }
}

/** One line → tokens. Never throws, always covers the line exactly once. */
export function tokenizeLine(line: string, language: HighlightLanguage): Token[] {
  if (language === 'plain' || line.length === 0) {
    return line.length > 0 ? [{ kind: 'plain', text: line }] : [];
  }

  const rules = rulesFor(language);
  const tokens: Token[] = [];
  let index = 0;

  while (index < line.length) {
    let matched = false;
    for (const rule of rules) {
      rule.pattern.lastIndex = index;
      const match = rule.pattern.exec(line);
      if (match && match[0].length > 0 && match.index === index) {
        const text = match[0];
        const last = tokens[tokens.length - 1];
        if (last && last.kind === rule.kind) last.text += text;
        else tokens.push({ kind: rule.kind, text });
        index += text.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = tokens[tokens.length - 1];
      const char = line[index];
      if (last && last.kind === 'plain') last.text += char;
      else tokens.push({ kind: 'plain', text: char });
      index += 1;
    }
  }

  return tokens;
}
