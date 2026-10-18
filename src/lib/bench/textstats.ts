/**
 * Text: how big is it, and what shape should it be.
 *
 * Counting is done on **code points** where it matters (`[...text]`, not
 * `text.length`), because an emoji is one character to a human and two to
 * JavaScript; and UTF-8 byte counts use the same `utf8ToBytes` the GitHub layer
 * uses, so "bytes" means one thing everywhere in this app. Case conversion is
 * grammar-driven (camelCase transitions and separators both split words) so
 * `getUserID` and `get_user_id` produce the same `GetUserId`.
 */
import { utf8ToBytes } from '../base64';

export type TextStats = {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
  readingMinutes: number;
};

export function textStats(text: string): TextStats {
  const characters = [...text].length;
  const trimmed = text.trim();

  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const lines = text ? text.split('\n').length : 0;
  const sentences = trimmed ? (trimmed.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) ?? []).length : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((part) => part.trim()).length : 0;

  return {
    characters,
    charactersNoSpaces: [...text.replace(/\s/g, '')].length,
    words,
    lines,
    sentences,
    paragraphs,
    bytes: utf8ToBytes(text).length,
    // 200 words a minute is the usual middle; rounding up because a half-minute
    // of reading is still a minute of your time.
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
  };
}

/** Splits on separators *and* camelCase humps, keeping acronyms in one piece. */
export function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

export type CaseName =
  | 'upper'
  | 'lower'
  | 'title'
  | 'sentence'
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant';

export const CASES: CaseName[] = [
  'upper',
  'lower',
  'title',
  'sentence',
  'camel',
  'pascal',
  'snake',
  'kebab',
  'constant',
];

export function toCase(text: string, style: CaseName): string {
  const parts = words(text);
  const lowercased = parts.map((word) => word.toLowerCase());
  switch (style) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return parts.map(capitalize).join(' ');
    case 'sentence':
      return parts.map((word) => word.toLowerCase()).join(' ').replace(/^./, (c) => c.toUpperCase());
    case 'camel':
      return lowercased.map((word, index) => (index === 0 ? word : capitalize(word))).join('');
    case 'pascal':
      return lowercased.map(capitalize).join('');
    case 'snake':
      return lowercased.join('_');
    case 'kebab':
      return lowercased.join('-');
    case 'constant':
      return lowercased.join('_').toUpperCase();
    default:
      return text;
  }
}

/** Diacritics folded, punctuation dropped — a URL segment, not a sentence. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type DuplicateHint = {
  nonEmptyLines: number;
  uniqueLines: number;
  duplicateLines: number;
  longestLine: number;
};

/** "Did I paste the same thing twice" — a real question when pasting lists. */
export function lineFacts(text: string): DuplicateHint {
  const lines = text.split('\n').filter((line) => line.trim());
  const unique = new Set(lines);
  return {
    nonEmptyLines: lines.length,
    uniqueLines: unique.size,
    duplicateLines: lines.length - unique.size,
    longestLine: lines.reduce((longest, line) => Math.max(longest, [...line].length), 0),
  };
}
