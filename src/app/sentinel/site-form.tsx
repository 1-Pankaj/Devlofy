/**
 * Target form — one screen for both modes. No `id`: registers a URL. With `id`:
 * edits it, hydrated from the database once.
 *
 * The only validation that earns its keep is the URL: `normalizeUrl` is pure and
 * checked against known answers, so the screen can say *why* a target is refused
 * ("Only http and https targets can be watched") instead of failing at fetch
 * time with a browser message. A target added without a name gets its host.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { getWatchSite, saveWatchSite } from '@/lib/db/repo';
import { labelFromUrl, normalizeUrl } from '@/lib/sentinel/status';
import { messageOf } from '@/lib/use-async-data';
import { spacing, useTheme } from '@/theme';

/** An empty field means "no expectation", never 0. */
function parseCount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function TargetFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0;
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const existing = useLiveQuery((d) => getWatchSite(d, id ?? ''), {
    deps: [id],
    refreshOnFocus: false,
  });

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [watching, setWatching] = useState<'on' | 'off'>('on');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!editing || hydratedRef.current || !existing.data) return;
    hydratedRef.current = true;
    setName(existing.data.name);
    setUrl(existing.data.url);
    setStatus(existing.data.expect_status !== null ? String(existing.data.expect_status) : '');
    setBudget(existing.data.expect_ms !== null ? String(existing.data.expect_ms) : '');
    setNote(existing.data.note ?? '');
    setWatching(existing.data.enabled === 1 ? 'on' : 'off');
  }, [editing, existing.data]);

  const handleSave = async () => {
    if (saving) return;
    const target = normalizeUrl(url);
    if (!target.ok) {
      setProblem(target.message);
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      await saveWatchSite(db, {
        id: editing ? id : undefined,
        name: name.trim() || labelFromUrl(target.url),
        url: target.url,
        expectStatus: parseCount(status),
        expectMs: parseCount(budget),
        enabled: watching === 'on',
        note: note.trim() || null,
      });
      router.back();
    } catch (error) {
      // The URL was valid, so the write itself is what refused — say why and
      // stay on the form rather than closing as if it had saved.
      setProblem(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  if (editing && existing.status === 'loading' && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading label="reading the target…" />
      </View>
    );
  }

  if (editing && existing.status === 'error' && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl }}>
        <BackRow label="Sentinel" />
        <ErrorState what="this target" onRetry={() => existing.refresh()} />
      </View>
    );
  }

  if (editing && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl }}>
        <BackRow label="Sentinel" />
        <AppText variant="subheadMedium" tone="danger">
          This target no longer exists.
        </AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={{
          eyebrow: 'sentinel',
          title: editing ? 'Edit target' : 'New target',
          subtitle: editing
            ? 'Changing what counts as up does not rewrite past checks.'
            : 'A URL you own: a site, an API, a health endpoint.',
        }}>
        <View style={{ marginTop: -spacing.md }}>
          <BackRow label="Cancel" />
        </View>

        <Panel coreStyle={{ gap: spacing.xl }}>
          <TextField
            label="URL"
            value={url}
            onChangeText={(value) => {
              setUrl(value);
              setProblem(null);
            }}
            placeholder="https://api.yoursite.com/health"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={!editing}
            returnKeyType="next"
          />

          <View style={{ gap: spacing.sm }}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder={url.trim() ? labelFromUrl(normalizeUrl(url).ok ? url : `https://${url}`) : 'Optional'}
              returnKeyType="next"
            />
            <AppText variant="caption" tone="tertiary">
              Leave it blank and the host is used.
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <TextField
              label="Expected status"
              value={status}
              onChangeText={setStatus}
              placeholder="200"
              keyboardType="numeric"
              maxLength={3}
              returnKeyType="next"
            />
            <AppText variant="caption" tone="tertiary">
              The only status that counts as up. Leave it blank to accept anything below 500 — which is
              the safer choice for a page, and the only one a browser can honour.
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <TextField
              label="Slow over (ms)"
              value={budget}
              onChangeText={setBudget}
              placeholder="800"
              keyboardType="numeric"
              maxLength={6}
              returnKeyType="next"
            />
            <AppText variant="caption" tone="tertiary">
              Above this a response is marked slow — still up, but worth knowing. Blank means no budget.
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="monoLabel" tone="tertiary">
              Watching
            </AppText>
            <Segmented<'on' | 'off'>
              options={[
                { value: 'on', label: 'Checked' },
                { value: 'off', label: 'Paused' },
              ]}
              value={watching}
              onChange={setWatching}
            />
            <AppText variant="caption" tone="tertiary">
              A paused target stays on the board with its history, and is skipped by Check all.
            </AppText>
          </View>

          <TextField
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="What it is, who to tell, what “down” costs…"
            multiline
          />
        </Panel>

        {problem ? (
          <Panel pad="lg">
            <AppText variant="captionMedium" tone="danger">
              {problem}
            </AppText>
          </Panel>
        ) : null}

        <AppButton
          label={editing ? 'Save changes' : 'Start watching'}
          size="lg"
          disabled={!url.trim() || saving}
          onPress={() => void handleSave()}
          style={{ alignSelf: 'stretch' }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
