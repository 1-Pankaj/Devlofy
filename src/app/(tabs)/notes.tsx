/**
 * Notes — searchable, local, markdown-friendly. Opens the editor on tap.
 */
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Briefcase,
  MagnifyingGlass,
  NotePencil,
  Notebook,
  PushPin,
  UsersThree,
} from 'phosphor-react-native';
import { useDeferredValue, useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { createNote, listNotes, type NoteListRow } from '@/lib/db/repo';
import { formatDayLabel } from '@/lib/format';
import { splitTags } from '@/lib/tags';
import { spacing, useTheme } from '@/theme';

export default function NotesScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const notes = useLiveQuery((d) => listNotes(d, deferredSearch), { deps: [deferredSearch] });
  const rows = notes.data ?? [];

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await createNote(db);
      router.push({ pathname: '/note/[id]', params: { id } });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen
      scroll={false}
      contentStyle={{ flexGrow: 1 }}
      header={{
        eyebrow: 'knowledge',
        title: 'Notes',
        subtitle:
          notes.status === 'ready'
            ? `${rows.length} ${rows.length === 1 ? 'note' : 'notes'} on this device`
            : undefined,
        trailing: (
          <AppButton
            label="New note"
            icon={NotePencil}
            variant="soft"
            onPress={handleCreate}
            disabled={creating}
          />
        ),
      }}>
      <FadeUp index={0} style={{ flexGrow: 1, gap: spacing.xxl }}>
        <View>
          <View style={{ position: 'absolute', left: 14, top: 15, zIndex: 1 }}>
            <MagnifyingGlass size={17} color={colors.textTertiary} weight="bold" />
          </View>
          <TextField
            value={search}
            onChangeText={setSearch}
            placeholder="Search titles, bodies, tags…"
            inputStyle={{ paddingLeft: 42, minHeight: 48 }}
          />
        </View>

        <Panel style={{ flex: 1 }} coreStyle={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          {notes.status === 'loading' && rows.length === 0 ? (
            <Loading label="reading the shelf…" />
          ) : notes.status === 'error' && rows.length === 0 ? (
            <View style={{ padding: spacing.xl, gap: spacing.sm }}>
              <AppText variant="subheadMedium" tone="danger">
                Could not read notes.
              </AppText>
              <PressableScale haptic="selection" onPress={() => notes.refresh()}>
                <AppText variant="captionMedium" tone="accent">
                  Retry
                </AppText>
              </PressableScale>
            </View>
          ) : (
            <FlashList
              style={{ flex: 1 }}
              data={rows}
              keyExtractor={(item: NoteListRow) => item.id}
              renderItem={({ item, index }: { item: NoteListRow; index: number }) => {
                const tags = splitTags(item.tags);
                const hasMeta = tags.length > 0 || item.client_name || item.project_name;
                return (
                  <ListRow
                    icon={
                      item.pinned ? (
                        <PushPin size={16} color={colors.accent} weight="fill" />
                      ) : (
                        <NotePencil size={16} color={colors.textTertiary} weight="light" />
                      )
                    }
                    title={item.title || 'Untitled note'}
                    subtitle={item.preview.replace(/\s+/g, ' ').trim() || 'Empty note'}
                    footer={
                      hasMeta ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: spacing.sm,
                          }}>
                          {item.project_name ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Briefcase size={10} color={colors.textTertiary} weight="light" />
                              <AppText variant="caption" tone="tertiary">
                                {item.project_name}
                              </AppText>
                            </View>
                          ) : null}
                          {item.client_name ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <UsersThree size={10} color={colors.textTertiary} weight="light" />
                              <AppText variant="caption" tone="tertiary">
                                {item.client_name}
                              </AppText>
                            </View>
                          ) : null}
                          {tags.map((tag) => (
                            <AppText key={tag} variant="captionMedium" tone="accent">
                              #{tag}
                            </AppText>
                          ))}
                        </View>
                      ) : undefined
                    }
                    showSeparator={index < rows.length - 1}
                    onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
                    trailing={
                      <AppText variant="caption" tone="tertiary">
                        {formatDayLabel(item.updated_at)}
                      </AppText>
                    }
                  />
                );
              }}
              ListEmptyComponent={
                <EmptyState
                  icon={Notebook}
                  image={deferredSearch ? undefined : emptyArt.notes}
                  title={deferredSearch ? 'No matches' : 'No notes yet'}
                  message={
                    deferredSearch
                      ? 'Try a different word — search looks at titles, bodies, and tags.'
                      : 'Capture the plan, the snippet, the client call. It stays here.'
                  }
                />
              }
            />
          )}
        </Panel>
      </FadeUp>
    </Screen>
  );
}
