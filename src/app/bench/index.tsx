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
import type { BenchTool } from '@/lib/bench/tools';
import { countSnippets } from '@/lib/db/repo';
import { useLiveQuery } from '@/lib/db/hooks';
import { BENCH_GROUPS, searchTools, toolsInGroup } from '@/lib/bench/tools';
import { useBreakpoint } from '@/lib/layout/breakpoints';
import { spacing, useTheme } from '@/theme';

type VisibleGroup = {
  group: (typeof BENCH_GROUPS)[number];
  tools: BenchTool[];
};

/**
 * Split the groups across two columns on a wide page, preserving reading order.
 *
 * A contiguous split (left column first, right column second) is what keeps the
 * filtered results in the order they were listed, so the only choice is *where*
 * to cut. Each group costs about two rows of chrome beyond its tools, and the
 * cut chosen is the one that leaves the two columns closest in height.
 */
function columnsOf(groups: VisibleGroup[]): [VisibleGroup[], VisibleGroup[]] {
  if (groups.length < 2) return [groups, []];

  const weight = (entry: VisibleGroup) => entry.tools.length + 2;
  const prefix = [0];
  for (const entry of groups) prefix.push(prefix[prefix.length - 1] + weight(entry));

  const total = prefix[prefix.length - 1];
  let split = 1;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < groups.length; index += 1) {
    const difference = Math.abs(total - 2 * prefix[index]);
    if (difference < best) {
      best = difference;
      split = index;
    }
  }
  return [groups.slice(0, split), groups.slice(split)];
}

export default function BenchShelfScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const expanded = useBreakpoint() === 'expanded';
  const [query, setQuery] = useState('');

  const snippets = useLiveQuery((db) => countSnippets(db), { deps: [] });
  const matching = searchTools(query);
  const filtering = query.trim().length > 0;

  const openTool = (id: string) => router.push({ pathname: '/bench/[tool]', params: { tool: id } });

  const visibleGroups: VisibleGroup[] = BENCH_GROUPS.map((group) => ({
    group,
    tools: filtering
      ? matching.filter((tool) => tool.group === group.id)
      : toolsInGroup(group.id),
  })).filter((entry) => entry.tools.length > 0);

  const groupBlock = ({ group, tools }: VisibleGroup) => (
    <View key={group.id}>
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
    </View>
  );

  return (
    <Screen
      header={{
        eyebrow: 'Offline tools',
        title: 'Bench',
        subtitle: 'Eleven tools that run on this device. Nothing you paste is uploaded.',
      }}>
      {/* The rail already says "More" on a wide page, so a back row there would
          only repeat the navigation. */}
      {expanded ? null : (
        <FadeUp index={0}>
          <BackRow label="More" />
        </FadeUp>
      )}

      <FadeUp index={expanded ? 0 : 1}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="json, base64, cron, contrast…"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={40}
          style={expanded ? { maxWidth: 520 } : undefined}
        />
      </FadeUp>

      {snippets.status === 'error' ? (
        <FadeUp index={1}>
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            <ListRow
              icon={<BookmarkSimple size={17} color={colors.textTertiary} weight="light" />}
              title="Saved snippets"
              subtitle="Could not read the count — open to look"
              onPress={() => router.push('/bench/snippets')}
            />
          </Panel>
        </FadeUp>
      ) : snippets.data !== null && snippets.data > 0 && !filtering ? (
        <FadeUp index={1}>
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

      {expanded ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
          {columnsOf(visibleGroups).map((column, columnIndex) =>
            column.length === 0 ? null : (
              <FadeUp
                key={columnIndex === 0 ? 'left-column' : 'right-column'}
                index={2 + columnIndex}
                style={{ flex: 1, minWidth: 0, gap: spacing.lg }}>
                {column.map(groupBlock)}
              </FadeUp>
            ),
          )}
        </View>
      ) : (
        <FadeUp index={2} style={{ gap: spacing.lg }}>
          {visibleGroups.map(groupBlock)}
        </FadeUp>
      )}

      <FadeUp index={4}>
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
