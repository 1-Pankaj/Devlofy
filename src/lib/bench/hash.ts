/**
 * SHA-1 and SHA-256, in pure TypeScript.
 *
 * Why not `expo-crypto`: it is correct and it is in Expo Go, but this app's rule
 * is that a new dependency has to buy something a screen cannot get another way
 * ([[07-decisions]] ADR-020's spirit). A digest is sixty lines of arithmetic
 * that is **verifiable** — `__verify.ts` in this folder checks both against the
 * published test vectors (`abc`, the empty string, the 448-bit boundary message,
 * and a 1,000,000-character string), which is a stronger guarantee than "a
 * library probably does it right". Web Crypto is used when the runtime offers it
 * anyway, so the hand-written path is the fallback, not the only path.
 *
 * Output is a byte array, like every other byte-level thing in `src/lib`
 * (`base64.ts`) — hex is a *rendering* choice, so `toHex` lives here and the
 * screen decides.
 */
import { utf8ToBytes } from '../base64';

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Rotate right, 32-bit. */
function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** Rotate left, 32-bit. */
function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/** The shared Merkle–Damgård padding: `0x80`, zeros, then a 64-bit big-endian bit count. */
function pad(bytes: number[]): number[] {
  const withOne = bytes.slice();
  withOne.push(0x80);
  while (withOne.length % 64 !== 56) withOne.push(0);
  const bits = bytes.length * 8;
  const high = Math.floor(bits / 4294967296);
  const low = bits >>> 0;
  for (const word of [high, low]) {
    withOne.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return withOne;
}

export function sha256(bytes: number[]): number[] {
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const message = pad(bytes);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const at = offset + index * 4;
      w[index] =
        ((message[at] << 24) | (message[at + 1] << 16) | (message[at + 2] << 8) | message[at + 3]) >>>
        0;
    }
    for (let index = 16; index < 64; index += 1) {
      const x = w[index - 15];
      const y = w[index - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let index = 0; index < 64; index += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const choice = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + s1 + choice + K256[index] + w[index]) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  const out: number[] = [];
  for (const word of hash) {
    out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return out;
}

export function sha1(bytes: number[]): number[] {
  const hash = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const message = pad(bytes);
  const w = new Uint32Array(80);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const at = offset + index * 4;
      w[index] =
        ((message[at] << 24) | (message[at + 1] << 16) | (message[at + 2] << 8) | message[at + 3]) >>>
        0;
    }
    for (let index = 16; index < 80; index += 1) {
      w[index] = rotl(w[index - 3] ^ w[index - 8] ^ w[index - 14] ^ w[index - 16], 1);
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];

    for (let index = 0; index < 80; index += 1) {
      let f: number;
      let k: number;
      if (index < 20) {
        f = ((b & c) | (~b & d)) >>> 0;
        k = 0x5a827999;
      } else if (index < 40) {
        f = (b ^ c ^ d) >>> 0;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = ((b & c) | (b & d) | (c & d)) >>> 0;
        k = 0x8f1bbcdc;
      } else {
        f = (b ^ c ^ d) >>> 0;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[index]) >>> 0;
      e = d;
      d = c;
      c = rotr(b, 2);
      b = a;
      a = temp;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
  }

  const out: number[] = [];
  for (const word of hash) {
    out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return out;
}

export function toHex(bytes: number[]): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export type Algorithm = 'SHA-1' | 'SHA-256';

export const ALGORITHMS: Algorithm[] = ['SHA-256', 'SHA-1'];

export function hashText(text: string, algorithm: Algorithm): string {
  const bytes = utf8ToBytes(text);
  return toHex(algorithm === 'SHA-256' ? sha256(bytes) : sha1(bytes));
}
