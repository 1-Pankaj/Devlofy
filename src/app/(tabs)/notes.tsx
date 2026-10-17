/**
 * Notes — searchable, local, markdown-friendly. Opens the editor on tap.
 */
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { MagnifyingGlass, NotePencil, Notebook, PushPin } from 'phosphor-react-native';
import { useDeferredValue, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { createNote, listNotes, type NoteListRow } from '@/lib/db/repo';
import { formatDayLabel } from '@/lib/format';
import { spacing, useTheme } from '@/theme';

export default function NotesScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const notes = useLiveQuery((d) => listNotes(d, deferredSearch), { deps: [deferredSearch] });
  const rows = notes.data ?? [];

  const handleCreate = async () => {
    const id = await createNote(db);
    router.push({ pathname: '/note/[id]', params: { id } });
  };

  return (
    <Screen
      scroll={false}
      contentStyle={{ flexGrow: 1 }}
      header={{
        eyebrow: 'knowledge',
        title: 'Notes',
        subtitle: `${rows.length} ${rows.length === 1 ? 'note' : 'notes'} on this device`,
        trailing: <AppButton label="New note" icon={NotePencil} variant="soft" onPress={handleCreate} />,
      }}>
      <FadeUp index={0} style={{ flexGrow: 1, gap: spacing.xxl }}>
        <View>
          <View style={{ position: 'absolute', left: 14, top: 15, zIndex: 1 }}>
            <MagnifyingGlass size={17} color={colors.textTertiary} weight="bold" />
          </View>
          <TextField
            value={search}
            onChangeText={setSearch}
            placeholder="Search titles and bodies…"
            inputStyle={{ paddingLeft: 42, minHeight: 48 }}
          />
        </View>

        <Panel style={{ flex: 1 }} coreStyle={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          <FlashList
            style={{ flex: 1 }}
            data={rows}
            keyExtractor={(item: NoteListRow) => item.id}
            renderItem={({ item, index }: { item: NoteListRow; index: number }) => (
              <ListRow
                icon={
                  item.pinned ? (
                    <PushPin size={16} color={colors.accent} weight="fill" />
                  ) : (
                    <NotePencil size={16} color={colors.textTertiary} weight="light" />
                  )
                }
                title={item.title || 'Untitled note'}
                subtitle={item.preview.replaceAll('\n', ' ') || 'Empty note'}
                showSeparator={index < rows.length - 1}
                onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
                trailing={
                  <AppText variant="caption" tone="tertiary">
                    {formatDayLabel(item.updated_at)}
                  </AppText>
                }
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={Notebook}
                title={deferredSearch ? 'No matches' : 'No notes yet'}
                message={
                  deferredSearch
                    ? 'Try a different word — search looks at titles and bodies.'
                    : 'Capture the plan, the snippet, the client call. It stays here.'
                }
              />
            }
          />
        </Panel>
      </FadeUp>
    </Screen>
  );
}
