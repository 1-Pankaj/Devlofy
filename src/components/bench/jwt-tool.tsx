/**
 * JWT — read a token, and refuse to pretend you verified it.
 *
 * The honest version of this tool says three things: here is the header, here are
 * the claims with their expiry in words, and **the signature was not checked** —
 * this app has no key and no network call, so "verified" is not an answer it can
 * give. The expiry state is derived from `exp`/`nbf` against the device clock,
 * which is the one claim comparison that is actually true offline.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CodeBlock } from '@/components/ui/code-block';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { claimRows, decodeJwt, expiryState } from '@/lib/bench/jwt';
import { toolById } from '@/lib/bench/tools';
import { fonts, spacing } from '@/theme';
import { ToolAnswer, ToolFailure, ToolInput, ToolNote, ToolSection } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('jwt')!;

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const EXPIRY: Record<ReturnType<typeof expiryState>, { label: string; tone: 'accent' | 'ember' | 'danger' | 'neutral' }> = {
  valid: { label: 'not expired', tone: 'accent' },
  expired: { label: 'expired', tone: 'danger' },
  'not-yet-valid': { label: 'not valid yet', tone: 'ember' },
  'no-expiry': { label: 'no expiry claim', tone: 'neutral' },
};

export function JwtTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [input, setInput] = useState(initial ?? SAMPLE);
  const token = useMemo(() => decodeJwt(input), [input]);

  const state = token.ok ? expiryState(token.payload) : null;
  const claims = token.ok ? claimRows(token.payload) : [];

  return (
    <>
      <ToolInput label="Token" value={input} onChangeText={setInput} placeholder={SAMPLE} minHeight={130} />

      {!token.ok && input.trim().length > 0 ? (
        <ToolFailure title="That is not a JWT" message={token.message} />
      ) : null}

      {token.ok && state ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
            <StatusPill label={EXPIRY[state].label} tone={EXPIRY[state].tone} />
            <AppText variant="caption" tone="tertiary">
              {claims.length} claim{claims.length === 1 ? '' : 's'} · {token.signatureBytes} signature bytes
            </AppText>
          </View>

          <ToolSection label="Header">
            <Panel style={{ gap: spacing.md }}>
              {Object.entries(token.header).map(([key, value]) => (
                <View
                  key={key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: spacing.lg,
                  }}>
                  <AppText variant="caption" tone="tertiary" style={{ fontFamily: fonts.monoRegular }}>
                    {key}
                  </AppText>
                  <AppText variant="mono" tone="secondary" style={{ flexShrink: 1 }}>
                    {String(value)}
                  </AppText>
                </View>
              ))}
            </Panel>
          </ToolSection>

          <ToolSection label="Claims">
            <Panel style={{ gap: spacing.md }}>
              {claims.map((claim) => (
                <View key={claim.key} style={{ gap: 2 }}>
                  <AppText variant="caption" tone="tertiary">
                    {claim.label}
                    {claim.label === claim.key ? '' : ` · ${claim.key}`}
                  </AppText>
                  <AppText variant="mono" tone="secondary">
                    {claim.value}
                    {claim.when ? `  (${claim.when})` : ''}
                  </AppText>
                </View>
              ))}
            </Panel>
          </ToolSection>

          <ToolAnswer label="Payload as JSON" text={token.payloadText}>
            <CodeBlock code={JSON.stringify(token.payload, null, 2)} language="json" />
          </ToolAnswer>

          <ToolNote>
            The signature was <AppText variant="captionMedium" tone="secondary">not</AppText> verified —
            this app holds no key and makes no network call, so it cannot sign or check anything. Read
            a token here; verify it where the secret lives.
          </ToolNote>
        </>
      ) : null}

      {token.ok ? (
        <SaveSnippetPanel tool={TOOL} snippetId={snippetId} body={input} language="plain" suggestedTitle="JWT · token" />
      ) : null}
    </>
  );
}
