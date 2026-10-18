/**
 * Diff — two texts in, the exact line changes out.
 *
 * The same engine and the same renderer the GitHub screens use (`src/lib/diff`
 * and `DiffView`), which matters for trust: the diff you preview here is
 * character-for-character the diff the editor would show before a commit. The
 * patch output is the paste-able form of the same structure.
 */
import { ArrowsDownUp } from 'phosphor-react-native';
import { useMemo, useState } from 'react';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { DiffView } from '@/components/ui/diff-view';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { describeDiff, diffLines } from '@/lib/diff';
import { unifiedPatch } from '@/lib/bench/patch';
import { toolById } from '@/lib/bench/tools';
import { spacing } from '@/theme';
import { CopyButton, ToolInput, ToolNote, ToolRow, ToolSection } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('diff')!;

const SAMPLE_BEFORE = `export function priceFor(minutes: number, rate: number) {
  return minutes * rate;
}`;

const SAMPLE_AFTER = `export function priceFor(minutes: number, rate: number) {
  if (minutes < 0) throw new Error('minutes cannot be negative');
  return (minutes / 60) * rate;
}`;

export function DiffTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [before, setBefore] = useState(initial ?? SAMPLE_BEFORE);
  const [after, setAfter] = useState(SAMPLE_AFTER);

  const diff = useMemo(() => diffLines(before, after), [before, after]);
  const patch = useMemo(() => unifiedPatch(diff), [diff]);

  return (
    <>
      <ToolInput label="Before" value={before} onChangeText={setBefore} minHeight={150} />
      <ToolInput label="After" value={after} onChangeText={setAfter} minHeight={150} />

      <ToolRow>
        <AppButton
          label="Swap them"
          variant="tonal"
          icon={ArrowsDownUp}
          onPress={() => {
            setBefore(after);
            setAfter(before);
          }}
        />
        <AppButton
          label="Example"
          variant="text"
          onPress={() => {
            setBefore(SAMPLE_BEFORE);
            setAfter(SAMPLE_AFTER);
          }}
        />
      </ToolRow>

      <ToolSection
        label="What changed"
        trailing={
          <ToolRow>
            <StatusPill
              label={describeDiff(diff)}
              tone={diff.unchanged ? 'neutral' : diff.removed > diff.added ? 'danger' : 'accent'}
            />
            {patch.length > 0 ? <CopyButton text={patch} label="Copy patch" /> : null}
          </ToolRow>
        }>
        <DiffView hunks={diff.hunks} emptyLabel="these two are identical" />
        {diff.truncated ? (
          <ToolNote>
            This pair is large, so only the counts are meaningful — the app caps the line diff
            rather than stalling on it.
          </ToolNote>
        ) : null}
      </ToolSection>

      {patch.length > 0 ? (
        <>
          <ToolSection label="As a patch">
            <Panel style={{ padding: 0 }}>
              <AppText
                selectable
                variant="mono"
                tone="secondary"
                style={{ paddingVertical: spacing.md }}>
                {patch}
              </AppText>
            </Panel>
          </ToolSection>

          <SaveSnippetPanel tool={TOOL} snippetId={snippetId} body={patch} language="plain" suggestedTitle="Diff · patch" />
        </>
      ) : null}
    </>
  );
}
