/**
 * Note editor — a block editor over markdown, autosaving, offline, yours.
 *
 * The screen is *chrome*: a header that never scrolls (back, save state, reading
 * toggle, more), the title, the note's relationships, a stats line, and then the
 * BlockEditor, which owns the writing surface and the format bar. Reading view
 * draws the same blocks the editor edits.
 *
 * Everything the note can *do* is in one place — the ⋯ sheet: pin it, outline it,
 * turn its to-dos into real tasks, start a focus block from it, copy it, delete
 * it. That is the fix for "features are not discoverable": there is exactly one
 * place to look.
 *
 * Draft state is still nullable (`null` = show what the database says); saves are
 * debounced and flushed on unmount, so nothing typed is ever lost. A bounded
 * in-memory history gives undo/redo over the body without a new table.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Books,
  CheckSquare,
  Copy,
  DotsThree,
  Eye,
  PencilSimple,
  PushPin,
  Target,
  Trash,
  WarningCircle,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlockEditor, BLOCK_GUTTER } from '@/components/notes/block-editor';
import { ExtractSheet, type ExtractPreview } from '@/components/notes/extract-sheet';
import { LinkSheet, OutlineSheet } from '@/components/notes/link-sheet';
import { NoteMeta } from '@/components/notes/note-meta';
import { ReadingView } from '@/components/notes/reading-view';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { BottomSheet, SheetRow } from '@/components/ui/bottom-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Eyebrow } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { DOCUMENT_MAX_WIDTH } from '@/components/ui/screen';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  createNote,
  createTask,
  deleteNote,
  findNoteBacklinks,
  getActiveSession,
  getNote,
  listClients,
  listExistingTags,
  listNotes,
  listProjects,
  startFocusSession,
  updateNote,
} from '@/lib/db/repo';
import { countWords, formatDayLabel } from '@/lib/format';
import { useBreakpoint } from '@/lib/layout/breakpoints';
import { NOTE_TEMPLATES, type NoteTemplate } from '@/lib/note-templates';
import { openTasks, outlineOf, parseBlocks, toggleTask, visibleText } from '@/lib/notes/blocks';
import type { Focus } from '@/lib/notes/blocks';
import { parseTaskInput } from '@/lib/parse-task';
import { shareText } from '@/lib/share';
import { normalizeTag, serializeTags, splitTags } from '@/lib/tags';
import { useSettings } from '@/state/settings';
import { fonts, radius, spacing, useTheme } from '@/theme';

type Draft = { title: string; body: string };
type SaveState = 'saved' | 'saving';

const AUTOSAVE_MS = 700;
const HISTORY_LIMIT = 80;
/** A burst of typing is one undo step; this is how long a burst lasts. */
const HISTORY_BURST_MS = 900;
/**
 * How long an outline jump waits for its sheet before giving up on being told.
 * On web a sheet is a `Modal`, and react-native-web's Modal is a *focus trap*:
 * while it is up it redirects focus into itself, and the moment it unmounts it
 * hands focus back to whatever held it before the sheet opened. A caret that
 * moves before then is simply taken away again, so the hand-off rides the
 * sheet's own `onDismiss`; this timer is only the belt-and-braces fallback for a
 * dismiss report that never arrives.
 */
const JUMP_FALLBACK_MS = 700;

function IconButton({
  icon: Icon,
  label,
  active = false,
  danger = false,
  onPress,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : active ? colors.accent : colors.textSecondary;

  return (
    <PressableScale haptic="light" accessibilityLabel={label} onPress={onPress}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : colors.hairline,
        }}>
        <Icon size={17} color={tint} weight={active ? 'fill' : 'regular'} />
      </View>
    </PressableScale>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const { colors } = useTheme();
  const saving = state === 'saving';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: saving ? colors.ember : colors.accent,
        }}
      />
      <AppText variant="mono" tone={saving ? 'ember' : 'tertiary'}>
        {saving ? 'saving' : 'saved'}
      </AppText>
    </View>
  );
}

