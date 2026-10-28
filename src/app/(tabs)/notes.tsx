/**
 * Notes — searchable, filterable, local. Opens the block editor on tap.
 *
 * The page is a shelf: one search field, a row of tag chips that filters it, and
 * the notes themselves as a single ruled list. Nothing here is a card inside a
 * card — the list is a panel, the rows are lines in it, and the only saturated
 * colour is the selected tag.
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
  X,
} from 'phosphor-react-native';
import { useDeferredValue, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

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
import { useLiveQuery } from '@/lib/db/hooks';
import { createNote, listExistingTags, listNotes, type NoteListRow } from '@/lib/db/repo';
import { formatDayLabel } from '@/lib/format';
import { plainPreview } from '@/lib/notes/blocks';
import { messageOf } from '@/lib/use-async-data';
import { splitTags } from '@/lib/tags';
import { fonts, radius, spacing, useTheme } from '@/theme';

export default function NotesScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createProblem, setCreateProblem] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const notes = useLiveQuery((d) => listNotes(d, deferredSearch), { deps: [deferredSearch] });
  const tagPool = useLiveQuery((d) => listExistingTags(d));
  const rows = notes.data ?? [];
  const tags = (tagPool.data ?? []).slice(0, 12);
  const visible = tag ? rows.filter((row) => splitTags(row.tags).includes(tag)) : rows;
  const pinned = rows.filter((row) => row.pinned).length;

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setCreateProblem(null);
    try {
      const id = await createNote(db);
      router.push({ pathname: '/note/[id]', params: { id } });
    } catch (error) {
      // The FAB stopped spinning and nothing opened: say why.
      setCreateProblem(messageOf(error));
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
            ? `${rows.length} ${rows.length === 1 ? 'note' : 'notes'} · ${pinned} pinned · on this device`
            : undefined,
      }}
      fab={
        <Fab label="New note" icon={NotePencil} onPress={handleCreate} disabled={creating} />
      }>
      <FadeUp index={0} style={{ flexGrow: 1, gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          {/* Search: the same hairline box as every other control, with the lens
              inside it and a real clear button when there is something to clear. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              height: 46,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: searchFocused ? colors.accent : colors.hairlineStrong,
              backgroundColor: colors.surface,
              boxShadow: searchFocused ? `0 0 0 3px ${colors.accentSoft}` : undefined,
            }}>
            <MagnifyingGlass size={16} color={colors.textTertiary} weight="bold" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search titles, bodies, tags…"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search notes"
              style={{
                flex: 1,
                color: colors.text,
                fontFamily: fonts.bodyRegular,
                fontSize: 15,
                paddingVertical: 0,
              }}
            />
            {search.length > 0 ? (
              <PressableScale
                haptic="selection"
                accessibilityLabel="Clear the search"
                onPress={() => setSearch('')}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.full,
                    backgroundColor: colors.surfaceSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <X size={11} color={colors.textSecondary} weight="bold" />
                </View>
              </PressableScale>
            ) : (
              <AppText variant="monoLabel" tone="tertiary" style={{ fontSize: 9.5 }}>
                {rows.length} in shelf
              </AppText>
            )}
          </View>

          {createProblem ? (
            <AppText variant="caption" tone="danger">
              {createProblem}
            </AppText>
          ) : null}

          {tags.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: spacing.xs, alignItems: 'center' }}>
              <TagChip label="All" active={tag === null} onPress={() => setTag(null)} />
              {tags.map((entry) => (
                <TagChip
                  key={entry}
                  label={entry}
                  active={tag === entry}
                  icon
                  onPress={() => setTag(tag === entry ? null : entry)}
                />
              ))}
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
                        <PushPin size={15} color={colors.accent} weight="fill" />
                      ) : (
                        <NotePencil size={15} color={colors.textTertiary} weight="regular" />
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
                            columnGap: spacing.sm,
                            rowGap: 2,
                          }}>
                          {item.project_name ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Briefcase size={10} color={colors.textTertiary} weight="regular" />
                              <AppText variant="caption" tone="tertiary">
                                {item.project_name}
                              </AppText>
                            </View>
                          ) : null}
                          {item.client_name ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <UsersThree size={10} color={colors.textTertiary} weight="regular" />
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
                      <AppText variant="code" tone="tertiary" style={{ fontSize: 11 }}>
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

/** A filter tag: a small box, not a pill — same geometry as the fields above it. */
function TagChip({
  label,
  active,
  icon = false,
  onPress,
}: {
  label: string;
  active: boolean;
  icon?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <PressableScale
      haptic="selection"
      accessibilityLabel={icon ? `Filter by ${label}` : 'Show every note'}
      onPress={onPress}>
      <View
        accessibilityState={{ selected: active }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: spacing.sm + 2,
          height: 28,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : colors.hairline,
          backgroundColor: active ? colors.accentSoft : colors.surface,
        }}>
        {icon ? (
          <Tag size={10} color={active ? colors.accent : colors.textTertiary} weight="regular" />
        ) : null}
        <AppText
          variant="captionMedium"
          style={{ fontSize: 12, color: active ? colors.accent : colors.textSecondary }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}
