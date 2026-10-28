/**
 * ProjectChips — "working on" attribution for the next focus session.
 *
 * The selection is persisted, so Today and Garden always agree on which project
 * the next block belongs to, and a session started from either screen lands in
 * the same place. Attribution is what lets a project answer "how long did this
 * actually take?".
 */
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { FormChip } from '@/components/ui/form-chip';
import { Eyebrow } from '@/components/ui/pill';
import { useLiveQuery } from '@/lib/db/hooks';
import { listProjects } from '@/lib/db/repo';
import { useSettings } from '@/state/settings';
import { spacing } from '@/theme';

export function ProjectChips({
  label = 'Working on',
  wrap = false,
}: {
  label?: string;
  /** Wide panels wrap instead of scrolling: a chip cut mid-word under a stage
   *  reads as a bug, not as an affordance. */
  wrap?: boolean;
}) {
  const projects = useLiveQuery((d) => listProjects(d));
  const focusProjectId = useSettings((s) => s.focusProjectId);
  const setFocusProjectId = useSettings((s) => s.setFocusProjectId);

  const rows = (projects.data ?? []).filter(
    (project) => project.status === 'active' || project.status === 'maintenance',
  );

  // A project that has since been archived reads as "None" again.
  const selected = rows.some((project) => project.id === focusProjectId) ? focusProjectId : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Eyebrow>{label}</Eyebrow>
        {selected ? (
          <AppText variant="code" tone="tertiary" style={{ fontSize: 10.5 }}>
            filed under this project
          </AppText>
        ) : null}
      </View>
      {wrap ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <FormChip label="None" active={!selected} onPress={() => setFocusProjectId(null)} />
          {rows.map((project) => (
            <FormChip
              key={project.id}
              label={project.name}
              active={selected === project.id}
              onPress={() => setFocusProjectId(project.id)}
            />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
          <FormChip label="None" active={!selected} onPress={() => setFocusProjectId(null)} />
          {rows.map((project) => (
            <FormChip
              key={project.id}
              label={project.name}
              active={selected === project.id}
              onPress={() => setFocusProjectId(project.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
