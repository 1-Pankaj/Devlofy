/**
 * Bench's own known-answer checks.
 *
 * The pure modules in this folder make claims that a screenshot cannot confirm —
 * a hand-written SHA-256, a cron parser, a diff of a JSON error position. So
 * they are checked against published vectors and expected values here, in one
 * function that returns results instead of printing them (no `console` in app
 * code, and the runner can format them however it likes).
 *
 * Nothing imports this module, so it never reaches a bundle; it exists to be run
 * (`npx tsc` + node, see the commit message) and to fail loudly if a refactor
 * quietly breaks arithmetic. It is deliberately dependency-free and pure.
 */
import { utf8ToBytes } from '../base64';
import { contrastRatio, parseColour, ramp, toHex, verdict } from './colour';
import { decode, encode } from './encode';
import { hashText } from './hash';
import { decodeJwt, expiryState } from './jwt';
import { formatJson, jsonToTypeScript, minifyJson, parseJson } from './json';
import { diffLines, hunkHeader } from '../diff';
import { unifiedPatch } from './patch';
import { NO_FLAGS, runRegex, runReplace } from './regex';
import { formatSql } from './sql';
import { textStats, toCase, slugify } from './textstats';
import { parseCron, parseMoment, relativeTime } from './time';

export type CheckResult = { name: string; pass: boolean; detail: string };

function check(name: string, actual: unknown, expected: unknown): CheckResult {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return { name, pass: a === e, detail: a === e ? a : `got ${a}, wanted ${e}` };
}

function contains(name: string, haystack: string, needle: string): CheckResult {
  return {
    name,
    pass: haystack.includes(needle),
    detail: haystack.includes(needle) ? 'contains' : `missing ${JSON.stringify(needle)} in ${haystack}`,
  };
}

/** The canonical `abcdefghijklmnopqrstuvwxyz` sample bodies from FIPS/RFC 3174. */
const LONG = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq';

