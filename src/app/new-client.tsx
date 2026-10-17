/**
 * New client — the lightweight CRM entry point.
 */
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { BackRow } from '@/components/ui/back-button';
import { Panel } from '@/components/ui/panel';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { createClient } from '@/lib/db/repo';
import { spacing, useTheme } from '@/theme';

export default function NewClientScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createClient(db, { name, company });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
      <Screen
        ambient={false}
        header={{ eyebrow: 'new', title: 'New client', subtitle: 'People and companies you build for.' }}>
        <View style={{ marginTop: -spacing.md }}>
          <BackRow label="Cancel" />
        </View>

        <Panel coreStyle={{ gap: spacing.xl }}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Contact person"
            autoFocus
            returnKeyType="next"
          />
          <TextField
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Optional"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </Panel>

        <AppButton
          label="Create client"
          size="lg"
          disabled={!name.trim()}
          onPress={handleCreate}
          style={{ alignSelf: 'stretch' }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
