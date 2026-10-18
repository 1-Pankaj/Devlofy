/**
 * Hashes — SHA-256 and SHA-1, computed here.
 *
 * Only two algorithms, on purpose: they are the two this app can compute in pure
 * TypeScript and prove against the published test vectors (`self-check.ts`), and
 * promising a menu of hashes would mean shipping arithmetic nobody verified. The
 * expected-digest field is the reason the tool exists in practice — pasting a
 * checksum you were given and finding out whether it matches.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CodeBlock } from '@/components/ui/code-block';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { TextField } from '@/components/ui/text-field';
import { ALGORITHMS, hashText } from '@/lib/bench/hash';
import { utf8ToBytes } from '@/lib/base64';
import { toolById } from '@/lib/bench/tools';
import { spacing } from '@/theme';
import { CopyButton, ToolAnswer, ToolFact, ToolInput, ToolNote, ToolSection, monoInput } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('hash')!;

const SAMPLE = 'devlofy';

export function HashTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [input, setInput] = useState(initial ?? SAMPLE);
  const [expected, setExpected] = useState('');

  const digests = useMemo(
    () => ALGORITHMS.map((algorithm) => ({ algorithm, hex: hashText(input, algorithm) })),
    [input],
  );

  const bytes = useMemo(() => utf8ToBytes(input).length, [input]);
  const wanted = expected.trim().toLowerCase();
  const match = wanted.length > 0 ? digests.find((item) => item.hex === wanted) : undefined;

  return (
    <>
      <ToolInput label="Text to digest" value={input} onChangeText={setInput} placeholder={SAMPLE} minHeight={130} />

      <ToolSection label="Digest">
        <Panel style={{ gap: spacing.xs }}>
          <ToolFact label="Input bytes" value={String(bytes)} />
        </Panel>
      </ToolSection>

      {digests.map((item) => (
        <ToolAnswer key={item.algorithm} label={item.algorithm} text={item.hex}>
          <CodeBlock code={item.hex} highlight={false} showLineNumbers={false} />
        </ToolAnswer>
      ))}

      <ToolSection
        label="Check against a digest you were given"
        trailing={wanted.length > 0 ? <CopyButton text={expected} label="Copy" /> : undefined}>
        <TextField
          value={expected}
          onChangeText={setExpected}
          placeholder="paste the hash you expect"
          autoCapitalize="none"
          autoCorrect={false}
          inputStyle={monoInput}
        />
        {wanted.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {match ? (
              <>
                <StatusPill label="matches" tone="accent" />
                <AppText variant="caption" tone="secondary">
                  {match.algorithm} · {input.length} characters of input
                </AppText>
              </>
            ) : (
              <>
                <StatusPill label="no match" tone="danger" />
                <AppText variant="caption" tone="secondary">
                  Not the digest of this text under any algorithm here.
                </AppText>
              </>
            )}
          </View>
        ) : null}
      </ToolSection>

      <ToolNote>
        SHA-256 and SHA-1 only — the two this app computes itself and checks against the published
        vectors. For passwords, use bcrypt or argon2 on the server; a fast hash is the wrong tool.
      </ToolNote>

      <SaveSnippetPanel
        tool={TOOL} snippetId={snippetId}
        body={`${digests[0].hex}  ${input}`}
        language="plain"
        suggestedTitle="Hash · sha256"
      />
    </>
  );
}