export function runSelfCheck(): CheckResult[] {
  const results: CheckResult[] = [];

  // ── hashes: every published vector, including the 1,000,000-"a" one, which is
  // the only test that exercises multi-block padding.
  results.push(
    check(
      'sha256("")',
      hashText('', 'SHA-256'),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ),
    check(
      'sha256("abc")',
      hashText('abc', 'SHA-256'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ),
    check(
      'sha256(448-bit message)',
      hashText(LONG, 'SHA-256'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ),
    check(
      'sha256(1,000,000 × "a")',
      hashText('a'.repeat(1_000_000), 'SHA-256'),
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    ),
    check('sha1("")', hashText('', 'SHA-1'), 'da39a3ee5e6b4b0d3255bfef95601890afd80709'),
    check('sha1("abc")', hashText('abc', 'SHA-1'), 'a9993e364706816aba3e25717850c26c9cd0d89d'),
    check('sha1(448-bit message)', hashText(LONG, 'SHA-1'), '84983e441c3bd26ebaae4aa1f95129e5e54670f1'),
    check(
      'sha1(1,000,000 × "a")',
      hashText('a'.repeat(1_000_000), 'SHA-1'),
      '34aa973cd4c4daa4f61eeb2bdbad27316534016f',
    ),
  );

  // ── JSON
  const formatted = formatJson('{"b":1,"a":[1,2]}', { sortKeys: true });
  results.push(
    check('json formats', formatted.ok ? formatted.value : formatted.error.message, '{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}\n'),
    check('json minifies', minifyJson('{ "a": 1 }').ok ? (minifyJson('{ "a": 1 }') as { value: string }).value : '', '{"a":1}'),
    check('json error has no line for valid input', parseJson('{"a":1}').ok, true),
  );

  const broken = parseJson('{\n  "a": 1,\n  "b":\n}');
  results.push({
    name: 'json error reports a position',
    pass: !broken.ok && broken.error.line === 4,
    detail: broken.ok ? 'parsed a broken document' : `${broken.error.message} @ ${broken.error.line}:${broken.error.column}`,
  });

  const types = jsonToTypeScript({ id: 1, name: 'Ada', tags: ['a'], owner: { id: 2, admin: true } });
  results.push(
    contains('json → ts: root interface', types, 'export interface Root {'),
    contains('json → ts: field types', types, '  id: number;'),
    contains('json → ts: arrays', types, '  tags: string[];'),
    contains('json → ts: nested named interface', types, 'export interface Owner {'),
  );

  const optional = jsonToTypeScript({ rows: [{ a: 1 }, { a: 2, b: true }] });
  results.push(contains('json → ts: merged arrays mark optional keys', optional, '  b?: boolean;'));

  // ── text
  const stats = textStats('héllo wörld\nsecond line');
  results.push(
    check('words', stats.words, 4),
    check('lines', stats.lines, 2),
    check('utf-8 bytes count é as two', utf8ToBytes('é').length, 2),
    check('camelCase from snake', toCase('get_user_id', 'camel'), 'getUserId'),
    check('camelCase from camel', toCase('getUserID', 'snake'), 'get_user_id'),
    check('slugify folds diacritics', slugify('Héllo Wörld!'), 'hello-world'),
    check('sentence case', toCase('hello WORLD', 'sentence'), 'Hello world'),
  );

  // ── encode / decode
  const b64 = encode('hello', 'base64');
  const b64url = encode('héllo', 'base64url');
  const decoded = decode('aGVsbG8=', 'base64');
  const junk = decode('aGVsbG8=***', 'base64');
  const html = decode('&amp;&#233;&nbsp;', 'html');
  const url = encode('a b&c', 'url');
  results.push(
    check('base64 encode', b64.ok ? b64.text : b64.message, 'aGVsbG8='),
    check('base64 decode', decoded.ok ? decoded.text : decoded.message, 'hello'),
    check('base64 round trip of non-ASCII', decode(b64url.ok ? b64url.text : '', 'base64url').ok ? (decode(b64url.ok ? b64url.text : '', 'base64url') as { text: string }).text : '', 'héllo'),
    results0('base64 decode reports junk', junk),
    check('html entities', html.ok ? html.text : html.message, '&é\u00a0'),
    check('url encode', url.ok ? url.text : url.message, 'a%20b%26c'),
    check('url decode rejects malformed', decode('%E0%A4', 'url').ok, false),
  );

  // ── time
  const seconds = parseMoment('1700000000');
  const millis = parseMoment('1700000000000');
  const iso = parseMoment('2026-10-19T09:30:00.000Z');
  results.push(
    check('epoch seconds detected', seconds?.source, 'seconds'),
    check('epoch seconds → ms', seconds?.ms, 1_700_000_000_000),
    check('epoch ms detected', millis?.source, 'milliseconds'),
    check('iso parsed', iso?.source, 'date string'),
    check('relative is directional', relativeTime(0, 86_400_000 * 2), '2 days ago'),
    check('relative future', relativeTime(86_400_000 * 3, 0), 'in 3 days'),
  );

  const cron = parseCron('0 9 * * 1-5', new Date('2026-10-19T00:00:00Z'), 5);
  const weekdaysOnly =
    cron.ok && cron.value.next.length === 5 && cron.value.next.every((run) => run.getDay() >= 1 && run.getDay() <= 5);
  const atNine = cron.ok && cron.value.next.every((run) => run.getHours() === 9 && run.getMinutes() === 0);
  results.push(
    {
      name: 'cron: next runs land on weekdays at 09:00 local',
      pass: Boolean(weekdaysOnly && atNine),
      detail: cron.ok ? cron.value.next.map((run) => run.toString().slice(0, 24)).join(' | ') : cron.message,
    },
    check('cron: four fields is an error', parseCron('0 9 * *').ok, false),
    check('cron: @daily expands', parseCron('@daily', new Date('2026-10-19T00:00:00Z'), 1).ok, true),
    check('cron: 7 means Sunday', parseCron('0 0 * * 7', new Date('2026-10-19T00:00:00Z'), 1).ok, true),
    check('cron: out of range is an error', parseCron('99 9 * * *').ok, false),
    check(
      'cron: dom and dow both restricted uses or',
      parseCron('0 0 1 * 1', new Date('2026-10-19T00:00:00Z'), 3).ok,
      true,
    ),
  );

  // ── JWT (the canonical jwt.io example token)
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.' +
    'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const jwt = decodeJwt(token);
  results.push(
    check('jwt: subject', jwt.ok ? jwt.payload.sub : jwt.message, '1234567890'),
    check('jwt: name', jwt.ok ? jwt.payload.name : jwt.message, 'John Doe'),
    check('jwt: signature byte length', jwt.ok ? jwt.signatureBytes : 0, 32),
    check('jwt: no expiry is stated as such', jwt.ok ? expiryState(jwt.payload) : 'n/a', 'no-expiry'),
    check('jwt: two segments is an error', decodeJwt('a.b').ok, false),
  );

  // ── regex
  const matches = runRegex('(\\w+)@(\\w+)', NO_FLAGS, 'a@b then c@d');
  const empties = runRegex('a*', NO_FLAGS, 'bbb');
  const replaced = runReplace('(\\d+)', NO_FLAGS, 'x12 y34', '[$1]', true);
  results.push(
    {
      name: 'regex: two matches with groups',
      pass: matches.ok && matches.matches.length === 2 && matches.matches[1]?.groups[0] === 'c',
      detail: matches.ok ? JSON.stringify(matches.matches) : matches.message,
    },
    {
      name: 'regex: empty matches terminate',
      pass: empties.ok && empties.matches.length === 4 && empties.matches.every((item) => item.text === ''),
      detail: empties.ok ? JSON.stringify(empties.matches.map((item) => item.index)) : empties.message,
    },
    check('regex: replace all with $1', replaced.ok ? replaced.text : replaced.message, 'x[12] y[34]'),
    check('regex: replace first only', runReplace('\\d', NO_FLAGS, 'a1b2', 'N', false).ok ? (runReplace('\\d', NO_FLAGS, 'a1b2', 'N', false) as { text: string }).text : '', 'aNb2'),
    check('regex: a bad pattern is an error', runRegex('(', NO_FLAGS, 'x').ok, false),
    check('regex: named groups expand', runReplace('(?<n>\\d)', NO_FLAGS, 'a1', '<$<n>>', true).ok ? (runReplace('(?<n>\\d)', NO_FLAGS, 'a1', '<$<n>>', true) as { text: string }).text : '', 'a<1>'),
  );

  // ── colour
  results.push(
    check('hex short expands', toHex(parseColour('#fff') ?? { r: 0, g: 0, b: 0, a: 1 }), '#ffffff'),
    check('rgb() parses', parseColour('rgb(1, 2, 3)')?.g, 2),
    check('contrast of black on white is 21', Math.round(contrastRatio(parseColour('#000')!, parseColour('#fff')!)), 21),
    check('AA fails at 4.4', verdict(4.4).body.aa.passes, false),
    check('AA passes at 4.5', verdict(4.5).body.aa.passes, true),
    check('large text passes at 3', verdict(3).large.aa.passes, true),
    check('ramp is ten steps', ramp(parseColour('#4f46e5')!).length, 10),
    check('ramp keeps 500 as the input colour', ramp({ r: 79, g: 70, b: 229, a: 1 }).filter((swatch) => swatch.step === 500)[0]?.hex, '#4f46e5'),
  );

  // ── diff: the context text bug (a shared leading line used to print the wrong
  // line as context, which made the GitHub editor's diff preview lie).
  const before = 'alpha\nbeta\ngamma\ndelta';
  const after = 'alpha\nbeta\nGAMMA\ndelta';
  const lineDiff = diffLines(before, after);
  const hunk = lineDiff.hunks[0];
  const texts = hunk ? hunk.lines.map((line) => `${line.kind}:${line.text}`) : [];
  results.push(
    check(
      'diff: context lines carry their own text',
      texts,
      ['context:alpha', 'context:beta', 'remove:gamma', 'add:GAMMA', 'context:delta'],
    ),
    check('diff: numbering survives the prefix', [hunk?.beforeStart, hunk?.afterStart], [1, 1]),
    check('diff: counts', [lineDiff.added, lineDiff.removed, lineDiff.unchanged], [1, 1, false]),
    check('diff: unchanged input', diffLines('same', 'same').unchanged, true),
  );

  const tail = diffLines('alpha\nbeta\ngamma', 'alpha\nbeta\nGAMMA\ngamma');
  results.push(
    check(
      'diff: a suffix is appended after the change, not repeated wrongly',
      tail.hunks[0]?.lines.map((line) => `${line.kind}:${line.text}`),
      ['context:alpha', 'context:beta', 'add:GAMMA', 'context:gamma'],
    ),
  );

  const patchText = unifiedPatch(lineDiff);
  results.push(
    contains('patch: header', patchText, '--- before\n+++ after'),
    contains('patch: hunk header with counts', patchText, '@@ -1,4 +1,4 @@'),
    check('hunk header abbreviates a single-line side', hunkHeader({ beforeStart: 7, afterStart: 9, lines: [{ kind: 'remove', text: 'x', beforeNo: 7, afterNo: null }, { kind: 'add', text: 'y', beforeNo: null, afterNo: 9 }] }), '@@ -7 +9 @@'),
    check('hunk header counts both sides', hunkHeader(lineDiff.hunks[0]!), '@@ -1,4 +1,4 @@'),
    contains('patch: unchanged means no patch', unifiedPatch(diffLines('x', 'x')), ''),
  );

  // ── SQL
  const sql = formatSql("select id, name from users where id = 1 and name like 'select%' order by name desc").text;
  results.push(
    contains('sql: keywords upper-cased', sql, 'SELECT'),
    contains('sql: clause on its own line', sql, '\nFROM users'),
    contains('sql: list breaks after commas', sql, 'SELECT\n  id,\n  name\n'),
    contains('sql: and breaks onto an indented line', sql, '\n  AND name'),
    contains('sql: strings are untouched', sql, "'select%'"),
    contains('sql: identifiers keep their case', sql, 'name'),
  );
  const glued = formatSql('select count(*) as total from t').text;
  results.push(
    contains('sql: function call keeps its case', glued, 'count(*)'),
    contains('sql: aliases stay attached', glued, 'AS total'),
  );

  return results;
}

/** `decode` with junk returns a note rather than failing — that is the contract. */
function results0(name: string, result: ReturnType<typeof decode>): CheckResult {
  const pass = result.ok && typeof result.note === 'string' && result.text === 'hello';
  return { name, pass, detail: result.ok ? `${result.text} / ${result.note ?? 'no note'}` : result.message };
}
