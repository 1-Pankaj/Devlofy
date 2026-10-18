/**
 * One Bench tool, hosted.
 *
 * The screen owns the chrome — header, back, and the "offline" promise — and the
 * tool owns its own answer. Routing is a plain map, so adding a tool is an entry
 * in `src/lib/bench/tools.ts`, a component, and a line here.
 *
 * A snippet opens *in its tool*: `/bench/json?snippet=<id>` seeds the input, which
 * is what makes kept snippets useful rather than a museum. The tool is keyed by
 * the snippet id so opening a different one remounts it with fresh state instead
 * of leaving the previous document in the box.
 */
import type { ComponentType } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BracketsCurly } from 'phosphor-react-native';

import { ColourTool } from '@/components/bench/colour-tool';
import { CronTool } from '@/components/bench/cron-tool';
import { DiffTool } from '@/components/bench/diff-tool';
import { EncodeTool } from '@/components/bench/encode-tool';
import { EpochTool } from '@/components/bench/epoch-tool';
import { HashTool } from '@/components/bench/hash-tool';
import { JsonTool } from '@/components/bench/json-tool';
import { JwtTool } from '@/components/bench/jwt-tool';
import { RegexTool } from '@/components/bench/regex-tool';
import { SqlTool } from '@/components/bench/sql-tool';
import { TextTool } from '@/components/bench/text-tool';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { getSnippet } from '@/lib/db/repo';
import { useLiveQuery } from '@/lib/db/hooks';
import { toolById, type BenchToolId } from '@/lib/bench/tools';
import { spacing } from '@/theme';

type ToolProps = { initial?: string; snippetId?: string | null };

const TOOLS: Record<BenchToolId, ComponentType<ToolProps>> = {
  json: JsonTool,
  sql: SqlTool,
  diff: DiffTool,
  regex: RegexTool,
  text: TextTool,
  encode: EncodeTool,
  jwt: JwtTool,
  hash: HashTool,
  epoch: EpochTool,
  cron: CronTool,
  colour: ColourTool,
};

export default function BenchToolScreen() {
  const params = useLocalSearchParams<{ tool?: string; snippet?: string }>();
  const tool = toolById(params.tool);
  const snippetId = params.snippet;

  const seed = useLiveQuery(
    async (db) => (snippetId ? await getSnippet(db, snippetId) : null),
    { deps: [snippetId ?? ''], refreshOnFocus: false },
  );

  if (!tool) {
    return (
      <Screen header={{ eyebrow: 'Bench', title: 'Not a tool' }}>
        <BackRow label="Bench" />
        <EmptyState
          icon={BracketsCurly}
          title="No tool by that id"
          message="Open Bench from More and pick one from the shelf."
        />
      </Screen>
    );
  }

  const Tool = TOOLS[tool.id];
  const opening = Boolean(snippetId) && seed.status === 'loading';
  const openingFailed = Boolean(snippetId) && seed.status === 'ready' && seed.data === null;

  return (
    <Screen
      header={{
        eyebrow: 'Bench',
        title: tool.name,
        subtitle: tool.blurb,
        trailing: <StatusPill label="offline" tone="neutral" />,
      }}>
      <FadeUp index={0}>
        <BackRow label="Bench" />
      </FadeUp>

      {seed.data ? (
        <FadeUp index={1}>
          <Panel variant="outlined" style={{ gap: spacing.xs }}>
            <StatusPill label={`opened “${seed.data.title}”`} tone="accent" />
          </Panel>
        </FadeUp>
      ) : null}

      {opening ? (
        <Panel>
          <Loading label="opening the snippet…" />
        </Panel>
      ) : (
        <>
          {openingFailed ? (
            <Panel variant="outlined">
              <StatusPill label="that snippet is gone" tone="neutral" />
            </Panel>
          ) : null}
          <FadeUp index={1}>
            {/* The tool returns a fragment, so its blocks become children of this
                View and inherit the same spacing the rest of the screen uses. */}
            <View style={{ gap: spacing.lg }}>
              <Tool key={snippetId ?? 'fresh'} initial={seed.data?.body ?? undefined} snippetId={snippetId ?? null} />
            </View>
          </FadeUp>
        </>
      )}
    </Screen>
  );
}
