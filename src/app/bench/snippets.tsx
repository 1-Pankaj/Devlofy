/**
 * Snippets — what you kept.
 *
 * Snippets are user content, so they live in SQLite with the rest of it (and are
 * included in the app's own export), not in KV with GitHub's cache. Tapping one
 * opens it *in the tool that made it*, which is the difference between a saved
 * value and a saved value you can still use.
 *
 * The rows are deliberately not interactive past opening: a row is one button, and
 * a button inside a button is invalid HTML on web and ambiguous to a screen reader
 * (the same rule the GitHub hub follows for its private pill). Deleting therefore
 * happens where the snippet is open, in the panel that owns its identity.
 */
import { useRouter } from 'expo-router';
import { BookmarkSimple } from 'phosphor-react-native';
import { useState } from 'react';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow } from '@/components/ui/list-row';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { listSnippets } from '@/lib/db/repo';
import { useLiveQuery } from '@/lib/db/hooks';
import { previewOf } from '@/lib/bench/encode';
import { toolById } from '@/lib/bench/tools';
import { formatAgo } from '@/lib/format';

export default function BenchSnippetsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const snippets = useLiveQuery((db) => listSnippets(db, query), { deps: [query] });
  const rows = snippets.data ?? [];
  const searching = query.trim().length > 0;

  return (
    <Screen
      header={{
        eyebrow: 'Bench · kept',
        title: 'Snippets',
        subtitle:
          snippets.status === 'error'
            ? 'Could not read what you kept.'
            : rows.length === 0
              ? 'Anything you keep from a tool lands here.'
              : `${rows.length} kept on this device.`,
      }}>
      <FadeUp index={0}>
        <BackRow label="Bench" />
      </FadeUp>

      <FadeUp index={1}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search titles and contents"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={60}
        />
      </FadeUp>

      {snippets.status === 'error' && rows.length === 0 ? (
        <FadeUp index={2}>
          <Panel>
            <ErrorState what="your kept snippets" onRetry={() => snippets.refresh()} />
          </Panel>
        </FadeUp>
      ) : rows.length === 0 ? (
        <FadeUp index={2}>
          <EmptyState
            icon={BookmarkSimple}
            title={searching ? 'Nothing matches' : 'Nothing kept yet'}
            message={
              searching
                ? 'Search looks in the title and the contents.'
                : 'Every tool ends with a “keep this” panel. Save a formatted document, a pattern or a colour and it will be waiting here.'
            }
          />
        </FadeUp>
      ) : (
        <FadeUp index={2}>
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((row, index) => {
              const tool = toolById(row.tool);
              return (
                <ListRow
                  key={row.id}
                  title={row.title}
                  subtitle={`${previewOf(row.body, 44)} · ${formatAgo(row.updated_at)}`}
                  showSeparator={index < rows.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: '/bench/[tool]',
                      params: { tool: row.tool, snippet: row.id },
                    })
                  }
                  trailing={<StatusPill label={tool?.name ?? row.tool} tone="neutral" />}
                />
              );
            })}
          </Panel>
        </FadeUp>
      )}

      {rows.length > 0 ? (
        <FadeUp index={3}>
          <AppText variant="caption" tone="tertiary">
            Tap one to open it in the tool that made it. To remove a snippet, open it and use the
            delete action in its “keep this” panel — nothing disappears from this list by accident.
          </AppText>
        </FadeUp>
      ) : null}
    </Screen>
  );
}
