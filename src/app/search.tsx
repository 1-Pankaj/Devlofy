/**
 * Search — one field over everything the app stores.
 *
 * A local-first app should never make you remember *where* a thing lives: a name
 * you half-remember could be a project, a client, a note, or a task. This screen
 * asks the database once per kind and returns every group together, so the
 * answer arrives even when you guessed the wrong noun.
 *
 * Bench's tools are the exception — they are code, not rows — and they are the
 * most-forgotten thing in the app, so they are matched here too: typing "sha256"
 * or "base64" opens the tool rather than reporting nothing.
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
  Pulse,
  UsersThree,
} from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { useLiveQuery } from '@/lib/db/hooks';
import { searchEverything, setTaskDone, type SearchHit } from '@/lib/db/repo';
import { searchTools, toolById } from '@/lib/bench/tools';
import { useBreakpoint } from '@/lib/layout/breakpoints';
import { searchShortcutLabel } from '@/lib/search-shortcut';
import { fonts, radius, spacing, useTheme } from '@/theme';

/**
 * Bench's tools are a registry, not rows, so they are the one kind this screen
 * merges in itself. Keeping the shape the same means the render below has one
 * union to branch on rather than two lists.
 */
type ToolHit = { kind: 'tool'; id: string; title: string; subtitle: string | null };
type ResultRow = SearchHit | ToolHit;

const GROUPS: { kind: ResultRow['kind']; title: string; eyebrow: string }[] = [
  { kind: 'project', title: 'Projects', eyebrow: 'portfolio' },
  { kind: 'client', title: 'Clients', eyebrow: 'relationships' },
  { kind: 'note', title: 'Notes', eyebrow: 'writing' },
  { kind: 'task', title: 'Tasks', eyebrow: 'plan' },
  { kind: 'site', title: 'Watch targets', eyebrow: 'the outside world' },
  { kind: 'tool', title: 'Bench tools', eyebrow: 'offline' },
];

export default function SearchScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const compact = useBreakpoint() === 'compact';

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
    // Bench's eleven tools are not database rows, so they are matched with the
    // shelf's own `searchTools` — one matcher, so "sha256" finds Hash here exactly
    // as it does there. Below the two-character floor, both sources stay quiet.
    const rows: ResultRow[] = results.data ? [...results.data] : [];
    if (debounced.trim().length >= 2) {
      for (const tool of searchTools(debounced)) {
        rows.push({ kind: 'tool', id: tool.id, title: tool.name, subtitle: tool.blurb });
      }
    }
    return GROUPS.map((group) => ({
      ...group,
      hits: rows.filter((hit) => hit.kind === group.kind),
    })).filter((group) => group.hits.length > 0);
  }, [results.data, debounced]);

  const handleToggleTask = useCallback(
    async (hit: SearchHit) => {
      await setTaskDone(db, hit.id, hit.done !== 1);
      await results.refresh();
    },
    [db, results],
  );

  const handleOpen = useCallback(
    (hit: ResultRow) => {
      if (hit.kind === 'project') router.push({ pathname: '/project/[id]', params: { id: hit.id } });
      else if (hit.kind === 'client')
        router.push({ pathname: '/client/[id]', params: { id: hit.id } });
      else if (hit.kind === 'note') router.push({ pathname: '/note/[id]', params: { id: hit.id } });
      else if (hit.kind === 'site')
        router.push({ pathname: '/sentinel/[id]', params: { id: hit.id } });
      else if (hit.kind === 'tool')
        router.push({ pathname: '/bench/[tool]', params: { tool: hit.id } });
      else handleToggleTask(hit);
    },
    [handleToggleTask, router],
  );

  const typed = debounced.trim().length >= 2;
  const searching = typed && results.status === 'loading' && !results.data;
  // A failed search is not an empty one: `results.refresh` is the only way back.
  const failed = typed && results.status === 'error' && !results.data;
  const total = grouped.reduce((count, group) => count + group.hits.length, 0);

  return (
    <Screen
      header={{ eyebrow: 'everything', title: 'Search' }}
      contentStyle={{ gap: spacing.xl }}>
      <View style={{ marginTop: -spacing.md }}>
        <BackRow label="Close" />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          height: 50,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.hairlineStrong,
          backgroundColor: colors.surface,
          boxShadow: focused ? `0 0 0 3px ${colors.accentSoft}` : undefined,
        }}>
        <MagnifyingGlass size={17} color={colors.textTertiary} weight="bold" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Projects, notes, tasks, tools…"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          autoFocus
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search everything"
          style={{
            flex: 1,
            color: colors.text,
            fontFamily: fonts.bodyRegular,
            fontSize: 16,
          }}
        />
        {/* A key cap is only honest where the key exists: a phone has no ⌘ and
            no Ctrl, so the field keeps its placeholder and drops the cap. */}
        {process.env.EXPO_OS === 'web' && !compact && query.length === 0 ? (
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.xs,
              borderWidth: 1,
              borderColor: colors.hairline,
              backgroundColor: colors.surfaceElevated,
            }}>
            <AppText variant="code" tone="tertiary" style={{ fontSize: 10 }}>
              {searchShortcutLabel}
            </AppText>
          </View>
        ) : null}
      </View>

      {searching ? (
        <Panel>
          <Loading label="searching this device…" />
        </Panel>
      ) : failed ? (
        <Panel>
          <ErrorState
            what="your notes, tasks, projects, clients and targets"
            onRetry={() => results.refresh()}
          />
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
            message="No project, client, note, task, watch target or Bench tool matches. Try a shorter word."
          />
        </Panel>
      ) : (
        grouped.map((group) => (
          <View key={group.kind}>
            <SectionHeader
              eyebrow={group.eyebrow}
              title={group.title}
              trailing={
                <AppText variant="code" tone="tertiary">
                  {group.hits.length}
                </AppText>
              }
            />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {group.hits.map((hit, index) => {
                const done = hit.kind === 'task' && hit.done === 1;
                // A tool hit wears its own glyph: the row should look like the
                // tool it opens, the same way a project hit wears a folder.
                const ToolIcon = hit.kind === 'tool' ? toolById(hit.id)?.icon : undefined;
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
                      ) : hit.kind === 'site' ? (
                        <Pulse size={17} color={colors.accent} weight="light" />
                      ) : ToolIcon ? (
                        <ToolIcon size={17} color={colors.accent} weight="light" />
                      ) : (
                        <CircleIcon size={17} color={colors.textTertiary} weight="light" />
                      )
                    }
                    tone={
                      hit.kind === 'project' || hit.kind === 'site' || hit.kind === 'tool'
                        ? 'accent'
                        : 'neutral'
                    }
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
        <AppText variant="code" tone="tertiary">
          {total} {total === 1 ? 'result' : 'results'} · everything stays on this device
        </AppText>
      ) : null}
    </Screen>
  );
}
