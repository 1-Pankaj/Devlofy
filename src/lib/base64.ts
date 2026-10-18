/**
 * Base64 and UTF-8 — owned here rather than borrowed from the platform.
 *
 * GitHub's Contents API speaks base64, and it hands it back with a newline every
 * 60 characters. Hermes has no `atob`/`btoa` and no guaranteed `TextEncoder`, and
 * the web build has all three but with subtly different behaviour for non-ASCII
 * text (which is exactly the case a README in Hindi, or an emoji in a commit
 * message, will hit). Every file read and every file write in this app goes
 * through these two conversions, so they live in one place and are boring on
 * purpose.
 *
 * Bytes are plain `number[]` (0–255). Files here are text and small; there is no
 * streaming path because there is nothing to stream to.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 alphabet with the URL-safe substitutions GitHub sometimes emits. */
const LOOKUP: Record<string, number> = (() => {
  const table: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i += 1) table[ALPHABET[i]] = i;
  table['-'] = 62;
  table['_'] = 63;
  return table;
})();

export function utf8ToBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);

    // Surrogate pair → one code point above the BMP.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i += 1;
      }
    }

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

export function bytesToUtf8(bytes: number[]): string {
  let out = '';
  let chunk = '';
  for (let i = 0; i < bytes.length; ) {
    const first = bytes[i];
    let code: number;
    let width: number;

    if (first < 0x80) {
      code = first;
      width = 1;
    } else if ((first & 0xe0) === 0xc0) {
      code = first & 0x1f;
      width = 2;
    } else if ((first & 0xf0) === 0xe0) {
      code = first & 0x0f;
      width = 3;
    } else if ((first & 0xf8) === 0xf0) {
      code = first & 0x07;
      width = 4;
    } else {
      // Not a lead byte: skip it rather than emitting garbage.
      i += 1;
      continue;
    }

    if (i + width > bytes.length) break;
    for (let k = 1; k < width; k += 1) code = (code << 6) | (bytes[i + k] & 0x3f);
    i += width;

    if (code > 0xffff) {
      const adjusted = code - 0x10000;
      chunk += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    } else {
      chunk += String.fromCharCode(code);
    }

    // Flush in blocks: `String.fromCharCode(...arr)` on a big file blows the stack.
    if (chunk.length >= 8192) {
      out += chunk;
      chunk = '';
    }
  }
  return out + chunk;
}

export function bytesToBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const c = i + 2 < bytes.length ? bytes[i + 2] : -1;

    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 0x03) << 4) | (b < 0 ? 0 : b >> 4)];
    out += b < 0 ? '=' : ALPHABET[((b & 0x0f) << 2) | (c < 0 ? 0 : c >> 6)];
    out += c < 0 ? '=' : ALPHABET[c & 0x3f];
  }
  return out;
}

/** Tolerant of GitHub's embedded newlines, missing padding, and URL-safe output. */
export function base64ToBytes(input: string): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '=') break;
    const value = LOOKUP[char];
    if (value === undefined) continue; // whitespace, or something we don't know
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

/**
 * A file we should not pretend to edit. GitHub tells us the size, but not
 * whether the bytes are text, so we look for a NUL in the head of the file —
 * the same test `git` uses, and the one that catches PNGs and GLBs.
 */
export function looksBinary(bytes: number[]): boolean {
  const window = Math.min(bytes.length, 8000);
  for (let i = 0; i < window; i += 1) {
    if (bytes[i] === 0) return true;
  }
  return false;
}
