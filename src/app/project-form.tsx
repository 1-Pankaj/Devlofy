/**
 * Project form — one screen for both modes. No `id` param: creates a project
 * (attached to a client or personal). With `id`: edits it.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { ErrorState } from '@/components/ui/error-state';
import { FormChip } from '@/components/ui/form-chip';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { createProject, getProject, listClients, updateProject } from '@/lib/db/repo';
import { formatDayLabel } from '@/lib/format';
import { parseRate } from '@/lib/money';
import { useAction } from '@/lib/use-action';
import { useSettings } from '@/state/settings';
import { spacing, useTheme } from '@/theme';

const DAY = 24 * 60 * 60 * 1000;

const STATUSES = [
  { id: 'planning', label: 'Planning' },
  { id: 'active', label: 'Active' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'archived', label: 'Archived' },
] as const;

type DueWindow = 'keep' | 'none' | '1w' | '2w' | '1m';

/** `stack_tags` is stored as a JSON array (see project detail + seed). */
function parseStack(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

function serializeStack(input: string): string | null {
  const list = input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return list.length > 0 ? JSON.stringify(list) : null;
}

export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0;
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const existing = useLiveQuery((d) => getProject(d, id ?? ''), {
    deps: [id],
    refreshOnFocus: false,
  });
  const clients = useLiveQuery((d) => listClients(d));
  const currency = useSettings((s) => s.currency);

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('active');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [stack, setStack] = useState('');
  const [rate, setRate] = useState('');
  const [dueWindow, setDueWindow] = useState<DueWindow>('none');
  const action = useAction();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!editing || hydratedRef.current || !existing.data) return;
    hydratedRef.current = true;
    const project = existing.data;
    setName(project.name);
    setClientId(project.client_id);
    setStatus(project.status);
    setDescription(project.description ?? '');
    setRepoUrl(project.repo_url ?? '');
    setStack(parseStack(project.stack_tags).join(', '));
    setRate(project.hourly_rate != null ? String(project.hourly_rate) : '');
    setDueWindow(project.due_date ? 'keep' : 'none');
  }, [editing, existing.data]);

  const resolveDueDate = (): string | null | undefined => {
    if (dueWindow === 'keep') return undefined;
    if (dueWindow === 'none') return null;
    const days = dueWindow === '1w' ? 7 : dueWindow === '2w' ? 14 : 30;
    return new Date(Date.now() + days * DAY).toISOString();
  };

  const handleSave = async () => {
    if (!name.trim() || action.busy) return;
    const outcome = await action.run(async () => {
      if (editing && id) {
        await updateProject(db, id, {
          name,
          client_id: clientId,
          status,
          description,
          repo_url: repoUrl,
          stack_tags: serializeStack(stack),
          due_date: resolveDueDate(),
          hourly_rate: parseRate(rate),
        });
      } else {
        await createProject(db, {
          name,
          clientId,
          status,
          description,
          repoUrl,
          stackTags: serializeStack(stack) ?? undefined,
          dueDate: resolveDueDate() ?? null,
          hourlyRate: parseRate(rate),
        });
      }
    });
    // Stay on the form when the write failed, with the reason above the button.
    if (outcome.ok) router.back();
  };

  if (editing && existing.status === 'loading' && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading label="reading the project…" />
      </View>
    );
  }

  if (editing && existing.status === 'error' && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl }}>
        <BackRow label="Projects" />
        <ErrorState what="this project" onRetry={() => existing.refresh()} />
      </View>
    );
  }

  if (editing && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl }}>
        <BackRow label="Projects" />
        <AppText variant="subheadMedium" tone="danger">
          This project no longer exists.
        </AppText>
      </View>
    );
  }

  const keepLabel =
    existing.data?.due_date != null ? `Keep (${formatDayLabel(existing.data.due_date)})` : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={{
          eyebrow: 'project',
          title: editing ? 'Edit project' : 'New project',
          subtitle: editing
            ? 'The single source of truth for this build.'
            : 'It attaches to a client — or stays personal.',
        }}>
        <View style={{ marginTop: -spacing.md }}>
          <BackRow label="Cancel" />
        </View>

        <Panel coreStyle={{ gap: spacing.xl }}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Northwind Portal"
            autoFocus={!editing}
            returnKeyType="next"
          />

          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="tertiary">
              Client
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <FormChip
                label="None"
                active={clientId === null}
                onPress={() => setClientId(null)}
              />
              {(clients.data ?? []).map((client) => (
                <FormChip
                  key={client.id}
                  label={client.name}
                  active={clientId === client.id}
                  onPress={() => setClientId(client.id)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="tertiary">
              Status
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {STATUSES.map((option) => (
                <FormChip
                  key={option.id}
                  label={option.label}
                  active={status === option.id}
                  onPress={() => setStatus(option.id)}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Scope, constraints, what done looks like…"
            multiline
          />

          <View style={{ gap: spacing.sm }}>
            <TextField
              label={`Hourly rate (${currency})`}
              value={rate}
              onChangeText={setRate}
              placeholder="e.g. 2500"
              keyboardType="numeric"
              returnKeyType="next"
            />
            <AppText variant="caption" tone="tertiary">
              Focus blocks on this project are priced at this rate as they finish. Leave it empty
              to fall back to the client&apos;s rate, or to bill nothing.
            </AppText>
          </View>

          <TextField
            label="Repository"
            value={repoUrl}
            onChangeText={setRepoUrl}
            placeholder="https://github.com/…"
            keyboardType="url"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextField
            label="Stack"
            value={stack}
            onChangeText={setStack}
            placeholder="unity, firebase, blender"
            autoCapitalize="none"
            returnKeyType="done"
          />

          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="tertiary">
              Due
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {keepLabel ? (
                <FormChip label={keepLabel} active={dueWindow === 'keep'} onPress={() => setDueWindow('keep')} />
              ) : null}
              <FormChip label="No date" active={dueWindow === 'none'} onPress={() => setDueWindow('none')} />
              <FormChip label="+1 week" active={dueWindow === '1w'} onPress={() => setDueWindow('1w')} />
              <FormChip label="+2 weeks" active={dueWindow === '2w'} onPress={() => setDueWindow('2w')} />
              <FormChip label="+1 month" active={dueWindow === '1m'} onPress={() => setDueWindow('1m')} />
            </View>
          </View>
        </Panel>

        {action.error ? (
          <AppText variant="caption" tone="danger">
            {action.error}
          </AppText>
        ) : null}

        <AppButton
          label={editing ? 'Save changes' : 'Create project'}
          size="lg"
          disabled={!name.trim() || action.busy}
          onPress={handleSave}
          style={{ alignSelf: 'stretch' }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
