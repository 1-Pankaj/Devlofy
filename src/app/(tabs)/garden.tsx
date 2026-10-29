/**
 * Focus Garden — the 3D home of focused time.
 *
 * One stage, then the record of it: the tree in a bordered frame, the controls
 * that run a block, and underneath the ledger — total grown, today, streak, the
 * twelve-week rhythm, and the sessions themselves.
 *
 * The frame is a *window*, not a card: the scene bleeds to its edges, a mono HUD
 * sits in the corners, and the controls live in a hairline-separated strip under
 * the glass. While a block runs, the strip becomes the instrument: countdown,
 * a meter, and the sentence that says what is being measured.
 */
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { Play, Plus, Stop, Timer, Trash } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { FocusHeatmap } from '@/components/focus/focus-heatmap';
import { ProjectChips } from '@/components/focus/project-chips';
import { RhythmCard } from '@/components/focus/rhythm-card';
import { GardenScene } from '@/components/garden/garden-scene';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { emptyArt } from '@/components/ui/empty-art';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Fab } from '@/components/ui/fab';
import { FormChip } from '@/components/ui/form-chip';
import { ListRow } from '@/components/ui/list-row';
import { LiveDot } from '@/components/ui/live-dot';
import { Loading } from '@/components/ui/loading';
import { Meter } from '@/components/ui/meter';
import { Panel } from '@/components/ui/panel';
import { Eyebrow, StatusPill } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section';
import { FadeUp } from '@/components/ui/stagger';
import { Stat, StatRow } from '@/components/ui/stat';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  countActiveProjects,
  createManualSession,
  deleteFocusSession,
  endFocusSession,
  focusMinutesByDay,
  getActiveSession,
  getFocusStreakDays,
  listProjects,
  listRecentSessions,
  moveFocusSession,
  startFocusSession,
  todayFocusMinutes,
  totalFocusMinutes,
  type SessionRow,
} from '@/lib/db/repo';
import { useEngine } from '@/lib/engine';
import { hashString } from '@/lib/garden/model';
import { stageFromStats } from '@/lib/garden/models';
import { formatClock, formatDayLabel, formatMinutes, formatTimer } from '@/lib/format';
import { useBreakpoint } from '@/lib/layout/breakpoints';
import { messageOf } from '@/lib/use-async-data';
import { useSettings } from '@/state/settings';
import { radius, spacing, useTheme } from '@/theme';

const BLOCKS = [25, 50, 90] as const;
/** A hand-picked block length must live between five minutes and four hours. */
const MIN_CUSTOM_BLOCK = 5;
const MAX_CUSTOM_BLOCK = 240;
/** The manual-entry form accepts one long block at most — the same ceiling the
 *  timer itself enforces when a session is closed out (see `endFocusSession`). */
const MAX_SESSION_MINUTES_LOG = 720;

/**
 * The HUD sits on the 3D stage, not on a themed surface, so it carries its own
 * glass: a token that flips with the theme would disappear into the stage in one
 * of the two modes. The stage is dark in both, so the glass is always light-on-
 * dark — the only place in the app that is true.
 */
const HUD_GLASS = 'rgba(255, 255, 255, 0.09)';
const HUD_EDGE = 'rgba(255, 255, 255, 0.14)';
const HUD_INK = '#FFFFFF';

