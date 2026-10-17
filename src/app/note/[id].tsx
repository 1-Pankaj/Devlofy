/**
 * Note editor — autosaving, offline, yours.
 *
 * State is a nullable draft: `null` means "show what's in the database" and
 * the first keystroke takes local ownership. Saves are debounced and flushed
 * on unmount, so nothing typed is ever lost.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { PushPin, Trash, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';

import { BackRow } from '@/components/ui/back-button';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useLiveQuery } from '@/lib/db/hooks';
import { deleteNote, getNote, updateNote } from '@/lib/db/repo';
import { fonts, radius, spacing, useTheme } from '@/theme';

type Draft = { title: string; body: string };

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const note = useLiveQuery((d) => getNote(d, id), { deps: [id], refreshOnFocus: false });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = useRef(false);
  const latest = useRef<Draft>({ title: '', body: '' });

  const title = draft?.title ?? note.data?.title ?? '';
  const body = draft?.body ?? note.data?.body ?? '';

  // Keep the flush-on-exit buffer current without re-rendering.
  useEffect(() => {
    latest.current = { title, body };
  }, [title, body]);

  // Debounced autosave — only once the user has actually edited.
  useEffect(() => {
    if (draft === null || !dirty.current) return;
    const timer = setTimeout(async () => {
      await updateNote(db, id, { title, body });
      dirty.current = false;
      setSaveState('saved');
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, title, body, db, id]);

  // Final flush if the screen unmounts mid-edit.
  useEffect(
    () => () => {
      if (dirty.current) {
        updateNote(db, id, { title: latest.current.title, body: latest.current.body }).catch(() => {});
      }
    },
    [db, id],
  );

  const handleChangeTitle = (text: string) => {
    dirty.current = true;
    setSaveState('saving');
    setDraft((prev) => ({ title: text, body: prev?.body ?? body }));
  };

  const handleChangeBody = (text: string) => {
    dirty.current = true;
    setSaveState('saving');
    setDraft((prev) => ({ title: prev?.title ?? title, body: text }));
  };

  const handleDelete = async () => {
    await deleteNote(db, id);
    router.back();
  };

  const handlePin = async () => {
    await updateNote(db, id, { pinned: !(note.data?.pinned ?? 0) });
    note.refresh();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 920,
          alignSelf: 'center',
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
        }}>
        {confirmDelete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <AppText variant="subheadMedium" tone="danger" style={{ flex: 1 }}>
              Delete this note?
            </AppText>
            <PressableScale haptic="medium" onPress={handleDelete} accessibilityLabel="Confirm delete">
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  backgroundColor: colors.dangerSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Trash size={17} color={colors.danger} weight="bold" />
              </View>
            </PressableScale>
            <PressableScale haptic="selection" onPress={() => setConfirmDelete(false)} accessibilityLabel="Cancel delete">
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <X size={16} color={colors.text} weight="bold" />
              </View>
            </PressableScale>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BackRow />
            <View style={{ flex: 1 }} />
            <AppText variant="mono" tone="tertiary">
              {saveState}
            </AppText>
            <PressableScale haptic="selection" onPress={handlePin} accessibilityLabel="Pin note">
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: spacing.sm,
                }}>
                <PushPin
                  size={17}
                  color={note.data?.pinned ? colors.accent : colors.textSecondary}
                  weight={note.data?.pinned ? 'fill' : 'regular'}
                />
              </View>
            </PressableScale>
            <PressableScale haptic="selection" onPress={() => setConfirmDelete(true)} accessibilityLabel="Delete note">
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Trash size={17} color={colors.textSecondary} weight="regular" />
              </View>
            </PressableScale>
          </View>
        )}

        <TextInput
          value={title}
          onChangeText={handleChangeTitle}
          placeholder="Title"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: 26,
            lineHeight: 34,
            letterSpacing: -0.4,
            color: colors.text,
            paddingVertical: spacing.md,
          }}
        />
        <View style={{ height: 1, backgroundColor: colors.hairline }} />

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}>
          <TextInput
            value={body}
            onChangeText={handleChangeBody}
            placeholder="Write it down. Markdown-ish is welcome."
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            multiline
            scrollEnabled={false}
            style={{
              fontFamily: fonts.bodyRegular,
              fontSize: 16,
              lineHeight: 24,
              color: colors.text,
              paddingVertical: spacing.lg,
              minHeight: 320,
            }}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
