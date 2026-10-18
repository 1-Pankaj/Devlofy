/**
 * The GitHub screens' shared furniture: a state dot, rows for the five things a
 * developer scans (a check, a run, a commit, a file, a pull request), an inline
 * notice, and a chip picker for choosing a branch.
 *
 * These all sit on the app's existing `ListRow` — hairlines, not cards — so a
 * commit in a repository reads the same way a task in Today does. The only new
 * idea is `StatusPill`-compatible state: pass → accent, fail → danger, in flight
 * → neutral. No new colours, no green.
 */
import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  CaretRight,
  CheckCircle,
  Clock,
  FileCode,
  FileText,
  FolderSimple,
  GitCommit,
  GitPullRequest,
  MinusCircle,
  Prohibit,
  Warning,
  XCircle,
} from 'phosphor-react-native';

import { AppText } from '@/components/ui/app-text';
import { ListRow } from '@/components/ui/list-row';
import { Eyebrow, StatusPill, type StatusTone } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { formatAgo } from '@/lib/format';
import type { CheckItem, PullSummary } from '@/lib/github/pulls';
import type { WorkflowRun } from '@/lib/github/ci';
import { languageOf } from '@/lib/highlight';
import type { CommitSummary, TreeEntry } from '@/lib/github/repo';
import type { IssueSummary } from '@/lib/github/issues';
import { radius, spacing, useTheme } from '@/theme';

// ───────────────────────────── state ─────────────────────────────

export type LooseState =
  | 'passing'
  | 'failing'
  | 'running'
  | 'queued'
  | 'cancelled'
  | 'skipped'
  | 'neutral'
  | 'none'
  | 'unknown';

export function stateTone(state: LooseState): StatusTone {
  if (state === 'passing') return 'accent';
  if (state === 'failing') return 'danger';
  if (state === 'running' || state === 'queued') return 'info';
  return 'neutral';
}

export function stateLabel(state: LooseState): string {
  const words: Record<LooseState, string> = {
    passing: 'passing',
    failing: 'failing',
    running: 'running',
    queued: 'queued',
    cancelled: 'cancelled',
    skipped: 'skipped',
    neutral: 'no result',
    none: 'no checks',
    unknown: 'unknown',
  };
  return words[state];
}

function stateIcon(state: LooseState, color: string) {
  if (state === 'passing') return <CheckCircle size={18} color={color} weight="fill" />;
  if (state === 'failing') return <XCircle size={18} color={color} weight="fill" />;
  if (state === 'running') return <Clock size={18} color={color} weight="regular" />;
  if (state === 'queued') return <Clock size={18} color={color} weight="light" />;
  if (state === 'cancelled') return <Prohibit size={18} color={color} weight="regular" />;
  if (state === 'skipped') return <MinusCircle size={18} color={color} weight="light" />;
  return <Warning size={18} color={color} weight="light" />;
}

export function StateDot({
  state,
  size = 10,
  style,
}: {
  state: LooseState;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const colour =
    state === 'passing'
      ? colors.accent
      : state === 'failing'
        ? colors.danger
        : state === 'running' || state === 'queued'
          ? colors.info
          : colors.textTertiary;

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius.full, backgroundColor: colour },
        style,
      ]}
    />
  );
}

// ───────────────────────────── rows ─────────────────────────────

export function CheckRow({ item, showSeparator }: { item: CheckItem; showSeparator?: boolean }) {
  const { colors } = useTheme();
  const color = stateTone(item.state) === 'accent'
    ? colors.accent
    : stateTone(item.state) === 'danger'
      ? colors.danger
      : colors.textSecondary;

  return (
    <ListRow
      title={item.name}
      subtitle={item.detail ?? (item.source === 'status' ? 'commit status' : 'check run')}
      icon={stateIcon(item.state, color)}
      tone={stateTone(item.state) === 'danger' ? 'ember' : 'accent'}
      trailing={<StatusPill label={stateLabel(item.state)} tone={stateTone(item.state)} />}
      showSeparator={showSeparator}
    />
  );
}

