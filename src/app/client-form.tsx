/**
 * Client form — one screen for both modes. No `id` param: creates a client
 * (lead by default). With `id`: edits it, hydrated from the database once.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { FormChip } from '@/components/ui/form-chip';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { createClient, getClient, updateClient } from '@/lib/db/repo';
import { spacing, useTheme } from '@/theme';

const STATUSES = [
  { id: 'lead', label: 'Lead' },
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
] as const;

export default function ClientFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = typeof id === 'string' && id.length > 0;
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const existing = useLiveQuery((d) => getClient(d, id ?? ''), {
    deps: [id],
    refreshOnFocus: false,
  });

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<string>('lead');
  const [saving, setSaving] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!editing || hydratedRef.current || !existing.data) return;
    hydratedRef.current = true;
    setName(existing.data.name);
    setCompany(existing.data.company ?? '');
    setEmail(existing.data.email ?? '');
    setPhone(existing.data.phone ?? '');
    setNotes(existing.data.notes ?? '');
    setStatus(existing.data.status);
  }, [editing, existing.data]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      if (editing && id) {
        await updateClient(db, id, { name, company, email, phone, notes, status });
      } else {
        await createClient(db, { name, company, email, phone, notes, status });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (editing && existing.status === 'loading' && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading label="reading the client book…" />
      </View>
    );
  }

  if (editing && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl }}>
        <BackRow label="Clients" />
        <AppText variant="subheadMedium" tone="danger">
          This client no longer exists.
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
          eyebrow: 'client',
          title: editing ? 'Edit client' : 'New client',
          subtitle: editing
            ? 'Everything stays on this device.'
            : 'People and companies you build for.',
        }}>
        <View style={{ marginTop: -spacing.md }}>
          <BackRow label="Cancel" />
        </View>

        <Panel coreStyle={{ gap: spacing.xl }}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Contact person"
            autoFocus={!editing}
            returnKeyType="next"
          />
          <TextField
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Optional"
            returnKeyType="next"
          />

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
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@studio.com"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="Optional"
            keyboardType="phone-pad"
            returnKeyType="next"
          />
          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="How you met, how they pay, what they care about…"
            multiline
          />
        </Panel>

        <AppButton
          label={editing ? 'Save changes' : 'Create client'}
          size="lg"
          disabled={!name.trim() || saving}
          onPress={handleSave}
          style={{ alignSelf: 'stretch' }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
