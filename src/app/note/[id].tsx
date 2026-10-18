/**
 * Note editor — autosaving, offline, yours.
 *
 * Draft state is nullable: `null` means "show what's in the database" and the
 * first keystroke takes local ownership. Saves are debounced and flushed on
 * unmount, so nothing typed is ever lost. Templates turn an empty note into a
 * skeleton in one tap; preview renders the markdown as a reader.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Eye,
  PencilSimple,
  PushPin,
  Trash,
  WarningCircle,
  type IconProps,
} from 'phosphor-react-native';
import type { ComponentRef, ComponentType } from 'react';
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

import { MarkdownPreview } from '@/components/notes/markdown-preview';
import { NoteMeta } from '@/components/notes/note-meta';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Eyebrow } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useLiveQuery } from '@/lib/db/hooks';
import {
  deleteNote,
  getNote,
  listClients,
  listExistingTags,
  listProjects,
  updateNote,
} from '@/lib/db/repo';
import { countWords, formatDayLabel } from '@/lib/format';
import { NOTE_TEMPLATES, type NoteTemplate } from '@/lib/note-templates';
import { normalizeTag, serializeTags, splitTags } from '@/lib/tags';
import { fonts, radius, spacing, useTheme } from '@/theme';

type Draft = { title: string; body: string };
type SaveState = 'saved' | 'saving';

const AUTOSAVE_MS = 700;

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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
      }}>
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

  const note = useLiveQuery((d) => getNote(d, id), { deps: [id] });
  const data = note.data;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pinned, setPinned] = useState<boolean | null>(null);
  const [tagOverride, setTagOverride] = useState<string[] | null>(null);
  // `undefined` = follow the database, `null` = explicitly unlinked.
  const [clientOverride, setClientOverride] = useState<string | null | undefined>(undefined);
  const [projectOverride, setProjectOverride] = useState<string | null | undefined>(undefined);

  const clientList = useLiveQuery((d) => listClients(d));
  const projectList = useLiveQuery((d) => listProjects(d));
  const tagPool = useLiveQuery((d) => listExistingTags(d));

  const bodyRef = useRef<ComponentRef<typeof TextInput>>(null);
  const savedRef = useRef<Draft>({ title: '', body: '' });
  const latestRef = useRef<Draft | null>(null);
  const dirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  const refreshRef = useRef(note.refresh);

  useEffect(() => {
    refreshRef.current = note.refresh;
  }, [note.refresh]);

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
    const dirty =
      draft.title !== savedRef.current.title || draft.body !== savedRef.current.body;
    dirtyRef.current = dirty;
    if (!dirty) {
      setSaveState('saved');
      return;
    }
    setSaveState('saving');
    const timeout = setTimeout(async () => {
      try {
        await updateNote(db, id, { title: draft.title, body: draft.body });
        savedRef.current = { title: draft.title, body: draft.body };
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

  const words = useMemo(() => countWords(draft?.body ?? ''), [draft?.body]);
  const chars = draft?.body.length ?? 0;
  const freshNote = data?.title === 'Untitled note' && data?.body === '';
  const effectivePinned = pinned ?? data?.pinned === 1;
  const effectiveTags = tagOverride ?? splitTags(data?.tags);
  const effectiveClientId = clientOverride === undefined ? data?.client_id ?? null : clientOverride;
  const effectiveProjectId = projectOverride === undefined ? data?.project_id ?? null : projectOverride;
  const clientName = (clientList.data ?? []).find((c) => c.id === effectiveClientId)?.name ?? null;
  const projectName = (projectList.data ?? []).find((p) => p.id === effectiveProjectId)?.name ?? null;

  const applyTemplate = useCallback((template: NoteTemplate) => {
    setDraft({ title: template.title, body: template.body });
    latestRef.current = { title: template.title, body: template.body };
    bodyRef.current?.focus();
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
    (tag: string) => {
      const current = tagOverride ?? splitTags(data?.tags);
      commitTags([...current, tag]);
    },
    [commitTags, data?.tags, tagOverride],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const current = tagOverride ?? splitTags(data?.tags);
      commitTags(current.filter((existing) => existing !== normalizeTag(tag)));
    },
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

  // Tap a task box in the preview to flip `- [ ]` ↔ `- [x]` in the source.
  const toggleCheck = useCallback((line: number) => {
    setDraft((prev) => {
      const base = prev ?? savedRef.current;
      const lines = base.body.replace(/\r\n/g, '\n').split('\n');
      if (line < 0 || line >= lines.length) return prev;
      const match = /^(\s*[-*]\s+\[)( |x|X)(\]\s+.*)$/.exec(lines[line]);
      if (!match) return prev;
      lines[line] = `${match[1]}${match[2].toLowerCase() === 'x' ? ' ' : 'x'}${match[3]}`;
      return { ...base, body: lines.join('\n') };
    });
  }, []);

  const handleDelete = useCallback(async () => {
    await deleteNote(db, id);
    router.back();
  }, [db, id, router]);

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 120 : 64),
          }}>
          {confirming ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.lg,
                paddingVertical: spacing.md,
              }}>
              <AppText variant="subheadMedium" tone="danger" style={{ flex: 1 }}>
                Delete this note?
              </AppText>
              <PressableScale haptic="light" onPress={() => setConfirming(false)}>
                <AppText variant="captionMedium" tone="secondary">
                  Keep
                </AppText>
              </PressableScale>
              <PressableScale haptic="medium" onPress={handleDelete}>
                <AppText variant="captionMedium" tone="danger">
                  Delete
                </AppText>
              </PressableScale>
            </View>
          ) : (
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
                  icon={previewing ? PencilSimple : Eye}
                  label={previewing ? 'Edit note' : 'Preview markdown'}
                  active={previewing}
                  onPress={() => setPreviewing((value) => !value)}
                />
                <IconButton
                  icon={PushPin}
                  label={effectivePinned ? 'Unpin note' : 'Pin note'}
                  active={effectivePinned}
                  onPress={togglePin}
                />
                <IconButton
                  icon={Trash}
                  label="Delete note"
                  danger
                  onPress={() => setConfirming(true)}
                />
              </View>
            </View>
          )}

          <TextInput
            value={draft?.title ?? ''}
            onChangeText={(value) => update({ title: value })}
            placeholder="Untitled note"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => bodyRef.current?.focus()}
            autoFocus={freshNote}
            selectTextOnFocus={freshNote}
            accessibilityLabel="Note title"
            style={{
              marginTop: spacing.xxl,
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
            projects={(projectList.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
            suggestions={tagPool.data ?? []}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onPickClient={handlePickClient}
            onPickProject={handlePickProject}
          />

          <View
            style={{
              height: 1,
              backgroundColor: colors.hairline,
              marginTop: spacing.lg,
              marginBottom: spacing.lg,
            }}
          />

          {previewing ? (
            <View style={{ minHeight: 320 }}>
              <MarkdownPreview source={draft?.body ?? ''} onToggleCheck={toggleCheck} />
            </View>
          ) : (
            <TextInput
              ref={bodyRef}
              value={draft?.body ?? ''}
              onChangeText={(value) => update({ body: value })}
              placeholder={
                'Write it down. Markdown works — # heading, - list, - [ ] task, ``` code'
              }
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              accessibilityLabel="Note body"
              style={{
                minHeight: 320,
                padding: 0,
                color: colors.text,
                fontFamily: fonts.bodyRegular,
                fontSize: 16,
                lineHeight: 26,
              }}
            />
          )}

          {!previewing && (draft?.body ?? '').trim().length === 0 ? (
            <View style={{ gap: spacing.md, marginTop: spacing.xxl }}>
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
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: spacing.xxl,
              paddingTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.hairline,
            }}>
            <AppText variant="mono" tone="tertiary">
              {words} {words === 1 ? 'word' : 'words'} · {chars} chars
            </AppText>
            <AppText variant="mono" tone="tertiary">
              edited {formatDayLabel(data.updated_at)}
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
