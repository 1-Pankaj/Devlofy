/**
 * LinkSheet — one sheet, two kinds of link.
 *
 * "Note" picks from your library and inserts `[[Title]]`; "Web" takes an address
 * and wraps the selection in markdown. They live together because they are the
 * same decision ("what does this word point at?"), and because a toolbar with
 * two link buttons would be a toolbar with one that nobody presses twice.
 */
import { MagnifyingGlass, NoteBlank } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BottomSheet, SheetRow } from '@/components/ui/bottom-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Segmented } from '@/components/ui/segmented';
import { fonts, radius, spacing, useTheme } from '@/theme';

export type LinkSheetProps = {
  visible: boolean;
  onClose: () => void;
  notes: { id: string; title: string }[];
  /** The note being edited — never offered as a link to itself. */
  currentId: string;
  /** Controlled: the toolbar's link button opens on the web tab, `[[` on notes. */
  tab: 'note' | 'web';
  onTabChange: (tab: 'note' | 'web') => void;
  onPickNote: (title: string) => void;
  onPickUrl: (href: string) => void;
};

export function LinkSheet({
  visible,
  onClose,
  notes,
  currentId,
  tab,
  onTabChange,
  onPickNote,
  onPickUrl,
}: LinkSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [href, setHref] = useState('');

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes
      .filter((note) => note.id !== currentId)
      .filter((note) => (needle ? note.title.toLowerCase().includes(needle) : true))
      .slice(0, 60);
  }, [currentId, notes, query]);

  const close = () => {
    setQuery('');
    setHref('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="Insert a link"
      note={tab === 'note' ? 'Point at another note in your library.' : 'Point at somewhere on the web.'}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
        <Segmented
          options={[
            { value: 'note', label: 'Note' },
            { value: 'web', label: 'Web' },
          ]}
          value={tab}
          onChange={onTabChange}
        />
      </View>

      {tab === 'note' ? (
        <>
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                height: 44,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: colors.surfaceElevated,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}>
              <MagnifyingGlass size={16} color={colors.textTertiary} weight="light" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Find a note"
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.accent}
                autoCapitalize="none"
                accessibilityLabel="Find a note to link"
                style={{
                  flex: 1,
                  padding: 0,
                  color: colors.text,
                  fontFamily: fonts.bodyRegular,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

          <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
            {options.length === 0 ? (
              <AppText
                variant="subhead"
                tone="tertiary"
                style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
                {notes.filter((note) => note.id !== currentId).length === 0
                  ? 'This is the only note on the device.'
                  : 'No note by that name.'}
              </AppText>
            ) : (
              options.map((note) => (
                <PressableScale
                  key={note.id}
                  haptic="selection"
                  accessibilityLabel={`Link to ${note.title}`}
                  onPress={() => {
                    onPickNote(note.title);
                    close();
                  }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.md,
                    }}>
                    <NoteBlank size={16} color={colors.textTertiary} weight="light" />
                    <AppText variant="subheadMedium" numberOfLines={1} style={{ flex: 1 }}>
                      {note.title || 'Untitled note'}
                    </AppText>
                  </View>
                </PressableScale>
              ))
            )}
          </ScrollView>
        </>
      ) : (
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
          <TextInput
            value={href}
            onChangeText={setHref}
            placeholder="https://…"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Web address"
            style={{
              height: 46,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.surfaceElevated,
              borderWidth: 1,
              borderColor: colors.hairline,
              color: colors.text,
              fontFamily: fonts.bodyRegular,
              fontSize: 16,
            }}
          />
          <AppButton
            label="Add link"
            icon={NoteBlank}
            full
            disabled={href.trim().length === 0}
            onPress={() => {
              onPickUrl(href.trim());
              close();
            }}
          />
        </View>
      )}
    </BottomSheet>
  );
}

/** A one-line list of the note's headings — the outline. */
export function OutlineSheet({
  visible,
  onClose,
  onDismiss,
  headings,
  onJump,
}: {
  visible: boolean;
  onClose: () => void;
  /** Passed through: a jump may only take the caret once the sheet is gone. */
  onDismiss?: () => void;
  headings: { index: number; hashes: number; text: string }[];
  onJump: (index: number) => void;
}) {
  const { colors } = useTheme();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      title="Outline"
      note="Every heading in this note, in order."
      scroll>
      {headings.map((heading, position) => (
        <SheetRow
          key={`${heading.index}-${position}`}
          label={heading.text}
          icon={NoteBlank}
          onPress={() => {
            onJump(heading.index);
            onClose();
          }}
        />
      ))}
      <View style={{ height: 1, backgroundColor: colors.hairline, marginTop: spacing.xs }} />
    </BottomSheet>
  );
}
