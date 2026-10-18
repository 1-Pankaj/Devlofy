/**
 * Bench — the shelf.
 *
 * Eleven tools in five groups, filtered live, with the saved snippets at the top
 * when there are any. The promise is in the header and in the "offline" pill on
 * every tool: whatever you paste in here is processed by this device and thrown
 * away unless you press keep. That is the whole reason to have these tools in an
 * app instead of in a browser tab.
 */
import { useRouter } from 'expo-router';
import { BookmarkSimple, MagnifyingGlass } from 'phosphor-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { countSnippets } from '@/lib/db/repo';
import { useLiveQuery } from '@/lib/db/hooks';
import { BENCH_GROUPS, searchTools, toolsInGroup } from '@/lib/bench/tools';
import { spacing, useTheme } from '@/theme';

export default function BenchShelfScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const snippets = useLiveQuery((db) => countSnippets(db), { deps: [] });
  const matching = searchTools(query);
  const filtering = query.trim().length > 0;

  const openTool = (id: string) => router.push({ pathname: '/bench/[tool]', params: { tool: id } });

  return (
    <Screen
      header={{
        eyebrow: 'Offline tools',
        title: 'Bench',
        subtitle: 'Eleven tools that run on this device. Nothing you paste is uploaded.',
      }}>
      <FadeUp index={0}>
        <BackRow label="More" />
      </FadeUp>

      <FadeUp index={1}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="json, base64, cron, contrast…"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
        />
      </FadeUp>

      {snippets.data !== null && snippets.data > 0 && !filtering ? (
        <FadeUp index={2}>
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <ListRow
              icon={<BookmarkSimple size={17} color={colors.accent} weight="light" />}
              tone="accent"
              title="Saved snippets"
              subtitle={`${snippets.data} kept on this device`}
              onPress={() => router.push('/bench/snippets')}
            />
          </Panel>
        </FadeUp>
      ) : null}

      {matching.length === 0 ? (
        <FadeUp index={2}>
          <EmptyState
            icon={MagnifyingGlass}
            title="No tool by that name"
            message="Try “hash”, “sha256”, “contrast”, “base64”, “cron” or “types”."
          />
        </FadeUp>
      ) : null}

      {BENCH_GROUPS.map((group, groupIndex) => {
        const tools = filtering ? matching.filter((tool) => tool.group === group.id) : toolsInGroup(group.id);
        if (tools.length === 0) return null;

        return (
          <FadeUp key={group.id} index={groupIndex + 2}>
            <SectionHeader eyebrow={group.label} title={group.blurb} />
            <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <ListRow
                    key={tool.id}
                    icon={<Icon size={17} color={colors.textSecondary} weight="light" />}
                    title={tool.name}
                    subtitle={tool.blurb}
                    showSeparator={index < tools.length - 1}
                    onPress={() => openTool(tool.id)}
                  />
                );
              })}
            </Panel>
          </FadeUp>
        );
      })}

      <FadeUp index={BENCH_GROUPS.length + 2}>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="tertiary">
            No network, no account, no upload. Results are computed as you type and are gone when you
            leave the screen — unless you press keep, which writes to the app’s own database.
          </AppText>
        </View>
      </FadeUp>
    </Screen>
  );
}
