/**
 * Search — one field over everything the app stores.
 *
 * A local-first app should never make you remember *where* a thing lives: a name
 * you half-remember could be a project, a client, a note, or a task. This screen
 * asks the database once per kind and returns the four groups together, so the
 * answer arrives even when you guessed the wrong noun.
 *
 * Reached from the Today header, or Cmd/Ctrl-K on web.
 */
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CaretRight,
  CheckCircle,
  CheckSquare,
  CircleIcon,
  FileText,
  Folder,
  MagnifyingGlass,
  UsersThree,
} from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { useLiveQuery } from '@/lib/db/hooks';
import { searchEverything, setTaskDone, type SearchHit } from '@/lib/db/repo';
import { fonts, radius, spacing, useTheme } from '@/theme';

const GROUPS: { kind: SearchHit['kind']; title: string; eyebrow: string }[] = [
  { kind: 'project', title: 'Projects', eyebrow: 'portfolio' },
  { kind: 'client', title: 'Clients', eyebrow: 'relationships' },
  { kind: 'note', title: 'Notes', eyebrow: 'writing' },
  { kind: 'task', title: 'Tasks', eyebrow: 'plan' },
];

export default function SearchScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);

  // Debounce so a fast typist does not run four LIKE queries per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 140);
    return () => clearTimeout(handle);
  }, [query]);

  const results = useLiveQuery((d) => searchEverything(d, debounced), { deps: [debounced] });

  const grouped = useMemo(() => {
    const hits = results.data ?? [];
    return GROUPS.map((group) => ({
      ...group,
      hits: hits.filter((hit) => hit.kind === group.kind),
    })).filter((group) => group.hits.length > 0);
  }, [results.data]);

  const handleToggleTask = useCallback(
    async (hit: SearchHit) => {
      await setTaskDone(db, hit.id, hit.done !== 1);
      await results.refresh();
    },
    [db, results],
  );

  const handleOpen = useCallback(
    (hit: SearchHit) => {
      if (hit.kind === 'project') router.push({ pathname: '/project/[id]', params: { id: hit.id } });
      else if (hit.kind === 'client')
        router.push({ pathname: '/client/[id]', params: { id: hit.id } });
      else if (hit.kind === 'note') router.push({ pathname: '/note/[id]', params: { id: hit.id } });
      else handleToggleTask(hit);
    },
    [handleToggleTask, router],
  );

  const typed = debounced.trim().length >= 2;
  const searching = typed && results.status === 'loading' && !results.data;
  const total = (results.data ?? []).length;

  return (
    <Screen
      header={{ eyebrow: 'everything', title: 'Search' }}
      contentStyle={{ gap: spacing.xl }}>
      <View style={{ marginTop: -spacing.md }}>
        <BackRow label="Close" />
      </View>

      <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingLeft: spacing.lg,
            paddingRight: spacing.lg,
            borderBottomWidth: focused ? 2 : 1,
            borderBottomColor: focused ? colors.accent : colors.hairline,
          }}>
          <MagnifyingGlass size={17} color={colors.textTertiary} weight="bold" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Projects, clients, notes, tasks…"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search everything"
            style={{
              flex: 1,
              paddingVertical: 14,
              color: colors.text,
              fontFamily: fonts.bodyRegular,
              fontSize: 16,
            }}
          />
          {process.env.EXPO_OS === 'web' && query.length === 0 ? (
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 3,
                borderRadius: radius.sm,
                backgroundColor: colors.surfaceElevated,
              }}>
              <AppText variant="caption" tone="tertiary">
                ⌘K
              </AppText>
            </View>
          ) : null}
        </View>
      </Panel>

      {searching ? (
        <Panel>
          <Loading label="searching this device…" />
        </Panel>
      ) : !typed ? (
        <Panel>
          <EmptyState
            icon={MagnifyingGlass}
            title="Start typing"
            message="Two characters is enough. Search looks inside titles, note bodies and project descriptions — all on this device."
          />
        </Panel>
      ) : total === 0 ? (
        <Panel>
          <EmptyState
            icon={MagnifyingGlass}
            title={`Nothing for “${debounced.trim()}”`}
            message="No project, client, note or task matches. Try a shorter word."
          />
        </Panel>
      ) : (
        grouped.map((group) => (
          <View key={group.kind}>
            <SectionHeader
              eyebrow={group.eyebrow}
              title={group.title}
              trailing={
                <AppText variant="caption" tone="secondary">
                  {group.hits.length}
                </AppText>
              }
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {group.hits.map((hit, index) => {
                const done = hit.kind === 'task' && hit.done === 1;
                return (
                  <ListRow
                    key={`${hit.kind}-${hit.id}`}
                    icon={
                      hit.kind === 'project' ? (
                        <Folder size={17} color={colors.accent} weight="light" />
                      ) : hit.kind === 'client' ? (
                        <UsersThree size={17} color={colors.textTertiary} weight="light" />
                      ) : hit.kind === 'note' ? (
                        <FileText size={17} color={colors.textTertiary} weight="light" />
                      ) : hit.kind === 'task' ? (
                        <CheckSquare size={17} color={colors.textTertiary} weight="light" />
                      ) : (
                        <CircleIcon size={17} color={colors.textTertiary} weight="light" />
                      )
                    }
                    tone={hit.kind === 'project' ? 'accent' : 'neutral'}
                    title={hit.title}
                    subtitle={hit.subtitle ?? undefined}
                    showSeparator={index < group.hits.length - 1}
                    onPress={() => handleOpen(hit)}
                    trailing={
                      hit.kind === 'task' ? (
                        done ? (
                          <CheckCircle size={20} color={colors.accent} weight="fill" />
                        ) : (
                          <CircleIcon size={20} color={colors.hairlineStrong} weight="regular" />
                        )
                      ) : (
                        <CaretRight size={14} color={colors.textTertiary} weight="bold" />
                      )
                    }
                  />
                );
              })}
            </Panel>
          </View>
        ))
      )}

      {total > 0 ? (
        <AppText variant="caption" tone="tertiary">
          {total} {total === 1 ? 'result' : 'results'} · everything stays on this device
        </AppText>
      ) : null}
    </Screen>
  );
}
