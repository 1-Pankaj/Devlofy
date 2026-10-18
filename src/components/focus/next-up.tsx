/**
 * NextUp — the Engine's answer, on the Today screen.
 *
 * The card is deliberately opinionated and deliberately accountable: it names one
 * task and shows the reasons it was chosen, so the ranking can be argued with
 * rather than obeyed. "Show me another" cycles down the ranked list without
 * dismissing anything permanently — the Engine's opinion is cheap to override.
 *
 * Starting from here attributes the block to the *task* as well as the project,
 * which is what lets the app later compare what was estimated with what happened.
 */
import { Target } from 'phosphor-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { RankedTask } from '@/lib/engine';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { spacing, useTheme } from '@/theme';

/** Reason → pill tone, so "overdue" reads hotter than "quick win". */
function reasonTone(reason: string): 'danger' | 'ember' | 'accent' | 'neutral' {
  if (reason.includes('overdue')) return 'danger';
  if (reason.includes('due')) return 'ember';
  if (reason.includes('best hours') || reason.includes('already moving')) return 'accent';
  return 'neutral';
}

export function NextUp({
  ranked,
  disabled = false,
  starting = false,
  onStart,
}: {
  ranked: RankedTask[];
  disabled?: boolean;
  starting?: boolean;
  onStart: (picked: RankedTask) => void;
}) {
  const { colors } = useTheme();
  const [skipped, setSkipped] = useState<string[]>([]);

  // Skipping is a local opinion about *this* render pass of the list. Deriving
  // the live set (rather than clearing state in an effect) keeps it correct when
  // a skipped task disappears — completed, deleted, or re-ranked away.
  const pool = ranked.filter(
    (entry) =>
      !skipped.includes(entry.task.id) ||
      // If everything is skipped, fall back to the whole list rather than
      // showing nothing: the card can always name something.
      skipped.length >= ranked.length,
  );
  const picked = pool[0] ?? ranked[0] ?? null;

  if (!picked) return null;

  const { task, reasons } = picked;

  return (
    <Panel style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Target size={14} color={colors.accent} weight="bold" />
          <Eyebrow tone="accent">Next up</Eyebrow>
        </View>
        {ranked.length > 1 ? (
          <AppText variant="caption" tone="tertiary">
            {pool.length > 1 ? `${pool.length} ranked` : 'last one'}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="headline" numberOfLines={2}>
          {task.title}
        </AppText>
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>
          {[task.project_name, task.est_minutes ? `${task.est_minutes}m` : null]
            .filter(Boolean)
            .join(' · ') || 'No project'}
        </AppText>
      </View>

      {reasons.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {reasons.map((reason) => (
            <StatusPill key={reason} label={reason} tone={reasonTone(reason)} />
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppButton
          label="Focus on this"
          icon={Target}
          variant="tonal"
          disabled={disabled}
          onPress={() => onStart(picked)}
          style={{ opacity: starting ? 0.6 : 1 }}
        />
        {ranked.length > 1 ? (
          <AppButton
            label="Show me another"
            variant="text"
            disabled={disabled}
            onPress={() =>
              setSkipped((current) =>
                current.length >= ranked.length ? [task.id] : [...current, task.id],
              )
            }
          />
        ) : null}
      </View>
    </Panel>
  );
}
