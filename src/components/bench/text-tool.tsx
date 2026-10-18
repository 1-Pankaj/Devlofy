/**
 * Text — what is in it, and what shape you need it in.
 *
 * Counting uses code points and UTF-8 bytes, so an emoji is one character and
 * four bytes and both numbers are shown. The case conversions are the real work:
 * `getUserID` → `get_user_id` → `GetUserId` all come out of one word splitter, and
 * every result is copyable, because the reason you are here is to paste it
 * somewhere.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { CASES, lineFacts, slugify, textStats, toCase, type CaseName } from '@/lib/bench/textstats';
import { toolById } from '@/lib/bench/tools';
import { fonts, spacing, useTheme } from '@/theme';
import { CopyButton, ToolFact, ToolInput, ToolSection } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('text')!;

const SAMPLE = `Client asked for a new onboarding flow.
The old one drops 40% of users on step 3.

TODO: rewrite the welcome screen.`;

const CASE_LABELS: Record<CaseName, string> = {
  upper: 'UPPER CASE',
  lower: 'lower case',
  title: 'Title Case',
  sentence: 'Sentence case',
  camel: 'camelCase',
  pascal: 'PascalCase',
  snake: 'snake_case',
  kebab: 'kebab-case',
  constant: 'CONSTANT_CASE',
};

export function TextTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const { colors } = useTheme();
  const [input, setInput] = useState(initial ?? SAMPLE);

  const stats = useMemo(() => textStats(input), [input]);
  const facts = useMemo(() => lineFacts(input), [input]);
  const slug = useMemo(() => slugify(input), [input]);

  return (
    <>
      <ToolInput label="Text" value={input} onChangeText={setInput} placeholder="Paste anything" minHeight={170} />

      <ToolSection label="Counts">
        <Panel style={{ gap: spacing.md }}>
          <ToolFact label="Characters" value={String(stats.characters)} />
          <ToolFact label="Without spaces" value={String(stats.charactersNoSpaces)} />
          <ToolFact label="Words" value={String(stats.words)} />
          <ToolFact label="Lines" value={String(stats.lines)} />
          <ToolFact label="Sentences" value={String(stats.sentences)} />
          <ToolFact label="Paragraphs" value={String(stats.paragraphs)} />
          <ToolFact label="UTF-8 bytes" value={String(stats.bytes)} />
          <ToolFact
            label="Reading time"
            value={stats.readingMinutes === 0 ? '—' : `${stats.readingMinutes} min`}
          />
          {facts.duplicateLines > 0 ? (
            <ToolFact
              label="Repeated lines"
              value={`${facts.duplicateLines} of ${facts.nonEmptyLines}`}
            />
          ) : null}
          <ToolFact label="Longest line" value={`${facts.longestLine} chars`} />
        </Panel>
      </ToolSection>

      <ToolSection label="In another shape">
        <Panel style={{ gap: 0, paddingVertical: 0 }}>
          {CASES.map((style, index) => {
            const value = toCase(input, style);
            return (
              <View
                key={style}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.hairline,
                }}>
                <AppText variant="caption" tone="tertiary" style={{ width: 116 }}>
                  {CASE_LABELS[style]}
                </AppText>
                <AppText
                  numberOfLines={1}
                  style={{ flex: 1, fontFamily: fonts.monoRegular, fontSize: 13, color: colors.text }}>
                  {value}
                </AppText>
                {value.length > 0 ? <CopyButton text={value} /> : null}
              </View>
            );
          })}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
            }}>
            <AppText variant="caption" tone="tertiary" style={{ width: 116 }}>
              slug
            </AppText>
            <AppText
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fonts.monoRegular, fontSize: 13, color: colors.text }}>
              {slug}
            </AppText>
            {slug.length > 0 ? <CopyButton text={slug} /> : null}
          </View>
        </Panel>
      </ToolSection>

      <AppButton label="Example" variant="text" onPress={() => setInput(SAMPLE)} />

      <SaveSnippetPanel tool={TOOL} snippetId={snippetId} body={input} language="plain" suggestedTitle="Text · notes" />
    </>
  );
}
