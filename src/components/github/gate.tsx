/**
 * GithubGate — the three states every GitHub screen starts in.
 *
 * A screen that talks to GitHub needs a token, and it needs to know whether the
 * stored one has been read yet. Those are two different nothings, and collapsing
 * them is how an app flashes "Not connected" at someone who is connected. The
 * gate draws the difference once, so twelve screens don't each get it slightly
 * wrong.
 */
import { useRouter } from 'expo-router';
import { GithubLogo, Key } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { spacing, useTheme } from '@/theme';

export function GithubGate({
  ready,
  token,
  what,
  children,
}: {
  ready: boolean;
  token: string | null;
  /** What the screen was about to do, in the reader's words. */
  what: string;
  children: (token: string) => ReactNode;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  if (!ready) {
    return (
      <Panel>
        <Loading label="reading the stored key…" />
      </Panel>
    );
  }

  if (!token) {
    return (
      <Panel style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <GithubLogo size={18} color={colors.accent} weight="regular" />
          <Eyebrow tone="accent">Not connected</Eyebrow>
        </View>
        <AppText variant="subhead" tone="secondary">
          Reading {what} needs a GitHub token. Connect once and this screen fills itself.
        </AppText>
        <AppButton
          label="Connect GitHub"
          icon={Key}
          onPress={() => router.push('/github')}
        />
      </Panel>
    );
  }

  return <>{children(token)}</>;
}