export default function GardenScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const breakpoint = useBreakpoint();
  const expanded = breakpoint === 'expanded';

  const session = useLiveQuery(getActiveSession);
  const totals = useLiveQuery(async (d) => ({
    total: await totalFocusMinutes(d),
    today: await todayFocusMinutes(d),
    streak: await getFocusStreakDays(d),
  }));
  const history = useLiveQuery((d) => listRecentSessions(d, 6));
  const rhythm = useLiveQuery((d) => focusMinutesByDay(d, 84));
  const projects = useLiveQuery(countActiveProjects);
  const allProjects = useLiveQuery((d) => listProjects(d));
  const engine = useEngine();
  const { refresh: refreshEngine } = engine;
  const focusProjectId = useSettings((s) => s.focusProjectId);
  const block = useSettings((s) => s.focusBlockMinutes);
  const setBlock = useSettings((s) => s.setFocusBlockMinutes);

  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [sheetSession, setSheetSession] = useState<SessionRow | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualProjectId, setManualProjectId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const autoEndingRef = useRef(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const active = session.data ?? null;
  const startedAt = active?.started_at ?? null;

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsedSeconds = startedAt
    ? Math.max(0, Math.floor((nowTick - new Date(startedAt).getTime()) / 1000))
    : 0;
  const remainingSeconds = Math.max(0, block * 60 - elapsedSeconds);
  const progress = Math.min(1, elapsedSeconds / (block * 60));

  const seed = useMemo(() => hashString('devlofy-garden'), []);
  const stage = useMemo(
    () =>
      stageFromStats({
        totalMinutes: totals.data?.total ?? 0,
        streakDays: totals.data?.streak ?? 0,
        todayMinutes: totals.data?.today ?? 0,
      }),
    [totals.data],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([session.refresh(), totals.refresh(), history.refresh()]);
    refreshEngine();
  }, [history, refreshEngine, session, totals]);

  const handleStart = useCallback(async () => {
    if (starting || active) return;
    setStarting(true);
    setProblem(null);
    try {
      await startFocusSession(db, focusProjectId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await refreshAll();
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setStarting(false);
    }
  }, [active, db, focusProjectId, refreshAll, starting]);

  const handleEnd = useCallback(async () => {
    if (!active || ending) return;
    setEnding(true);
    setProblem(null);
    try {
      await endFocusSession(db, active.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await refreshAll();
    } catch (error) {
      setProblem(messageOf(error));
    } finally {
      setEnding(false);
    }
  }, [active, db, ending, refreshAll]);

  /** A hand-picked length: clamped, stored, and the next block uses it. */
  const applyCustomBlock = useCallback(() => {
    const parsed = Number.parseInt(customDraft, 10);
    if (Number.isNaN(parsed)) {
      setCustomOpen(false);
      return;
    }
    const clamped = Math.min(MAX_CUSTOM_BLOCK, Math.max(MIN_CUSTOM_BLOCK, parsed));
    setBlock(clamped);
    setCustomOpen(false);
    Haptics.selectionAsync().catch(() => {});
  }, [customDraft, setBlock]);

  const handleMove = useCallback(
    async (row: SessionRow, projectId: string | null) => {
      setProblem(null);
      try {
        await moveFocusSession(db, row.id, projectId);
        Haptics.selectionAsync().catch(() => {});
        await refreshAll();
        setSheetSession(null);
      } catch (error) {
        setProblem(messageOf(error));
      }
    },
    [db, refreshAll],
  );

  const handleDelete = useCallback(
    async (row: SessionRow) => {
      setProblem(null);
      try {
        await deleteFocusSession(db, row.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        await refreshAll();
        setSheetSession(null);
        setConfirmingDelete(false);
      } catch (error) {
        setProblem(messageOf(error));
      }
    },
    [db, refreshAll],
  );

  const handleManualSave = useCallback(async () => {
    const parsed = Number.parseInt(manualMinutes, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_SESSION_MINUTES_LOG) {
      setProblem('A hand-logged block needs a number of minutes between 1 and 720.');
      return;
    }
    setProblem(null);
    try {
      await createManualSession(db, {
        minutes: parsed,
        startedAt: new Date(),
        projectId: manualProjectId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await refreshAll();
      setManualOpen(false);
      setManualMinutes('');
    } catch (error) {
      setProblem(messageOf(error));
    }
  }, [db, manualMinutes, manualProjectId, refreshAll]);

  // The block closes itself out — end at zero, exactly once.
  useEffect(() => {
    if (!active || remainingSeconds > 0 || autoEndingRef.current) return;
    autoEndingRef.current = true;
    (async () => {
      try {
        await endFocusSession(db, active.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        await refreshAll();
      } catch (error) {
        setProblem(messageOf(error));
      } finally {
        autoEndingRef.current = false;
      }
    })();
  }, [active, db, refreshAll, remainingSeconds]);

  return (
    <Screen
      header={{
        eyebrow: 'focus',
        title: 'Garden',
        subtitle:
          totals.status === 'ready'
            ? `${stage.label} · ${formatMinutes(totals.data?.total ?? 0)} grown in total`
            : undefined,
      }}
      fab={
        <Fab
          label={active ? 'End block' : `Focus for ${block}m`}
          icon={active ? Stop : Play}
          tone={active ? 'ember' : 'brand'}
          onPress={active ? handleEnd : handleStart}
          disabled={active ? ending : starting}
        />
      }>
      {problem ? (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.danger,
            backgroundColor: colors.dangerSoft,
          }}>
          <AppText variant="caption" tone="danger">
            {problem}
          </AppText>
        </View>
      ) : null}

      {/* The window: a lit stage, and — on a wide screen — the instrument beside
          it rather than under it, so the tree keeps a landscape frame instead of
          being letterboxed by the page. */}
      <FadeUp index={0}>
        <Panel rounding="xl" coreStyle={{ padding: 0, overflow: 'hidden' }}>
          <View style={expanded ? { flexDirection: 'row' } : undefined}>
            <View
              style={{
                height: expanded ? 428 : 336,
                flex: expanded ? 1.35 : undefined,
                minWidth: 0,
              }}>
              <GardenScene
                seed={seed}
                growth={stage.growth}
                stats={{
                  totalMinutes: totals.data?.total ?? 0,
                  streakDays: totals.data?.streak ?? 0,
                  todayMinutes: totals.data?.today ?? 0,
                }}
                projects={projects.data ?? 0}
                focusing={!!active}
                animated
              />

              {/* HUD: stage on the left, live state on the right. Both read at a
                  glance without a scrim swallowing the scene. */}
              <View
                style={{
                  position: 'absolute',
                  top: spacing.md,
                  left: spacing.md,
                  right: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 5,
                    borderRadius: radius.sm,
                    backgroundColor: HUD_GLASS,
                    borderWidth: 1,
                    borderColor: HUD_EDGE,
                  }}>
                  <LiveDot color={active ? colors.ember : colors.accent} size={6} />
                  <AppText variant="monoLabel" style={{ color: HUD_INK }}>
                    {active ? 'block running' : stage.label}
                  </AppText>
                </View>
                <View
                  style={{
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 5,
                    borderRadius: radius.sm,
                    backgroundColor: HUD_GLASS,
                    borderWidth: 1,
                    borderColor: HUD_EDGE,
                  }}>
                  <AppText variant="code" style={{ color: HUD_INK, fontSize: 11 }}>
                    {active
                      ? formatTimer(elapsedSeconds)
                      : `${formatMinutes(totals.data?.today ?? 0)} today`}
                  </AppText>
                </View>
              </View>
            </View>

            <View
              style={{
                borderTopWidth: expanded ? 0 : 1,
                borderLeftWidth: expanded ? 1 : 0,
                borderColor: colors.hairline,
                flex: expanded ? 1 : undefined,
                justifyContent: 'center',
                padding: spacing.lg,
                gap: spacing.lg,
              }}>
              {active ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                    }}>
                    <View style={{ gap: spacing.xxs }}>
                      <Eyebrow tone="ember">focus block · {block}m</Eyebrow>
                      <AppText variant="timer">{formatTimer(remainingSeconds)}</AppText>
                    </View>
                    <StatusPill label="running" tone="ember" dot />
                  </View>
                  <Meter value={progress} tone="ember" height={6} />
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                    <AppText variant="code" tone="tertiary">
                      {Math.round(progress * 100)}% of {block}m
                    </AppText>
                    <AppText variant="code" tone="ember">
                      started {formatClock(active.started_at)}
                      {active.project_name ? ` · ${active.project_name}` : ''}
                    </AppText>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ gap: spacing.xxs }}>
                    <Eyebrow>next block</Eyebrow>
                    <AppText variant="timer">{formatTimer(block * 60)}</AppText>
                    <AppText variant="caption" tone="tertiary">
                      Ends itself at zero and files the block in the log.
                    </AppText>
                  </View>

                  <View style={{ height: 1, backgroundColor: colors.hairline }} />

                  <View style={{ gap: spacing.xs }}>
                    <Eyebrow>block length</Eyebrow>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {BLOCKS.map((minutes) => (
                        <FormChip
                          key={minutes}
                          label={`${minutes}m`}
                          active={minutes === block}
                          onPress={() => {
                            setCustomOpen(false);
                            setBlock(minutes);
                          }}
                        />
                      ))}
                      {!BLOCKS.includes(block as (typeof BLOCKS)[number]) ? (
                        <FormChip
                          label={`${block}m`}
                          active
                          onPress={() => setCustomOpen(false)}
                        />
                      ) : null}
                      <FormChip
                        label="custom"
                        active={customOpen}
                        onPress={() => {
                          setCustomDraft(customOpen ? '' : String(block));
                          setCustomOpen(!customOpen);
                        }}
                      />
                    </View>
                    {customOpen ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-end',
                          gap: spacing.sm,
                        }}>
                        <View style={{ width: 120 }}>
                          <TextField
                            label="minutes · 5–240"
                            value={customDraft}
                            keyboardType="number-pad"
                            placeholder="e.g. 35"
                            onChangeText={setCustomDraft}
                            onSubmitEditing={applyCustomBlock}
                            returnKeyType="done"
                          />
                        </View>
                        <AppButton
                          label="Set"
                          variant="tonal"
                          onPress={applyCustomBlock}
                        />
                      </View>
                    ) : null}
                  </View>

                  <ProjectChips wrap={expanded} />
                </>
              )}
            </View>
          </View>
        </Panel>
      </FadeUp>

      {/* The ledger. One figure leads, two support; no tinted block. */}
      <FadeUp index={1}>
        {totals.status === 'error' && !totals.data ? (
          <Panel>
            <ErrorState what="your focus totals" onRetry={() => totals.refresh()} />
          </Panel>
        ) : (
          <Panel pad="lg">
            <View style={{ gap: spacing.lg }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                }}>
                <View style={{ gap: spacing.xxs, flex: 1 }}>
                  <Eyebrow>grown here</Eyebrow>
                  <AnimatedNumber
                    value={totals.data?.total ?? 0}
                    variant="numberXl"
                    format={formatMinutes}
                  />
                  <AppText variant="caption" tone="tertiary">
                    focused minutes, counted from finished blocks
                  </AppText>
                </View>
                <StatusPill label={stage.label.toLowerCase()} tone="accent" />
              </View>

              <View
                style={{
                  paddingTop: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: colors.hairline,
                }}>
                <StatRow>
                  <Stat label="today" value={totals.data?.today ?? 0} format={formatMinutes} />
                  <Stat
                    label="day streak"
                    value={totals.data?.streak ?? 0}
                    format={(value) => `${value}d`}
                  />
                  <Stat label="sessions" value={history.data?.length ?? 0} />
                </StatRow>
              </View>
            </View>
          </Panel>
        )}
      </FadeUp>

      {/* Twelve weeks of rhythm */}
      <FadeUp index={2}>
        {rhythm.status === 'error' && !rhythm.data ? (
          <Panel>
            <ErrorState what="your rhythm" onRetry={() => rhythm.refresh()} />
          </Panel>
        ) : (
          <FocusHeatmap data={rhythm.data ?? []} />
        )}
      </FadeUp>

      {/* When the work actually happens */}
      <FadeUp index={3}>
        <RhythmCard rhythm={engine.rhythm} insights={engine.insights} />
      </FadeUp>

      {/* Session log */}
      <FadeUp index={4}>
        <View>
          <SectionHeader
            eyebrow="records"
            title="Recent sessions"
            actionLabel="Log a block"
            onAction={() => {
              setManualOpen(true);
              setConfirmingDelete(false);
            }}
          />
          <Panel coreStyle={{ padding: 0, overflow: 'hidden' }}>
            {history.status === 'loading' && !history.data ? (
              <Loading label="reading sessions…" />
            ) : history.status === 'error' && !history.data ? (
              <ErrorState what="the session log" onRetry={() => history.refresh()} />
            ) : (history.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Timer}
                image={emptyArt.focus}
                title="No sessions yet"
                message="Start a focus block above — the tree and the log grow together."
              />
            ) : (
              history.data!.map((entry, index) => (
                <ListRow
                  key={entry.id}
                  icon={<Timer size={16} color={colors.ember} weight="regular" />}
                  tone="ember"
                  title={formatDayLabel(entry.started_at)}
                  subtitle={[
                    `started ${formatClock(entry.started_at)}`,
                    entry.project_name,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => {
                    setConfirmingDelete(false);
                    setSheetSession(entry);
                  }}
                  showSeparator={index < history.data!.length - 1}
                  trailing={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <AppText variant="code" tone="secondary">
                        {entry.minutes ?? 0}
                      </AppText>
                      <AppText variant="monoLabel" tone="tertiary" style={{ fontSize: 9 }}>
                        min
                      </AppText>
                    </View>
                  }
                />
              ))
            )}
          </Panel>
        </View>
      </FadeUp>

      {/* The block ledger's edit sheet: move a block, forget it, or log one
          the timer never saw. Every action says what it does to the bill —
          billable follows the project, never the tap. */}
      <BottomSheet
        visible={sheetSession !== null}
        onClose={() => {
          setSheetSession(null);
          setConfirmingDelete(false);
        }}
        title="This block"
        note={
          sheetSession
            ? `${formatDayLabel(sheetSession.started_at)} · ${sheetSession.minutes ?? 0} min · started ${formatClock(sheetSession.started_at)}`
            : undefined
        }>
        {sheetSession ? (
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Eyebrow>move to project</Eyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <FormChip
                  label="No project"
                  active={sheetSession.project_id === null}
                  onPress={() => handleMove(sheetSession, null)}
                />
                {(allProjects.data ?? [])
                  .filter(
                    (project) => project.status === 'active' || project.status === 'maintenance',
                  )
                  .map((project) => (
                    <FormChip
                      key={project.id}
                      label={project.name}
                      active={sheetSession.project_id === project.id}
                      onPress={() => handleMove(sheetSession, project.id)}
                    />
                  ))}
              </View>
              <AppText variant="caption" tone="tertiary">
                {'Billable follows the project\u2019s rate, as if the block had started there.'}
              </AppText>
            </View>

            <View style={{ gap: spacing.sm }}>
              {confirmingDelete ? (
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="caption" tone="danger">
                    The block and its minutes leave the log, the invoice and the garden.
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <AppButton
                      label="Forget this block"
                      icon={Trash}
                      variant="outlined"
                      onPress={() => handleDelete(sheetSession)}
                    />
                    <AppButton
                      label="Keep"
                      variant="text"
                      onPress={() => setConfirmingDelete(false)}
                    />
                  </View>
                </View>
              ) : (
                <AppButton
                  label="Forget this block"
                  icon={Trash}
                  variant="text"
                  onPress={() => setConfirmingDelete(true)}
                />
              )}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      {/* Manual entry: a block the timer never saw. */}
      <BottomSheet
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Log a block by hand"
        note="For work that happened while the timer was closed. It grows the garden like any other block."
        scroll>
        <View style={{ gap: spacing.lg }}>
          <View style={{ width: 140 }}>
            <TextField
              label="minutes · 1–720"
              value={manualMinutes}
              keyboardType="number-pad"
              placeholder="e.g. 45"
              onChangeText={setManualMinutes}
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Eyebrow>attributed to</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <FormChip
                label="No project"
                active={manualProjectId === null}
                onPress={() => setManualProjectId(null)}
              />
              {(allProjects.data ?? [])
                .filter(
                  (project) => project.status === 'active' || project.status === 'maintenance',
                )
                .map((project) => (
                  <FormChip
                    key={project.id}
                    label={project.name}
                    active={manualProjectId === project.id}
                    onPress={() => setManualProjectId(project.id)}
                  />
                ))}
            </View>
          </View>
          <AppButton label="File the block" icon={Plus} onPress={handleManualSave} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
