/**
 * Keeping a result. Every tool ends with the same offer, so it is written once.
 *
 * The title is *suggested* from what you pasted and follows it until you type
 * your own — which means the common case (save it, rename it later) needs no
 * interaction at all, and the uncommon case is one field away. Saving is an
 * upsert: re-saving an opened snippet updates the row you opened rather than
 * quietly creating a second one, which is the bug this panel exists to avoid.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { BookmarkSimple } from 'phosphor-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TextField } from '@/components/ui/text-field';
import { deleteSnippet, saveSnippet } from '@/lib/db/repo';
import type { BenchTool } from '@/lib/bench/tools';
import { messageOf } from '@/lib/use-async-data';
import { spacing } from '@/theme';
import { ToolNote, ToolRow } from './parts';

export function SaveSnippetPanel({
  tool,
  body,
  language,
  snippetId = null,
  suggestedTitle,
}: {
  tool: BenchTool;
  body: string;
  language?: string;
  snippetId?: string | null;
  suggestedTitle: string;
}) {
  const db = useSQLiteContext();
  const router = useRouter();
  const [typed, setTyped] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(snippetId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const title = typed ?? suggestedTitle;
  const updating = savedId !== null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const id = await saveSnippet(db, {
        id: savedId ?? undefined,
        tool: tool.id,
        title: title.trim() || suggestedTitle,
        body,
        language: language ?? null,
      });
      setSavedId(id);
      setDeleted(false);
    } catch (problem) {
      setError(messageOf(problem));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!savedId) return;
    setError(null);
    try {
      await deleteSnippet(db, savedId);
      setSavedId(null);
      setConfirming(false);
      setDeleted(true);
    } catch (problem) {
      setError(messageOf(problem));
    }
  };

  return (
    <Panel variant="outlined" style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Eyebrow tone={savedId ? 'accent' : 'tertiary'}>
          {savedId ? 'Kept on this device' : deleted ? 'Deleted' : 'Keep this'}
        </Eyebrow>
        <AppText variant="caption" tone="tertiary">
          {savedId
            ? 'Saving again updates the snippet you opened.'
            : deleted
              ? 'That snippet is gone. Saving now would keep a new one.'
              : 'Snippets live in the app’s own database — nothing is uploaded.'}
        </AppText>
      </View>

      <TextField
        label="Title"
        value={title}
        onChangeText={setTyped}
        placeholder="Name it"
        maxLength={80}
        autoCapitalize="sentences"
      />

      {error ? <ToolNote>{error}</ToolNote> : null}

      <ToolRow>
        <AppButton
          label={updating ? 'Update snippet' : 'Save snippet'}
          icon={BookmarkSimple}
          disabled={saving || body.trim().length === 0}
          onPress={() => void save()}
        />
        {savedId ? (
          <AppButton
            label="View snippets"
            variant="text"
            onPress={() => router.push('/bench/snippets')}
          />
        ) : null}
      </ToolRow>

      {/* Deleting is two taps and lives here, with the thing being deleted. */}
      {savedId ? (
        confirming ? (
          <ToolRow>
            <PressableScale
              haptic="medium"
              accessibilityLabel="Delete snippet"
              onPress={() => void remove()}>
              <AppText variant="captionMedium" tone="danger">
                Delete for good
              </AppText>
            </PressableScale>
            <PressableScale
              haptic="selection"
              accessibilityLabel="Keep snippet"
              onPress={() => setConfirming(false)}>
              <AppText variant="captionMedium" tone="secondary">
                Keep it
              </AppText>
            </PressableScale>
          </ToolRow>
        ) : (
          <PressableScale
            haptic="light"
            accessibilityLabel="Delete this snippet"
            onPress={() => setConfirming(true)}>
            <AppText variant="captionMedium" tone="secondary">
              Delete this snippet
            </AppText>
          </PressableScale>
        )
      ) : null}
    </Panel>
  );
}
