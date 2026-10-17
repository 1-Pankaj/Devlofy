/**
 * New project — name, client, due window. Two taps and it exists.
 */
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useLiveQuery } from '@/lib/db/hooks';
import { createProject, listClients } from '@/lib/db/repo';
import { radius, spacing, useTheme } from '@/theme';

const DAY = 24 * 60 * 60 * 1000;

type DueWindow = 'none' | '1w' | '2w' | '1m';

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale haptic="selection" onPress={onPress}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
          borderWidth: 1,
          borderColor: active ? colors.accentBorder : colors.hairline,
        }}>
        <AppText variant="captionMedium" style={{ color: active ? colors.accent : colors.textSecondary }}>
          {label}
        </AppText>
      </View>
    </PressableScale>
  );
}

export default function NewProjectScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const clients = useLiveQuery((d) => listClients(d));

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [dueWindow, setDueWindow] = useState<DueWindow>('none');

  const handleCreate = async () => {
    if (!name.trim()) return;
    const dueDate =
      dueWindow === 'none'
        ? null
        : new Date(
            Date.now() + (dueWindow === '1w' ? 7 : dueWindow === '2w' ? 14 : 30) * DAY,
          ).toISOString();
    await createProject(db, { name, clientId, dueDate });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Screen
        ambient={false}
        header={{ eyebrow: 'new', title: 'New project', subtitle: 'It attaches to a client — or stays personal.' }}>
        <View style={{ marginTop: -spacing.md }}>
          <BackRow label="Cancel" />
        </View>

        <Panel coreStyle={{ gap: spacing.xl }}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Northwind Portal"
            autoFocus
            returnKeyType="done"
          />

          <View style={{ gap: spacing.sm }}>
            <AppText variant="eyebrow" tone="tertiary">
              Client
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label="Personal" active={clientId === null} onPress={() => setClientId(null)} />
              {(clients.data ?? []).map((client) => (
                <Chip
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
              Due
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label="No date" active={dueWindow === 'none'} onPress={() => setDueWindow('none')} />
              <Chip label="+1 week" active={dueWindow === '1w'} onPress={() => setDueWindow('1w')} />
              <Chip label="+2 weeks" active={dueWindow === '2w'} onPress={() => setDueWindow('2w')} />
              <Chip label="+1 month" active={dueWindow === '1m'} onPress={() => setDueWindow('1m')} />
            </View>
          </View>
        </Panel>

        <AppButton
          label="Create project"
          size="lg"
          disabled={!name.trim()}
          onPress={handleCreate}
          style={{ alignSelf: 'stretch' }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
