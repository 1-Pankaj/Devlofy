/**
 * Note tags — the one place that knows how they are stored.
 *
 * Notes keep tags as a comma-separated, lowercase, dash-joined list in
 * `notes.tags` (simple, searchable with LIKE, no join table). Everything
 * that reads or writes that column goes through these helpers.
 */

/** Parse the stored column into a clean list. */
export function splitTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const tag = normalizeTag(part);
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** Serialize a list back into the stored column (`null` when empty). */
export function serializeTags(tags: string[]): string | null {
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = normalizeTag(tag);
    if (clean) seen.add(clean);
  }
  const list = [...seen];
  return list.length > 0 ? list.join(',') : null;
}

/** `#API Refactor` → `api-refactor`. One tag, one word. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[,\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
