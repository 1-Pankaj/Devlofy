/**
 * ExtractSheet — the note's unchecked boxes, shown as the tasks they will become.
 *
 * The preview is the point: every capture path in this app states exactly what
 * it will create before it creates it (the same rule the task box follows), so
 * `!2 Reply to Northwind 45m tomorrow #Phase2` shows its title and its tokens
 * here rather than surprising you in Today. Unmatched `#tags` stay in the title.
 */
import { CheckSquare } from 'phosphor-react-native';
import { ScrollView, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { radius, spacing, useTheme } from '@/theme';

export type ExtractPreview = {
  title: string;
  /** Recognised tokens, already labelled for a reader ("!2", "45m", "#Phase2"). */
  tokens: string[];
};

export type ExtractSheetProps = {
  visible: boolean;
  onClose: () => void;
  previews: ExtractPreview[];
  /** The note's project — where the tasks land unless a `#project` says otherwise. */
  projectName: string | null;
  busy: boolean;
  onCreate: () => void;
};

export function ExtractSheet({
  visible,
  onClose,
  previews,
  projectName,
  busy,
  onCreate,
}: ExtractSheetProps) {
  const { colors } = useTheme();
  const count = previews.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={count === 1 ? 'One to-do found' : `${count} to-dos found`}
      note={
        projectName
          ? `They join Today, attributed to ${projectName} unless a #project says otherwise.`
          : 'They join Today as tasks — the same grammar as the task box.'
      }>
      <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md }}>
          {previews.map((preview, index) => (
            <View
              key={`${index}-${preview.title}`}
              style={{
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <CheckSquare size={15} color={colors.textTertiary} weight="light" />
                <AppText variant="subheadMedium" numberOfLines={2} style={{ flex: 1 }}>
                  {preview.title}
                </AppText>
              </View>
              {preview.tokens.length > 0 ? (
                <AppText variant="caption" tone="accent">
                  {preview.tokens.join(' · ')}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs }}>
        <AppButton
          label={busy ? 'Adding…' : count === 1 ? 'Add this task' : `Add ${count} tasks`}
          icon={CheckSquare}
          full
          disabled={busy || count === 0}
          onPress={onCreate}
        />
        <AppText variant="caption" tone="tertiary" style={{ marginTop: spacing.sm }}>
          The note is not changed — the boxes stay where they are.
        </AppText>
      </View>
    </BottomSheet>
  );
}
