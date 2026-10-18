/**
 * Timestamps — one moment, every reading of it.
 *
 * Epoch work goes wrong in one specific way: the seconds/milliseconds confusion,
 * which produces a date in 1973 or a date in 55000. So the unit is never assumed
 * silently — the reading names which one it used, and the tool offers the "now"
 * buttons that are the actual reason you opened it. The shift chips move the
 * moment without losing the original.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { FormChip } from '@/components/ui/form-chip';
import { parseMoment, describeMoment } from '@/lib/bench/time';
import { toolById } from '@/lib/bench/tools';
import { fonts, spacing } from '@/theme';
import { CopyButton, ToolFailure, ToolInput, ToolNote, ToolRow, ToolSection } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('epoch')!;

const SAMPLE = '1700000000';

const SHIFTS: { label: string; ms: number }[] = [
  { label: '+1 h', ms: 3_600_000 },
  { label: '+1 d', ms: 86_400_000 },
  { label: '+7 d', ms: 604_800_000 },
  { label: '-1 d', ms: -86_400_000 },
  { label: '+1 y', ms: 31_536_000_000 },
];

export function EpochTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const [input, setInput] = useState(initial ?? SAMPLE);

  const moment = useMemo(() => parseMoment(input), [input]);
  const reading = useMemo(() => (moment ? describeMoment(moment.ms) : null), [moment]);

  const shift = (ms: number) => {
    if (!moment) return;
    setInput(String(Math.floor((moment.ms + ms) / 1000)));
  };

  const rows = reading
    ? [
        { label: 'Seconds', value: String(reading.seconds) },
        { label: 'Milliseconds', value: String(reading.milliseconds) },
        { label: 'ISO 8601', value: reading.iso },
        { label: 'UTC', value: reading.utc },
        { label: 'Local', value: reading.local },
        { label: 'Day of week', value: reading.weekday },
        { label: 'From now', value: reading.relative },
      ]
    : [];

  return (
    <>
      <ToolInput
        label="Timestamp, ISO date, or anything Date.parse understands"
        value={input}
        onChangeText={setInput}
        placeholder={SAMPLE}
        minHeight={80}
      />

      <ToolRow>
        <AppButton
          label="Now, seconds"
          variant="tonal"
          onPress={() => setInput(String(Math.floor(Date.now() / 1000)))}
        />
        <AppButton
          label="Now, milliseconds"
          variant="tonal"
          onPress={() => setInput(String(Date.now()))}
        />
        <AppButton label="Example" variant="text" onPress={() => setInput(SAMPLE)} />
      </ToolRow>

      {moment ? (
        <ToolNote>
          Read as {moment.source}
          {moment.source === 'seconds' ? ' (a number under 100 billion is seconds)' : ''}.
        </ToolNote>
      ) : null}

      {!moment && input.trim().length > 0 ? (
        <ToolFailure
          title="Cannot read that as a moment"
          message="Give it epoch seconds, epoch milliseconds, an ISO date, or a date string the runtime understands."
        />
      ) : null}

      {reading ? (
        <>
          <ToolSection
            label="Every reading of it"
            trailing={<CopyButton text={reading.iso} label="Copy ISO" />}>
            <Panel style={{ gap: spacing.md }}>
              {rows.map((row) => (
                <View key={row.label} style={{ gap: 2 }}>
                  <AppText variant="caption" tone="tertiary">
                    {row.label}
                  </AppText>
                  <AppText
                    selectable
                    style={{ fontFamily: fonts.monoRegular, fontSize: 13 }}>
                    {row.value}
                  </AppText>
                </View>
              ))}
            </Panel>
          </ToolSection>

          <ToolSection label="Move it">
            <ToolRow>
              {SHIFTS.map((item) => (
                <FormChip
                  key={item.label}
                  label={item.label}
                  active={false}
                  onPress={() => shift(item.ms)}
                />
              ))}
            </ToolRow>
          </ToolSection>

          <SaveSnippetPanel
            tool={TOOL} snippetId={snippetId}
            body={reading.iso}
            language="plain"
            suggestedTitle="Timestamp · ISO"
          />
        </>
      ) : null}
    </>
  );
}
