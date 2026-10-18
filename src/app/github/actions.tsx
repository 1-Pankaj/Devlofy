/**
 * Actions — what ran, how it went, and the three verbs worth having on a tablet.
 *
 * Re-running a failure is the single most useful remote action there is: a flake
 * fixed from a sofa. Cancel is the second. Dispatch is the third, and it is the
 * one that needs honesty, because `POST …/dispatches` answers `204 Accepted`,
 * not "started": nothing comes back, and the run takes a few seconds to appear.
 * So the screen says exactly that instead of showing a spinner over an empty row.
 *
 * Workflows that do not declare `workflow_dispatch` are refused by GitHub with a
 * `422`; that sentence is surfaced verbatim, because it is the only thing that
 * tells you what to edit.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowClockwise,
  ArrowSquareOut,
  Lightning,
  Play,
  Prohibit,
  ArrowsClockwise,
  WarningCircle,
} from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { GithubGate } from '@/components/github/gate';
import { ChipPicker, RunRow, StateDot, stateLabel } from '@/components/github/rows';
import { formatAgo } from '@/lib/format';
import {
  cancelRun,
  dispatchWorkflow,
  getRun,
  listRuns,
  listWorkflows,
  rerunRun,
  type RunDetail,
  type Workflow,
  type WorkflowRun,
} from '@/lib/github/ci';
import { listBranches, type Branch } from '@/lib/github/repo';
import { useGithubToken } from '@/lib/github/use-github';
import { useAction } from '@/lib/use-action';
import { useAsyncData } from '@/lib/use-async-data';
import { radius, spacing, useTheme } from '@/theme';

type ActionsBundle = {
  workflows: Workflow[];
  runs: WorkflowRun[];
  branches: Branch[];
  detail: RunDetail | null;
  notes: string[];
};

async function loadActions(
  token: string,
  repo: string,
  runId: number | null,
): Promise<ActionsBundle> {
  const notes: string[] = [];
  const keep = async <T,>(what: string, work: () => Promise<T>, empty: T): Promise<T> => {
    try {
      return await work();
    } catch {
      notes.push(what);
      return empty;
    }
  };

  const [workflows, runs, branches, detail] = await Promise.all([
    keep('Workflows', () => listWorkflows(token, repo), [] as Workflow[]),
    keep('Runs', () => listRuns(token, repo, { limit: 15 }), [] as WorkflowRun[]),
    keep('Branches', () => listBranches(token, repo), [] as Branch[]),
    runId ? keep('Run detail', () => getRun(token, repo, runId), null) : Promise.resolve(null),
  ]);

  return { workflows, runs, branches, detail, notes };
}

export default function ActionsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string; run?: string }>();
  const repo = params.repo ?? '';
  const runId = params.run ? Number(params.run) : null;
  const { token, ready } = useGithubToken();

  const bundle = useAsyncData(
    () => loadActions(token ?? '', repo, runId),
    [token ?? '', repo, runId ?? 0],
    { enabled: ready && token !== null && repo.length > 0 },
  );

  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [refDraft, setRefDraft] = useState<string | null>(null);
  const [inputsDraft, setInputsDraft] = useState('');
  const action = useAction();

  const data = bundle.data;
  const selectedWorkflow = data?.workflows.find((workflow) => workflow.id === workflowId) ?? null;
  const ref =
    refDraft ??
    data?.runs[0]?.branch ??
    data?.branches.find((branch) => branch.name === 'main')?.name ??
    data?.branches[0]?.name ??
    'main';

  const openRun = useCallback(
    (run: number | null) =>
      router.setParams({ run: run === null ? '' : String(run) }),
    [router],
  );

  /**
   * Workflow inputs are strings on the wire. Rather than a checker that runs in
   * three places, the text is parsed once here: `ok: false` means "that is not
   * JSON", which both the button's disabled state and the sentence below read.
   */
  const inputs = useMemo<
    { ok: true; value: Record<string, string> | undefined } | { ok: false }
  >(() => {
    const text = inputsDraft.trim();
    if (!text) return { ok: true, value: undefined };
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false };
      const entries = Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]);
      return { ok: true, value: Object.fromEntries(entries) as Record<string, string> };
    } catch {
      return { ok: false };
    }
  }, [inputsDraft]);

  const dispatch = useCallback(async () => {
    if (!token || !selectedWorkflow || !inputs.ok) return;
    const outcome = await action.run(
      () =>
        dispatchWorkflow(token, {
          repo,
          workflowId: selectedWorkflow.id,
          ref,
          inputs: inputs.value,
        }),
      { success: 'Accepted by GitHub — the run appears in a few seconds.' },
    );
    if (outcome.ok) bundle.reload();
  }, [action, bundle, inputs, ref, repo, selectedWorkflow, token]);

  const rerun = useCallback(
    (run: number, failedOnly: boolean) =>
      action
        .run(() => rerunRun(token ?? '', { repo, runId: run, failedOnly }), {
          success: 'GitHub accepted the re-run.',
        })
        .then((outcome) => {
          if (outcome.ok) bundle.reload();
        }),
    [action, bundle, repo, token],
  );

  const cancel = useCallback(
    (run: number) =>
      action
        .run(() => cancelRun(token ?? '', { repo, runId: run }), {
          success: 'Cancelling.',
        })
        .then((outcome) => {
          if (outcome.ok) bundle.reload();
        }),
    [action, bundle, repo, token],
  );

  const detail = data?.detail ?? null;

  return (
    <Screen
      header={{
        eyebrow: repo,
        title: 'Actions',
        subtitle: data ? `${data.runs.length} recent runs` : 'reading GitHub…',
        trailing: (
          <PressableScale
            haptic="light"
            accessibilityLabel="Refresh"
            disabled={bundle.refreshing}
            style={{ opacity: bundle.refreshing ? 0.45 : 1 }}
            onPress={bundle.reload}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceElevated,
              }}>
              <ArrowClockwise size={15} color={colors.textSecondary} weight="regular" />
            </View>
          </PressableScale>
        ),
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Repository" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="workflow runs">
        {() =>
          bundle.loading ? (
            <Panel>
              <Loading label="reading runs…" />
            </Panel>
          ) : !data ? (
            <Panel variant="outlined" style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <WarningCircle size={15} color={colors.danger} weight="fill" />
                <Eyebrow tone="danger">Could not read Actions</Eyebrow>
              </View>
              <AppText variant="subhead" tone="secondary">
                {bundle.error ?? 'GitHub did not answer.'}
              </AppText>
              <AppButton label="Try again" variant="text" onPress={bundle.reload} />
            </Panel>
          ) : (
            <>
              {detail ? (
                <FadeUp index={1}>
                  <View style={{ gap: spacing.md }}>
                    <SectionHeader
                      eyebrow={`run #${detail.runNumber} · ${detail.event || 'manual'}`}
                      title={detail.name}
                      actionLabel="Hide"
                      onAction={() => openRun(null)}
                    />
                    <Panel style={{ gap: spacing.lg }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}>
                        <StateDot state={detail.state} />
                        <StatusPill
                          label={stateLabel(detail.state)}
                          tone={
                            detail.state === 'failing'
                              ? 'danger'
                              : detail.state === 'passing'
                                ? 'accent'
                                : 'neutral'
                          }
                        />
                        <AppText variant="caption" tone="tertiary">
                          {detail.branch ?? 'no branch'} · {detail.headSha.slice(0, 7)} · attempt{' '}
                          {detail.attempt} · {formatAgo(detail.createdAt)}
                        </AppText>
                      </View>

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <AppButton
                          label="Re-run"
                          icon={ArrowsClockwise}
                          variant="tonal"
                          disabled={action.busy}
                          onPress={() => void rerun(detail.id, false)}
                        />
                        {detail.state === 'failing' ? (
                          <AppButton
                            label="Re-run failed only"
                            icon={Play}
                            variant="outlined"
                            disabled={action.busy}
                            onPress={() => void rerun(detail.id, true)}
                          />
                        ) : null}
                        {detail.state === 'running' || detail.state === 'queued' ? (
                          <AppButton
                            label="Cancel"
                            icon={Prohibit}
                            variant="outlined"
                            disabled={action.busy}
                            onPress={() => void cancel(detail.id)}
                          />
                        ) : null}
                        <AppButton
                          label="Logs on GitHub"
                          icon={ArrowSquareOut}
                          variant="text"
                          onPress={() => void Linking.openURL(detail.htmlUrl).catch(() => {})}
                        />
                      </View>

                      {detail.jobs.length === 0 ? (
                        <AppText variant="caption" tone="tertiary">
                          No jobs reported yet — GitHub lists them a moment after a run starts.
                        </AppText>
                      ) : (
                        detail.jobs.map((job) => (
                          <View key={job.id} style={{ gap: spacing.xs }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: spacing.md,
                              }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                <StateDot state={job.state} size={8} />
                                <AppText variant="captionMedium">{job.name}</AppText>
                              </View>
                              <AppText variant="caption" tone="tertiary">
                                {job.completedAt ? formatAgo(job.completedAt) : 'running'}
                              </AppText>
                            </View>
                            {job.steps.map((step) => (
                              <View
                                key={`${job.id}-${step.name}`}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: spacing.sm,
                                  paddingLeft: spacing.md,
                                }}>
                                <StateDot state={step.state} size={6} />
                                <AppText variant="caption" tone="secondary">
                                  {step.name}
                                </AppText>
                              </View>
                            ))}
                          </View>
                        ))
                      )}
                    </Panel>
                  </View>
                </FadeUp>
              ) : null}

              {action.error ? (
                <FadeUp index={2}>
                  <AppText variant="caption" tone="danger">
                    {action.error}
                  </AppText>
                </FadeUp>
              ) : null}
              {action.message ? (
                <FadeUp index={2}>
                  <AppText variant="caption" tone="accent">
                    {action.message}
                  </AppText>
                </FadeUp>
              ) : null}

              <FadeUp index={3}>
                <View>
                  <SectionHeader
                    eyebrow="history"
                    title="Recent runs"
                    trailing={
                      <AppText variant="caption" tone="secondary">
                        newest first
                      </AppText>
                    }
                  />
                  <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
                    {data.runs.length === 0 ? (
                      <EmptyState
                        icon={Lightning}
                        title="No runs"
                        message={
                          data.notes.includes('Runs')
                            ? 'This token cannot read Actions for this repository.'
                            : 'Nothing has run yet. Trigger one below, or push a commit.'
                        }
                      />
                    ) : (
                      data.runs.map((run, index) => (
                        <RunRow
                          key={run.id}
                          run={run}
                          showSeparator={index < data.runs.length - 1}
                          onPress={() => openRun(run.id)}
                        />
                      ))
                    )}
                  </Panel>
                </View>
              </FadeUp>

              <FadeUp index={4}>
                <View style={{ gap: spacing.md }}>
                  <SectionHeader eyebrow="dispatch" title="Run a workflow" />
                  <Panel style={{ gap: spacing.lg }}>
                    {data.workflows.length === 0 ? (
                      <AppText variant="caption" tone="tertiary">
                        No workflows to run — either the repository has none, or this token cannot
                        read them.
                      </AppText>
                    ) : (
                      <>
                        <ChipPicker
                          label="workflow"
                          options={data.workflows.map((workflow) => ({
                            value: String(workflow.id),
                            label: workflow.name,
                          }))}
                          value={selectedWorkflow ? String(selectedWorkflow.id) : null}
                          onChange={(value) => setWorkflowId(Number(value))}
                        />
                        {data.branches.length > 0 ? (
                          <ChipPicker
                            label="on"
                            options={data.branches
                              .slice(0, 20)
                              .map((branch) => ({ value: branch.name, label: branch.name }))}
                            value={ref}
                            onChange={setRefDraft}
                          />
                        ) : (
                          <TextField
                            label="Branch or tag"
                            value={ref}
                            onChangeText={setRefDraft}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        )}
                        <TextField
                          label="Inputs (JSON, optional)"
                          value={inputsDraft}
                          onChangeText={setInputsDraft}
                          placeholder={'{ "environment": "staging" }'}
                          multiline
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        {!inputs.ok ? (
                          <AppText variant="caption" tone="danger">
                            That is not JSON, so it cannot be sent. Clear it or fix the braces.
                          </AppText>
                        ) : null}
                        <AppButton
                          label={action.busy ? 'Sending…' : 'Run workflow'}
                          icon={Play}
                          disabled={!selectedWorkflow || action.busy || !inputs.ok}
                          onPress={() => void dispatch()}
                        />
                        <AppText variant="caption" tone="tertiary">
                          GitHub answers &ldquo;accepted&rdquo;, not &ldquo;started&rdquo; — the run
                          shows up in the list above within a few seconds. A workflow that does not
                          declare `workflow_dispatch` will be refused with its own explanation.
                        </AppText>
                      </>
                    )}
                  </Panel>
                </View>
              </FadeUp>
            </>
          )
        }
      </GithubGate>
    </Screen>
  );
}