export default function NoteEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const expanded = useBreakpoint() === 'expanded';
  const focusProjectId = useSettings((state) => state.focusProjectId);
  const setFocusProjectId = useSettings((state) => state.setFocusProjectId);

  const note = useLiveQuery((d) => getNote(d, id), { deps: [id] });
  const data = note.data;

  const library = useLiveQuery((d) => listNotes(d));
  const clientList = useLiveQuery((d) => listClients(d));
  const projectList = useLiveQuery((d) => listProjects(d));
  const tagPool = useLiveQuery((d) => listExistingTags(d));
  const activeSession = useLiveQuery((d) => getActiveSession(d));
  const backlinks = useLiveQuery((d) => findNoteBacklinks(d, data?.title ?? '', id), {
    deps: [data?.title, id],
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [reading, setReading] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [tagOverride, setTagOverride] = useState<string[] | null>(null);
  const [clientOverride, setClientOverride] = useState<string | null | undefined>(undefined);
  const [projectOverride, setProjectOverride] = useState<string | null | undefined>(undefined);
  const [link, setLink] = useState<{ apply: (value: string) => void; tab: 'note' | 'web' } | null>(null);
  const [outline, setOutline] = useState(false);
  const [extract, setExtract] = useState<{ previews: ExtractPreview[]; lines: string[] } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ index: number; nonce: number } | null>(null);
  const [historyDepth, setHistoryDepth] = useState({ past: 0, future: 0 });

  const savedRef = useRef<Draft>({ title: '', body: '' });
  const latestRef = useRef<Draft | null>(null);
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const refreshRef = useRef(note.refresh);
  const pastRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const lastPushRef = useRef(0);
  const suppressRef = useRef(false);
  const nonceRef = useRef(0);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingJumpRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    refreshRef.current = note.refresh;
  }, [note.refresh]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  // Hydrate the saved baseline once; adopt database truth only while no local
  // edits are pending (e.g. after a save round-trip).
  useEffect(() => {
    if (!data) return;
    const next = { title: data.title, body: data.body };
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      savedRef.current = next;
      latestRef.current = next;
      setDraft(next);
      return;
    }
    if (!dirtyRef.current) {
      savedRef.current = next;
      setDraft(next);
    }
  }, [data]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...(prev ?? savedRef.current), ...patch }));
  }, []);

  // Debounced autosave.
  useEffect(() => {
    if (!draft) return;
    latestRef.current = draft;
    const dirty = draft.title !== savedRef.current.title || draft.body !== savedRef.current.body;
    dirtyRef.current = dirty;
    if (!dirty) {
      setSaveState('saved');
      return;
    }
    setSaveState('saving');
    const timeout = setTimeout(async () => {
      // Save whatever is newest *now*: the draft can move on between the
      // keystroke that scheduled this and the moment it fires.
      const payload = latestRef.current ?? draft;
      try {
        await updateNote(db, id, payload);
        // A newer edit can land while the write is in flight (the debounce is
        // 700 ms, a slow write is slower). Only the write that still matches the
        // screen may clear the dirty flag — clearing it for a superseded one
        // would let the refresh below adopt a row that is *behind* the screen,
        // and the last line typed would disappear.
        if (latestRef.current !== payload) return;
        savedRef.current = payload;
        dirtyRef.current = false;
        setSaveState('saved');
        refreshRef.current();
      } catch {
        // A failed save leaves the draft on screen; the next keystroke retries.
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timeout);
  }, [draft, db, id]);

  // Flush any pending edit on unmount — nothing typed is ever lost.
  useEffect(
    () => () => {
      const latest = latestRef.current;
      if (!latest || !dirtyRef.current) return;
      updateNote(db, id, { title: latest.title, body: latest.body }).catch(() => {});
    },
    [db, id],
  );

  const body = draft?.body ?? '';
  const blocks = useMemo(() => parseBlocks(body), [body]);
  const words = useMemo(() => countWords(visibleText(body)), [body]);
  const headings = useMemo(() => outlineOf(body), [body]);
  const freshNote = data?.title === '' && data?.body === '';
  const effectivePinned = pinned ?? data?.pinned === 1;
  const effectiveTags = tagOverride ?? splitTags(data?.tags);
  const effectiveClientId = clientOverride === undefined ? data?.client_id ?? null : clientOverride;
  const effectiveProjectId = projectOverride === undefined ? data?.project_id ?? null : projectOverride;
  const clientName = (clientList.data ?? []).find((c) => c.id === effectiveClientId)?.name ?? null;
  const projectName = (projectList.data ?? []).find((p) => p.id === effectiveProjectId)?.name ?? null;
  const projectOptions = (projectList.data ?? []).map((p) => ({ id: p.id, name: p.name }));

  /** `[[Title]]` → the note with that title, so links resolve or say they cannot. */
  const notes = (library.data ?? []).map((row) => ({ id: row.id, title: row.title }));
  const byTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of notes) map.set(entry.title.trim().toLowerCase(), entry.id);
    return map;
  }, [notes]);
  const resolveRef = useCallback(
    (target: string) => byTitle.get(target.trim().toLowerCase()) ?? null,
    [byTitle],
  );

  const handleOpenRef = useCallback(
    (target: string) => {
      const targetId = resolveRef(target);
      if (targetId) router.push(`/note/${targetId}`);
    },
    [resolveRef, router],
  );

  const handleStartRef = useCallback(
    async (target: string) => {
      const title = target.trim();
      if (!title) return;
      const newId = await createNote(db);
      await updateNote(db, newId, { title });
      router.push(`/note/${newId}`);
    },
    [db, router],
  );

  const recordHistory = useCallback((previous: string) => {
    if (suppressRef.current) {
      suppressRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastPushRef.current > HISTORY_BURST_MS) {
      pastRef.current.push(previous);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      futureRef.current = [];
      setHistoryDepth({ past: pastRef.current.length, future: 0 });
    }
    lastPushRef.current = now;
  }, []);

  const handleEditorChange = useCallback(
    (next: Focus) => {
      const previous = latestRef.current?.body ?? savedRef.current.body;
      if (next.body !== previous) recordHistory(previous);
      update({ body: next.body });
    },
    [recordHistory, update],
  );

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (previous === undefined) return;
    futureRef.current.push(latestRef.current?.body ?? savedRef.current.body);
    suppressRef.current = true;
    lastPushRef.current = 0;
    update({ body: previous });
    setHistoryDepth({ past: pastRef.current.length, future: futureRef.current.length });
  }, [update]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (next === undefined) return;
    pastRef.current.push(latestRef.current?.body ?? savedRef.current.body);
    suppressRef.current = true;
    lastPushRef.current = 0;
    update({ body: next });
    setHistoryDepth({ past: pastRef.current.length, future: futureRef.current.length });
  }, [update]);

  const applyTemplate = useCallback((template: NoteTemplate) => {
    setDraft({ title: template.title, body: template.body });
    latestRef.current = { title: template.title, body: template.body };
    nonceRef.current += 1;
    setFocusRequest({ index: 0, nonce: nonceRef.current });
  }, []);

  const togglePin = useCallback(async () => {
    const next = !effectivePinned;
    setPinned(next);
    await updateNote(db, id, { pinned: next });
  }, [db, effectivePinned, id]);

  const commitTags = useCallback(
    (next: string[]) => {
      const clean = [...new Set(next.map(normalizeTag).filter(Boolean))];
      setTagOverride(clean);
      updateNote(db, id, { tags: serializeTags(clean) })
        .then(() => refreshRef.current())
        .catch(() => {});
    },
    [db, id],
  );

  const handleAddTag = useCallback(
    (tag: string) => commitTags([...(tagOverride ?? splitTags(data?.tags)), tag]),
    [commitTags, data?.tags, tagOverride],
  );

  const handleRemoveTag = useCallback(
    (tag: string) =>
      commitTags((tagOverride ?? splitTags(data?.tags)).filter((existing) => existing !== normalizeTag(tag))),
    [commitTags, data?.tags, tagOverride],
  );

  const handlePickClient = useCallback(
    (nextId: string | null) => {
      setClientOverride(nextId);
      updateNote(db, id, { client_id: nextId })
        .then(() => refreshRef.current())
        .catch(() => {});
    },
    [db, id],
  );

  const handlePickProject = useCallback(
    (nextId: string | null) => {
      setProjectOverride(nextId);
      updateNote(db, id, { project_id: nextId })
        .then(() => refreshRef.current())
        .catch(() => {});
    },
    [db, id],
  );

  // Tap a task in the reading view to flip it in the source.
  const toggleCheck = useCallback(
    (index: number) => {
      const previous = latestRef.current?.body ?? savedRef.current.body;
      const next = toggleTask(previous, index).body;
      if (next === previous) return;
      recordHistory(previous);
      update({ body: next });
    },
    [recordHistory, update],
  );

  const openOutline = useCallback(() => {
    setMenu(false);
    setOutline(true);
  }, []);

  const openExtract = useCallback(() => {
    setMenu(false);
    const now = new Date();
    const lines = openTasks(body);
    setExtract({
      previews: lines.map((line) => {
        const parsed = parseTaskInput(line.text, projectOptions, now);
        return { title: parsed.title, tokens: parsed.tokens.map((token) => token.label) };
      }),
      lines: lines.map((line) => line.text),
    });
  }, [body, projectOptions]);

  const runExtract = useCallback(async () => {
    if (!extract || extracting) return;
    setExtracting(true);
    const now = new Date();
    try {
      for (const line of extract.lines) {
        const parsed = parseTaskInput(line, projectOptions, now);
        await createTask(db, {
          title: parsed.title,
          projectId: parsed.projectId ?? effectiveProjectId,
          priority: parsed.priority,
          estMinutes: parsed.estMinutes,
          dueAt: parsed.dueAt,
        });
      }
      setExtract(null);
      setFlash(
        `${extract.lines.length} ${extract.lines.length === 1 ? 'to-do' : 'to-dos'} added to Today`,
      );
    } catch {
      setFlash('Could not add those to-dos.');
    } finally {
      setExtracting(false);
    }
  }, [db, effectiveProjectId, extract, extracting, projectOptions]);

  const startFocus = useCallback(async () => {
    if (activeSession.data) return;
    const projectId = effectiveProjectId ?? focusProjectId;
    try {
      await startFocusSession(db, projectId);
      if (projectId && projectId !== focusProjectId) setFocusProjectId(projectId);
      if (process.env.EXPO_OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      setMenu(false);
      setFlash(projectName ? `Focus block started on ${projectName}.` : 'Focus block started.');
    } catch {
      setFlash('Could not start a focus block.');
    }
  }, [activeSession.data, db, effectiveProjectId, focusProjectId, projectName, setFocusProjectId]);

  const copyNote = useCallback(async () => {
    const text = `# ${draft?.title ?? ''}\n\n${body}`.trim();
    const result = await shareText(text, draft?.title ?? 'Note');
    setMenu(false);
    setFlash(
      result === 'copied'
        ? 'Copied to the clipboard.'
        : result === 'shared'
          ? 'Handed to the share sheet.'
          : 'Could not share this note.',
    );
  }, [body, draft?.title]);

  const handleDelete = useCallback(async () => {
    await deleteNote(db, id);
    router.back();
  }, [db, id, router]);

  const landJump = useCallback((index: number) => {
    nonceRef.current += 1;
    setFocusRequest({ index, nonce: nonceRef.current });
  }, []);

  /** The sheet said it is gone, or the fallback timer ran out. */
  const landPendingJump = useCallback(() => {
    const index = pendingJumpRef.current;
    pendingJumpRef.current = null;
    if (index !== null) landJump(index);
  }, [landJump]);

  /**
   * Jumping to a heading from the outline. The reading view is left first (a
   * jump is an invitation to edit), and the caret follows the sheet's close —
   * see `JUMP_FALLBACK_MS` for why it cannot go earlier on web.
   */
  const jumpTo = useCallback(
    (index: number) => {
      setReading(false);
      if (Platform.OS !== 'web') {
        landJump(index);
        return;
      }
      pendingJumpRef.current = index;
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(landPendingJump, JUMP_FALLBACK_MS);
    },
    [landJump, landPendingJump],
  );

  const openExtractCount = useMemo(() => openTasks(body).length, [body]);
  const backlinkRows = backlinks.data ?? [];

  /**
   * A note is a document, not a canvas: on a wide screen it takes the document
   * measure — narrower than a page of lists — so the text keeps a reading width
   * and the format bar rides with the writing instead of stretching to the
   * window.
   */
  const column = expanded
    ? ({ width: '100%', maxWidth: DOCUMENT_MAX_WIDTH, alignSelf: 'center' } as const)
    : null;

  if (note.status === 'loading' && !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (note.status === 'error' && !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          gap: spacing.xl,
        }}>
        <BackRow label="Notes" />
        <ErrorState what="this note" onRetry={() => note.refresh()} />
      </View>
    );
  }

  if (!data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          gap: spacing.xl,
        }}>
        <BackRow label="Notes" />
        <EmptyState
          icon={WarningCircle}
          title="Note not found"
          message="It may have been deleted on this device."
        />
      </View>
    );
  }

  const templateFooter: ReactNode =
    !reading && body.trim().length === 0 ? (
      <View style={{ gap: spacing.md, marginTop: spacing.xxl, paddingHorizontal: spacing.xs }}>
        <Eyebrow>start from a template</Eyebrow>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {NOTE_TEMPLATES.map((template) => {
            const TemplateIcon = template.icon;
            return (
              <PressableScale
                key={template.id}
                haptic="selection"
                accessibilityLabel={`Insert ${template.label} template`}
                onPress={() => applyTemplate(template)}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    height: 40,
                    borderRadius: radius.full,
                    backgroundColor: colors.surfaceElevated,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                  }}>
                  <TemplateIcon size={15} color={colors.accent} weight="light" />
                  <AppText variant="captionMedium" tone="secondary">
                    {template.label}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
    ) : null;

  const footer: ReactNode =
    reading && backlinkRows.length > 0 ? (
      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        <Eyebrow>linked from</Eyebrow>
        {backlinkRows.map((row) => (
          <PressableScale
            key={row.id}
            haptic="selection"
            accessibilityLabel={`Open ${row.title}`}
            onPress={() => router.push(`/note/${row.id}`)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
              }}>
              <Books size={15} color={colors.accent} weight="light" />
              <AppText variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
                {row.title || 'Untitled note'}
              </AppText>
            </View>
          </PressableScale>
        ))}
      </View>
    ) : (
      templateFooter
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            {
              paddingHorizontal: spacing.xl,
              paddingTop: insets.top + spacing.sm,
            },
            column,
          ]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}>
            <BackRow label="Notes" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <SaveBadge state={saveState} />
              <IconButton
                icon={reading ? PencilSimple : Eye}
                label={reading ? 'Edit note' : 'Reading view'}
                active={reading}
                onPress={() => setReading((value) => !value)}
              />
              <IconButton icon={DotsThree} label="Note options" active={menu} onPress={() => setMenu(true)} />
            </View>
          </View>

          {/* The document's own column: title, links and stats line up with the
              first character of every block, while the marker gutter stays
              empty above them. */}
          <View style={{ paddingLeft: BLOCK_GUTTER }}>
            <TextInput
              value={draft?.title ?? ''}
              onChangeText={(value) => update({ title: value })}
              placeholder="Untitled note"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              returnKeyType="next"
              autoFocus={freshNote}
              selectTextOnFocus={freshNote}
              accessibilityLabel="Note title"
              style={{
                marginTop: spacing.lg,
                padding: 0,
                color: colors.text,
                fontFamily: fonts.displaySemibold,
                fontSize: 30,
                lineHeight: 37,
                letterSpacing: -0.6,
              }}
            />

            <NoteMeta
              tags={effectiveTags}
              clientId={effectiveClientId}
              projectId={effectiveProjectId}
              clientName={clientName}
              projectName={projectName}
              clients={(clientList.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
              projects={projectOptions.map((p) => ({ id: p.id, name: p.name }))}
              suggestions={tagPool.data ?? []}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              onPickClient={handlePickClient}
              onPickProject={handlePickProject}
            />

            <View style={{ paddingVertical: spacing.md }}>
              <AppText variant="mono" tone={flash ? 'accent' : 'tertiary'}>
                {flash ??
                  `${words} ${words === 1 ? 'word' : 'words'} · ${blocks.length} ${
                    blocks.length === 1 ? 'block' : 'blocks'
                  } · edited ${formatDayLabel(data.updated_at)}`}
              </AppText>
            </View>
          </View>
        </View>

        {reading ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              {
                paddingLeft: spacing.xl + BLOCK_GUTTER,
                paddingRight: spacing.xl,
                paddingBottom: insets.bottom + spacing.xxxl,
              },
              column,
            ]}>
            <ReadingView
              body={body}
              onToggleTask={toggleCheck}
              resolveRef={resolveRef}
              onOpenRef={handleOpenRef}
              onStartRef={handleStartRef}
            />
            {footer}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingHorizontal: spacing.xl }, column]}>
            <BlockEditor
              body={body}
              onChange={handleEditorChange}
              canUndo={historyDepth.past > 0}
              canRedo={historyDepth.future > 0}
              onUndo={undo}
              onRedo={redo}
              resolveRef={resolveRef}
              onOpenRef={handleOpenRef}
              onStartRef={handleStartRef}
              onMention={(apply) => setLink({ apply, tab: 'note' })}
              onLink={(apply) => setLink({ apply, tab: 'web' })}
              focusRequest={focusRequest}
              footer={templateFooter}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <BottomSheet
        visible={menu}
        onClose={() => {
          setMenu(false);
          setConfirmDelete(false);
        }}
        title={draft?.title?.trim() || 'Untitled note'}
        note={`${words} ${words === 1 ? 'word' : 'words'} · ${blocks.length} blocks`}>
        <SheetRow
          label={effectivePinned ? 'Unpin' : 'Pin to the top'}
          icon={PushPin}
          tone={effectivePinned ? 'accent' : 'default'}
          onPress={() => {
            togglePin();
            setMenu(false);
          }}
        />
        {headings.length > 0 ? (
          <SheetRow label="Outline" icon={Books} detail={`${headings.length} headings`} onPress={openOutline} />
        ) : null}
        {openExtractCount > 0 ? (
          <SheetRow
            label="Turn to-dos into tasks"
            icon={CheckSquare}
            detail={`${openExtractCount} unchecked ${openExtractCount === 1 ? 'box' : 'boxes'} in this note`}
            onPress={openExtract}
          />
        ) : null}
        <SheetRow
          label={activeSession.data ? 'A focus block is already running' : 'Focus on this note'}
          icon={Target}
          tone={activeSession.data ? 'default' : 'ember'}
          disabled={Boolean(activeSession.data)}
          onPress={startFocus}
        />
        <SheetRow label="Copy as markdown" icon={Copy} onPress={copyNote} />
        <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: spacing.xs }} />
        <SheetRow
          label={confirmDelete ? 'Tap again to delete' : 'Delete note'}
          icon={Trash}
          tone="danger"
          onPress={() => {
            if (confirmDelete) handleDelete();
            else setConfirmDelete(true);
          }}
        />
      </BottomSheet>

      <LinkSheet
        visible={link !== null}
        onClose={() => setLink(null)}
        tab={link?.tab ?? 'note'}
        onTabChange={(tab) => setLink((prev) => (prev ? { ...prev, tab } : prev))}
        notes={notes}
        currentId={id}
        onPickNote={(title) => link?.apply(`[[${title}]]`)}
        onPickUrl={(href) => link?.apply(href)}
      />

      <OutlineSheet
        visible={outline}
        onClose={() => setOutline(false)}
        onDismiss={landPendingJump}
        headings={headings}
        onJump={jumpTo}
      />

      <ExtractSheet
        visible={extract !== null}
        onClose={() => setExtract(null)}
        previews={extract?.previews ?? []}
        projectName={projectName}
        busy={extracting}
        onCreate={runExtract}
      />
    </View>
  );
}
