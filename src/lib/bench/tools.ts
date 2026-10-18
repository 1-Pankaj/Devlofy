/**
 * The Bench shelf: which tools exist, what they are for, and how they group.
 *
 * One list, imported by both the shelf and the tool host, so a tool can never
 * exist in the navigation without existing in the registry (and vice versa). The
 * `keywords` are what the shelf filters on, which is why "hash" also carries
 * "sha256", "md5" and "checksum" — people type the thing they want, not the
 * name you gave it.
 */
import type { Icon } from 'phosphor-react-native';
import {
  ArrowsLeftRight,
  BracketsCurly,
  Clock,
  Database,
  GitDiff,
  Hash,
  Key,
  MagnifyingGlass,
  Palette,
  TextAa,
  Timer,
} from 'phosphor-react-native';

export type BenchGroup = 'data' | 'text' | 'time' | 'security' | 'design';

/** Every tool id, as a union — so the router map can be exhaustive. */
export type BenchToolId =
  | 'json'
  | 'sql'
  | 'diff'
  | 'regex'
  | 'text'
  | 'encode'
  | 'jwt'
  | 'hash'
  | 'epoch'
  | 'cron'
  | 'colour';

export type BenchTool = {
  id: BenchToolId;
  name: string;
  blurb: string;
  group: BenchGroup;
  icon: Icon;
  keywords: string[];
};

export const BENCH_GROUPS: { id: BenchGroup; label: string; blurb: string }[] = [
  { id: 'data', label: 'Data', blurb: 'shape it, read it, compare it' },
  { id: 'text', label: 'Text', blurb: 'find it, count it, convert it' },
  { id: 'security', label: 'Security', blurb: 'look inside a token, digest it' },
  { id: 'time', label: 'Time', blurb: 'timestamps and schedules' },
  { id: 'design', label: 'Design', blurb: 'colour, and whether it is readable' },
];

export const BENCH_TOOLS: BenchTool[] = [
  {
    id: 'json',
    name: 'JSON',
    blurb: 'Check, format, shrink, sort, and turn a sample into types',
    group: 'data',
    icon: BracketsCurly,
    keywords: ['json', 'format', 'minify', 'validate', 'types', 'typescript', 'sort', 'prettify'],
  },
  {
    id: 'sql',
    name: 'SQL',
    blurb: 'Re-indent a statement and upper-case its keywords',
    group: 'data',
    icon: Database,
    keywords: ['sql', 'query', 'format', 'postgres', 'sqlite', 'mysql'],
  },
  {
    id: 'diff',
    name: 'Diff',
    blurb: 'Two texts in, the exact line changes out',
    group: 'data',
    icon: GitDiff,
    keywords: ['diff', 'compare', 'patch', 'changes', 'delta', 'merge'],
  },
  {
    id: 'regex',
    name: 'Regex',
    blurb: 'Try a pattern: matches, groups, and a replace preview',
    group: 'text',
    icon: MagnifyingGlass,
    keywords: ['regex', 'regexp', 'pattern', 'match', 'replace', 'groups'],
  },
  {
    id: 'text',
    name: 'Text',
    blurb: 'Counts, case conversions and a slug',
    group: 'text',
    icon: TextAa,
    keywords: ['text', 'count', 'words', 'case', 'camel', 'snake', 'slug', 'stats'],
  },
  {
    id: 'encode',
    name: 'Encode',
    blurb: 'Base64 (and url-safe), percent-encoding, HTML entities',
    group: 'text',
    icon: ArrowsLeftRight,
    keywords: ['base64', 'encode', 'decode', 'url', 'percent', 'html', 'entities', 'atob', 'btoa'],
  },
  {
    id: 'jwt',
    name: 'JWT',
    blurb: 'Read a token’s header and claims — not verify it',
    group: 'security',
    icon: Key,
    keywords: ['jwt', 'token', 'bearer', 'claims', 'oauth', 'decode', 'json web token'],
  },
  {
    id: 'hash',
    name: 'Hashes',
    blurb: 'SHA-256 and SHA-1, checked against the published vectors',
    group: 'security',
    icon: Hash,
    keywords: ['hash', 'sha256', 'sha1', 'sha', 'digest', 'checksum', 'integrity'],
  },
  {
    id: 'epoch',
    name: 'Timestamps',
    blurb: 'Epoch seconds, milliseconds and ISO, all at once',
    group: 'time',
    icon: Clock,
    keywords: ['epoch', 'timestamp', 'unix', 'date', 'iso', 'utc', 'time', 'convert'],
  },
  {
    id: 'cron',
    name: 'Cron',
    blurb: 'What a cron expression means, and its next five runs',
    group: 'time',
    icon: Timer,
    keywords: ['cron', 'crontab', 'schedule', 'interval', 'job', 'timer'],
  },
  {
    id: 'colour',
    name: 'Colour',
    blurb: 'Parse it, ramp it, and prove the contrast it needs',
    group: 'design',
    icon: Palette,
    keywords: ['colour', 'color', 'hex', 'rgb', 'hsl', 'contrast', 'wcag', 'accessibility', 'ramp'],
  },
];

export function toolById(id: string | undefined): BenchTool | null {
  if (!id) return null;
  return BENCH_TOOLS.find((tool) => tool.id === id) ?? null;
}

export function toolsInGroup(group: BenchGroup): BenchTool[] {
  return BENCH_TOOLS.filter((tool) => tool.group === group);
}

export function searchTools(query: string): BenchTool[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return BENCH_TOOLS;
  return BENCH_TOOLS.filter(
    (tool) =>
      tool.name.toLowerCase().includes(needle) ||
      tool.blurb.toLowerCase().includes(needle) ||
      tool.keywords.some((keyword) => keyword.includes(needle)),
  );
}

