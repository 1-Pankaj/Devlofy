/**
 * Cron — what an expression means, and when it will actually fire next.
 *
 * A description in words is a claim; the next-five-runs list is the proof. Both
 * are shown, so a misreading of cron's day-of-month/day-of-week rule is visible
 * immediately rather than in production. Times are local to the device and said
 * so, because "0 9 * * *" means nine o'clock *where you are*.
 */
import { useMemo, useState } from 'react';

import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { FormChip } from '@/components/ui/form-chip';
import { parseCron, relativeTime } from '@/lib/bench/time';
import { toolById } from '@/lib/bench/tools';
import { radius, spacing, useTheme } from '@/theme';
import { CopyButton, ToolFailure, ToolInput, ToolNote, ToolRow, ToolSection } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('cron')!;

const SAMPLE = '0 9 * * 1-5';

const COMMON: { label: string; value: string }[] = [
  { label: 'every minute', value: '* * * * *' },
  { label: 'every 5 min', value: '*/5 * * * *' },
  { label: 'hourly', value: '0 * * * *' },
  { label: 'weekdays 9am', value: '0 9 * * 1-5' },
  { label: 'monthly, 1st', value: '0 0 1 * *' },
  { label: '@daily', value: '@daily' },
];

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function CronTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const { colors } = useTheme();
  const [input, setInput] = useState(initial ?? SAMPLE);
  const schedule = useMemo(() => parseCron(input), [input]);

  return (
    <>
      <ToolInput
        label="Expression"
        value={input}
        onChangeText={setInput}
        placeholder={SAMPLE}
        minHeight={80}
      />

      <ToolSection label="Common">
        <ToolRow>
          {COMMON.map((item) => (
            <FormChip
              key={item.value}
              label={item.label}
              active={input.trim() === item.value}
              onPress={() => setInput(item.value)}
            />
          ))}
        </ToolRow>
      </ToolSection>

      {!schedule.ok && input.trim().length > 0 ? (
        <ToolFailure title="That is not a cron expression" message={schedule.message} />
      ) : null}

      {schedule.ok ? (
        <>
          <ToolSection
            label="In words"
            trailing={<CopyButton text={schedule.value.description.join(' ')} label="Copy" />}>
            <Panel style={{ gap: spacing.sm }}>
              {schedule.value.description.map((line, index) => (
                <AppText key={index} variant="subhead" tone={index === 0 ? 'default' : 'secondary'}>
                  {line}
                </AppText>
              ))}
            </Panel>
          </ToolSection>

          <ToolSection label="Next five runs">
            <Panel style={{ gap: spacing.md }}>
              {schedule.value.next.length === 0 ? (
                <AppText variant="subhead" tone="secondary">
                  Nothing in the next five years matches this.
                </AppText>
              ) : (
                schedule.value.next.map((run, index) => (
                  <AppText
                    key={index}
                    variant="mono"
                    tone="secondary"
                    style={{
                      paddingVertical: spacing.xs,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.hairline,
                      borderRadius: radius.sm,
                    }}>
                    {dayLabel(run)} · {timeLabel(run)} · {relativeTime(run.getTime())}
                  </AppText>
                ))
              )}
            </Panel>
          </ToolSection>

          <ToolNote>
            Times are local to this device and start from the next minute. Cron&apos;s own rule
            applies: when both day-of-month and day-of-week are set, a day matching either one runs.
          </ToolNote>

          <SaveSnippetPanel
            tool={TOOL} snippetId={snippetId}
            body={schedule.value.expression}
            language="plain"
            suggestedTitle="Cron · schedule"
          />
        </>
      ) : null}
    </>
  );
}
