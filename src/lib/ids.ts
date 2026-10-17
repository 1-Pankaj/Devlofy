/**
 * App-generated ids — no crypto module required, works on every runtime.
 *
 * nanoid's browser build needs `crypto.getRandomValues`, which Hermes does not
 * reliably provide; Web Crypto is used when available and Math.random
 * otherwise. Ids are local and never secret, so this is safe, and collisions
 * are negligible at personal-app scale.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function createId(size = 16): string {
  const bytes = new Uint8Array(size);
  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array } })
    .crypto;

  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < size; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let id = '';
  for (let index = 0; index < size; index += 1) {
    id += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return id;
}