export function RunRow({
  run,
  onPress,
  showSeparator,
  subtitle,
}: {
  run: WorkflowRun;
  onPress?: () => void;
  showSeparator?: boolean;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  const state = run.state;
  const color = state === 'passing' ? colors.accent : state === 'failing' ? colors.danger : colors.textSecondary;

  return (
    <ListRow
      title={`${run.name} #${run.runNumber}`}
      subtitle={subtitle ?? `${run.event || 'run'} · ${run.branch ?? 'no branch'} · ${formatAgo(run.createdAt)}`}
      icon={stateIcon(state, color)}
      tone={state === 'failing' ? 'ember' : 'accent'}
      trailing={<StatusPill label={stateLabel(state)} tone={stateTone(state)} />}
      onPress={onPress}
      showSeparator={showSeparator}
    />
  );
}

export function CommitRow({
  commit,
  onPress,
  showSeparator,
  trailing,
}: {
  commit: CommitSummary;
  onPress?: () => void;
  showSeparator?: boolean;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <ListRow
      title={commit.firstLine || '(no message)'}
      subtitle={`${commit.shortSha} · ${commit.author} · ${formatAgo(commit.date)}`}
      icon={<GitCommit size={18} color={colors.textSecondary} weight="regular" />}
      tone="neutral"
      trailing={trailing}
      onPress={onPress}
      showSeparator={showSeparator}
    />
  );
}

export function FileRow({
  entry,
  onPress,
  showSeparator,
}: {
  entry: TreeEntry;
  onPress?: () => void;
  showSeparator?: boolean;
}) {
  const { colors } = useTheme();
  const isDir = entry.type === 'dir';
  const language = languageOf(entry.name);
  const codeLike =
    !isDir &&
    language !== 'plain' &&
    ['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'css', 'html', 'sql', 'sh'].some((ext) =>
      entry.name.toLowerCase().endsWith(`.${ext}`),
    );

  return (
    <ListRow
      title={entry.name}
      subtitle={isDir ? 'folder' : entry.size !== null ? formatBytes(entry.size) : 'file'}
      icon={
        isDir ? (
          <FolderSimple size={18} color={colors.accent} weight="fill" />
        ) : codeLike ? (
          <FileCode size={18} color={colors.textSecondary} weight="regular" />
        ) : (
          <FileText size={18} color={colors.textSecondary} weight="regular" />
        )
      }
      tone={isDir ? 'accent' : 'neutral'}
      trailing={<CaretRight size={16} color={colors.textTertiary} weight="regular" />}
      onPress={onPress}
      showSeparator={showSeparator}
    />
  );
}

export function PullRow({
  pull,
  onPress,
  showSeparator,
  subtitle,
}: {
  pull: PullSummary;
  onPress?: () => void;
  showSeparator?: boolean;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  const tone: StatusTone =
    pull.state === 'merged' ? 'accent' : pull.state === 'closed' ? 'neutral' : 'info';

  return (
    <ListRow
      title={pull.title}
      subtitle={
        subtitle ??
        `#${pull.number} · ${pull.author} · ${pull.headRef} → ${pull.baseRef} · ${formatAgo(pull.updatedAt)}`
      }
      icon={<GitPullRequest size={18} color={colors.textSecondary} weight="regular" />}
      tone="neutral"
      trailing={
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          {pull.draft ? <StatusPill label="draft" tone="neutral" /> : null}
          <StatusPill label={pull.state} tone={tone} />
        </View>
      }
      onPress={onPress}
      showSeparator={showSeparator}
    />
  );
}

export function IssueRow({
  issue,
  onPress,
  showSeparator,
}: {
  issue: IssueSummary;
  onPress?: () => void;
  showSeparator?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ListRow
      title={issue.title}
      subtitle={`#${issue.number} · ${issue.author} · ${issue.comments} comment${issue.comments === 1 ? '' : 's'} · ${formatAgo(issue.updatedAt)}`}
      icon={
        issue.isPullRequest ? (
          <GitPullRequest size={18} color={colors.textSecondary} weight="regular" />
        ) : (
          <FileText size={18} color={colors.textSecondary} weight="regular" />
        )
      }
      tone="neutral"
      footer={
        issue.labels.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {issue.labels.slice(0, 4).map((label) => (
              <StatusPill key={label} label={label} tone="neutral" />
            ))}
          </View>
        ) : undefined
      }
      trailing={<StatusPill label={issue.state} tone={issue.state === 'open' ? 'info' : 'neutral'} />}
      onPress={onPress}
      showSeparator={showSeparator}
    />
  );
}

// ───────────────────────────── notice ─────────────────────────────

export function Notice({
  tone = 'neutral',
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  tone?: 'neutral' | 'accent' | 'danger' | 'ember';
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const tint =
    tone === 'danger'
      ? colors.danger
      : tone === 'accent'
        ? colors.accent
        : tone === 'ember'
          ? colors.ember
          : colors.textSecondary;

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.xs,
        },
        style,
      ]}>
      <Eyebrow tone={tone === 'danger' ? 'danger' : tone === 'accent' ? 'accent' : 'tertiary'}>
        {title}
      </Eyebrow>
      {body ? (
        <AppText variant="caption" tone="secondary">
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <PressableScale haptic="selection" onPress={onAction} style={{ alignSelf: 'flex-start' }}>
          <AppText variant="captionMedium" style={{ color: tint, marginTop: spacing.xs }}>
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}

// ───────────────────────────── chips ─────────────────────────────

export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  label,
  style,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg }}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <PressableScale
                key={option.value}
                haptic="selection"
                onPress={() => onChange(option.value)}>
                <View
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.full,
                    backgroundColor: selected ? colors.accentSoft : colors.surfaceElevated,
                  }}>
                  <AppText
                    variant="captionMedium"
                    style={{ color: selected ? colors.accent : colors.textSecondary }}>
                    {option.label}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** Multi-select chips — labels, assignees, anything a body takes as a list. */
export function MultiChipPicker({
  options,
  selected,
  onToggle,
  label,
  style,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {label ? <Eyebrow>{label}</Eyebrow> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <PressableScale
              key={option.value}
              haptic="selection"
              onPress={() => onToggle(option.value)}>
              <View
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.full,
                  backgroundColor: on ? colors.accentSoft : colors.surfaceElevated,
                }}>
                <AppText
                  variant="captionMedium"
                  style={{ color: on ? colors.accent : colors.textSecondary }}>
                  {option.label}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** `1.4 KB`, `310 B`, `2.1 MB` — file sizes, mono, tabular. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
