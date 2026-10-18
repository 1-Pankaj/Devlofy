/**
 * Encode / decode: base64 (standard and URL-safe), percent-encoding, HTML
 * entities.
 *
 * The byte work is `src/lib/base64.ts` — the same functions the GitHub layer
 * reads and writes files with, so "base64" means one thing in this app. What is
 * added here is the part a *tool* needs and a transport does not: telling the
 * truth about junk input. `base64ToBytes` deliberately tolerates newlines and
 * skips what it cannot read, which is right for a file and wrong for a decoder
 * that is supposed to tell you the string was malformed — so the skipped
 * characters are counted and reported instead of silently dropped.
 */
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../base64';

export type Codec = 'base64' | 'base64url' | 'url' | 'html';

export type CodecInfo = { id: Codec; label: string; note: string };

export const CODECS: CodecInfo[] = [
  { id: 'base64', label: 'Base64', note: 'standard alphabet, padded' },
  { id: 'base64url', label: 'Base64url', note: 'URL-safe alphabet, no padding (JWT)' },
  { id: 'url', label: 'URL', note: 'percent-encoding for one value' },
  { id: 'html', label: 'HTML entities', note: 'named and numeric' },
];

export type TextResult =
  | { ok: true; text: string; note?: string }
  | { ok: false; message: string };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toUrlSafe(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toStandard(input: string): string {
  return input.replace(/-/g, '+').replace(/_/g, '/');
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  times: '×',
  divide: '÷',
  deg: '°',
  middot: '·',
  bull: '•',
  eacute: 'é',
  euro: '€',
  pound: '£',
  yen: '¥',
  rupee: '₹',
};

export function encode(text: string, codec: Codec): TextResult {
  switch (codec) {
    case 'base64':
      return { ok: true, text: bytesToBase64(utf8ToBytes(text)) };
    case 'base64url':
      return { ok: true, text: toUrlSafe(bytesToBase64(utf8ToBytes(text))) };
    case 'url':
      return { ok: true, text: encodeURIComponent(text) };
    case 'html':
      return {
        ok: true,
        text: text.replace(/[&<>"']/g, (char) => {
          switch (char) {
            case '&':
              return '&amp;';
            case '<':
              return '&lt;';
            case '>':
              return '&gt;';
            case '"':
              return '&quot;';
            default:
              return '&#39;';
          }
        }),
      };
    default:
      return { ok: false, message: 'Unknown codec.' };
  }
}

export function decode(text: string, codec: Codec): TextResult {
  switch (codec) {
    case 'base64':
    case 'base64url': {
      const standard = toStandard(text.replace(/\s+/g, ''));
      const alphabet = codec === 'base64url' ? URL_ALPHABET : ALPHABET;
      const alphabetPlusQueue = `${alphabet}=`;
      let skipped = 0;
      for (const char of standard) if (!alphabetPlusQueue.includes(char)) skipped += 1;

      const decoded = bytesToUtf8(base64ToBytes(standard));
      if (skipped > 0) {
        return {
          ok: true,
          text: decoded,
          note: `${skipped} character${skipped === 1 ? '' : 's'} were not valid and were skipped.`,
        };
      }
      return { ok: true, text: decoded };
    }
    case 'url': {
      try {
        return { ok: true, text: decodeURIComponent(text) };
      } catch {
        return { ok: false, message: 'That is not valid percent-encoding (a lone % or a bad byte).' };
      }
    }
    case 'html': {
      let unknown = 0;
      const out = text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
        if (body.startsWith('#')) {
          const hex = body[1] === 'x' || body[1] === 'X';
          const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
          if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
            unknown += 1;
            return match;
          }
          return String.fromCodePoint(code);
        }
        const value = ENTITIES[body.toLowerCase()];
        if (value === undefined) {
          unknown += 1;
          return match;
        }
        return value;
      });
      return unknown > 0
        ? { ok: true, text: out, note: `${unknown} entity name${unknown === 1 ? '' : 's'} were left as written.` }
        : { ok: true, text: out };
    }
    default:
      return { ok: false, message: 'Unknown codec.' };
  }
}

/** A truncated, single-line preview for a shelf row — never a wall of text. */
export function previewOf(text: string, length = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}
