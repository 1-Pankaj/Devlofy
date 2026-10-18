/**
 * Regex — try a pattern and see exactly what it caught.
 *
 * The pattern is the input (it is the thing you keep and paste into code), so a
 * saved snippet reopens here as a pattern and not as test text. Matches are shown
 * twice on purpose: as a highlighted copy of your text, which is how you *see* a
 * mistake, and as a numbered list with groups, which is how you read one. Replace
 * previews the result and, like everything else here, never touches the input.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CodeBlock } from '@/components/ui/code-block';
import { FormChip } from '@/components/ui/form-chip';
import { Panel } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import {
  NO_FLAGS,
  RECIPES,
  flagString,
  runRegex,
  runReplace,
  segmentsOf,
  type RegexFlags,
} from '@/lib/bench/regex';
import { toolById } from '@/lib/bench/tools';
import { fonts, spacing, useTheme } from '@/theme';
import { CopyButton, ToolAnswer, ToolFailure, ToolInput, ToolNote, ToolRow, ToolSection, monoInput } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('regex')!;

const SAMPLE_PATTERN = '\\b(\\w+)\\s+\\1\\b';
const SAMPLE_TEXT = 'the the client brief was was late, and we shipped it it anyway';

type View_ = 'matches' | 'replace';

const FLAG_OPTIONS: { key: keyof RegexFlags; label: string }[] = [
  { key: 'ignoreCase', label: 'i · ignore case' },
  { key: 'multiline', label: 'm · per line' },
  { key: 'dotAll', label: 's · across lines' },
  { key: 'unicode', label: 'u · unicode' },
];

export function RegexTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const { colors } = useTheme();
  const [pattern, setPattern] = useState(initial ?? SAMPLE_PATTERN);
  const [text, setText] = useState(SAMPLE_TEXT);
  const [flags, setFlags] = useState<RegexFlags>({ ...NO_FLAGS });
  const [view, setView] = useState<View_>('matches');
  const [replacement, setReplacement] = useState('$1');
  const [all, setAll] = useState(true);

  const result = useMemo(() => runRegex(pattern, flags, text), [pattern, flags, text]);
  const segments = useMemo(
    () => (result.ok ? segmentsOf(text, result.matches) : []),
    [result, text],
  );
  const replaced = useMemo(
    () => (view === 'replace' ? runReplace(pattern, flags, text, replacement, all) : null),
    [view, pattern, flags, text, replacement, all],
  );

  return (
    <>
      <ToolInput
        label="Pattern"
        value={pattern}
        onChangeText={setPattern}
        placeholder={SAMPLE_PATTERN}
        minHeight={70}
      />

      <ToolRow>
        {FLAG_OPTIONS.map((option) => (
          <FormChip
            key={option.key}
            label={option.label}
            active={flags[option.key]}
            onPress={() => setFlags((current) => ({ ...current, [option.key]: !current[option.key] }))}
          />
        ))}
      </ToolRow>

      <ToolSection label="Recipes">
        <ToolRow>
          {RECIPES.map((recipe) => (
            <FormChip
              key={recipe.name}
              label={recipe.name}
              active={pattern === recipe.pattern}
              onPress={() => {
                setPattern(recipe.pattern);
                setFlags(recipe.flags);
                setText(recipe.sample);
              }}
            />
          ))}
        </ToolRow>
      </ToolSection>

      <ToolInput
        label="Text to search"
        value={text}
        onChangeText={setText}
        placeholder={SAMPLE_TEXT}
        minHeight={150}
      />

      {!result.ok && pattern.length > 0 ? (
        <ToolFailure title="That pattern does not compile" message={result.message} />
      ) : null}

      {result.ok ? (
        <>
          <ToolRow style={{ justifyContent: 'space-between' }}>
            <Segmented
              options={[
                { value: 'matches', label: 'Matches' },
                { value: 'replace', label: 'Replace' },
              ]}
              value={view}
              onChange={(next) => setView(next as View_)}
            />
            <AppText variant="caption" tone="tertiary">
              {result.total} match{result.total === 1 ? '' : 'es'}
              {result.truncated ? ` (showing the first ${result.matches.length})` : ''}
              {pattern.length > 0 ? ` · /${pattern}/` : ''}
              {flagString(flags)}
            </AppText>
          </ToolRow>

          {view === 'matches' ? (
            <>
              <ToolSection label="Where they land">
                <Panel style={{ paddingVertical: spacing.md }}>
                  <AppText
                    selectable
                    style={{ fontFamily: fonts.monoRegular, fontSize: 13, lineHeight: 21 }}>
                    {segments.length === 0 ? (
                      <AppText variant="mono" tone="tertiary">
                        {text.length === 0 ? 'nothing to search' : 'no matches'}
                      </AppText>
                    ) : (
                      segments.map((segment, index) =>
                        segment.match ? (
                          <AppText
                            key={index}
                            style={{
                              fontFamily: fonts.monoRegular,
                              fontSize: 13,
                              lineHeight: 21,
                              color: colors.accent,
                              backgroundColor: colors.accentSoft,
                            }}>
                            {segment.text}
                          </AppText>
                        ) : (
                          <AppText
                            key={index}
                            style={{
                              fontFamily: fonts.monoRegular,
                              fontSize: 13,
                              lineHeight: 21,
                              color: colors.textSecondary,
                            }}>
                            {segment.text}
                          </AppText>
                        ),
                      )
                    )}
                  </AppText>
                </Panel>
              </ToolSection>

              {result.matches.length > 0 ? (
                <ToolSection label="Match by match">
                  <Panel style={{ gap: spacing.md }}>
                    {result.matches.map((match, index) => (
                      <View key={index} style={{ gap: 2 }}>
                        <AppText variant="caption" tone="tertiary">
                          #{index + 1} at index {match.index}
                        </AppText>
                        <AppText
                          selectable
                          style={{ fontFamily: fonts.monoRegular, fontSize: 13 }}>
                          {match.text.length === 0 ? '(empty match)' : match.text}
                        </AppText>
                        {match.groups.length > 0 ? (
                          <AppText variant="caption" tone="secondary">
                            {match.groups
                              .map((group, position) => `$${position + 1} = ${group || '—'}`)
                              .join('   ')}
                          </AppText>
                        ) : null}
                      </View>
                    ))}
                  </Panel>
                </ToolSection>
              ) : null}
            </>
          ) : (
            <>
              <TextField
                label="Replace with ($1, $&, $<name>)"
                value={replacement}
                onChangeText={setReplacement}
                autoCapitalize="none"
                autoCorrect={false}
                inputStyle={monoInput}
              />
              <ToolRow>
                <FormChip label="all occurrences" active={all} onPress={() => setAll((on) => !on)} />
              </ToolRow>
              {replaced && replaced.ok ? (
                <ToolAnswer
                  label={`Result — ${replaced.count} replacement${replaced.count === 1 ? '' : 's'}`}
                  text={replaced.text}>
                  <CodeBlock code={replaced.text} highlight={false} showLineNumbers={false} />
                </ToolAnswer>
              ) : replaced && !replaced.ok ? (
                <ToolFailure title="Cannot replace" message={replaced.message} />
              ) : null}
            </>
          )}

          <ToolNote>
            Runs on this device against the text you paste. A pathological pattern can still be slow —
            the app caps the work rather than freezing, and says when it did.
          </ToolNote>

          <SaveSnippetPanel
            tool={TOOL} snippetId={snippetId}
            body={pattern}
            language="plain"
            suggestedTitle={`Regex · ${flagString(flags) || 'no flags'}`}
          />
        </>
      ) : null}

      <ToolRow>
        <CopyButton text={`/${pattern}/${flagString(flags)}`} label="Copy pattern" />
      </ToolRow>
    </>
  );
}
