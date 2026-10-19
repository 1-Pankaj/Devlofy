/**
 * Notes — searchable, filterable, local. Opens the block editor on tap.
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
  Tag,
  UsersThree,
} from 'phosphor-react-native';
import { useDeferredValue, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Fab } from '@/components/ui/fab';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { createNote, listExistingTags, listNotes, type NoteListRow } from '@/lib/db/repo';
import { formatDayLabel } from '@/lib/format';
import { plainPreview } from '@/lib/notes/blocks';
import { splitTags } from '@/lib/tags';
import { radius, spacing, useTheme } from '@/theme';

export default function NotesScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const notes = useLiveQuery((d) => listNotes(d, deferredSearch), { deps: [deferredSearch] });
  const tagPool = useLiveQuery((d) => listExistingTags(d));
  const rows = notes.data ?? [];
  const tags = (tagPool.data ?? []).slice(0, 12);
  const visible = tag ? rows.filter((row) => splitTags(row.tags).includes(tag)) : rows;

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
      }}
      fab={
        <Fab label="New note" icon={NotePencil} onPress={handleCreate} disabled={creating} />
      }>
      <FadeUp index={0} style={{ flexGrow: 1, gap: spacing.xxl }}>
        <View style={{ gap: spacing.md }}>
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

          {tags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: spacing.sm, alignItems: 'center' }}>
              <PressableScale
                haptic="selection"
                accessibilityLabel="Show every note"
                onPress={() => setTag(null)}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    paddingHorizontal: spacing.md,
                    height: 32,
                    borderRadius: radius.full,
                    backgroundColor: tag === null ? colors.accentSoft : colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: tag === null ? colors.accentBorder : colors.hairline,
                  }}>
                  <AppText variant="captionMedium" tone={tag === null ? 'accent' : 'secondary'}>
                    All
                  </AppText>
                </View>
              </PressableScale>
              {tags.map((entry) => {
                const active = tag === entry;
                return (
                  <PressableScale
                    key={entry}
                    haptic="selection"
                    accessibilityLabel={`Filter by ${entry}`}
                    onPress={() => setTag(active ? null : entry)}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        paddingHorizontal: spacing.md,
                        height: 32,
                        borderRadius: radius.full,
                        backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
                        borderWidth: 1,
                        borderColor: active ? colors.accentBorder : colors.hairline,
                      }}>
                      <Tag size={11} color={active ? colors.accent : colors.textTertiary} weight="light" />
                      <AppText variant="captionMedium" tone={active ? 'accent' : 'secondary'}>
                        {entry}
                      </AppText>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <Panel style={{ flex: 1 }} coreStyle={{ flex: 1, padding: 0, overflow: 'hidden' }}>
          {notes.status === 'loading' && rows.length === 0 ? (
            <Loading label="reading the shelf…" />
          ) : notes.status === 'error' && rows.length === 0 ? (
            <ErrorState what="notes" onRetry={() => notes.refresh()} />
          ) : (
            <FlashList
              style={{ flex: 1 }}
              data={visible}
              keyExtractor={(item: NoteListRow) => item.id}
              renderItem={({ item, index }: { item: NoteListRow; index: number }) => {
                const rowTags = splitTags(item.tags);
                const hasMeta = rowTags.length > 0 || item.client_name || item.project_name;
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
                    subtitle={plainPreview(item.preview, 140) || 'Empty note'}
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
                          {rowTags.map((entry) => (
                            <AppText key={entry} variant="captionMedium" tone="accent">
                              #{entry}
                            </AppText>
                          ))}
                        </View>
                      ) : undefined
                    }
                    showSeparator={index < visible.length - 1}
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
                  image={deferredSearch || tag ? undefined : emptyArt.notes}
                  title={
                    tag
                      ? `No notes tagged #${tag}`
                      : deferredSearch
                        ? 'No matches'
                        : 'No notes yet'
                  }
                  message={
                    tag
                      ? 'Untag it, or clear the filter to see everything.'
                      : deferredSearch
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
