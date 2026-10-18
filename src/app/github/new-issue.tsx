/**
 * New issue — a title, a body, and the labels the repository already has.
 *
 * Deliberately a full screen rather than a sheet: an issue worth filing deserves
 * a sentence or two, and the app's own pattern for "create a thing" is a route
 * with a form (see `project-form.tsx`). It lands open, with the labels you chose,
 * and the screen hands you back to the issue itself.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FilePlus, WarningCircle } from 'phosphor-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { BackRow } from '@/components/ui/back-button';
import { Loading } from '@/components/ui/loading';
import { Panel } from '@/components/ui/panel';
import { Eyebrow } from '@/components/ui/pill';
import { Screen } from '@/components/ui/screen';
import { FadeUp } from '@/components/ui/stagger';
import { TextField } from '@/components/ui/text-field';
import { GithubGate } from '@/components/github/gate';
import { MultiChipPicker } from '@/components/github/rows';
import { createIssue, listLabels, type Label } from '@/lib/github/issues';
import { useGithubToken } from '@/lib/github/use-github';
import { useAction } from '@/lib/use-action';
import { useAsyncData } from '@/lib/use-async-data';
import { spacing, useTheme } from '@/theme';

export default function NewIssueScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string }>();
  const repo = params.repo ?? '';
  const { token, ready } = useGithubToken();

  const labels = useAsyncData(() => listLabels(token ?? '', repo), [token ?? '', repo], {
    enabled: ready && token !== null && repo.length > 0,
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const action = useAction();

  const create = async () => {
    const outcome = await action.run(
      () => createIssue(token ?? '', { repo, title, body, labels: chosen }),
      { success: 'Issue filed.' },
    );
    if (outcome.ok) {
      // Straight to the issue: the thing you just made is the thing to look at.
      router.replace({
        pathname: '/github/issue',
        params: { repo, number: String(outcome.value.number) },
      });
    }
  };

  const options: { value: string; label: string }[] = (labels.data ?? []).map((label: Label) => ({
    value: label.name,
    label: label.name,
  }));

  return (
    <Screen
      header={{
        eyebrow: repo,
        title: 'New issue',
        subtitle: 'It goes straight to GitHub',
      }}>
      <FadeUp index={0}>
        <View style={{ marginBottom: spacing.xs }}>
          <BackRow label="Issues" />
        </View>
      </FadeUp>

      <GithubGate ready={ready} token={token} what="filing an issue">
        {() => (
          <FadeUp index={1}>
            <Panel style={{ gap: spacing.lg }}>
              <TextField
                label="Title"
                value={title}
                onChangeText={setTitle}
                placeholder="Export writes an empty CSV when there are no sessions"
                autoCapitalize="sentences"
                editable={!action.busy}
              />
              <TextField
                label="What happened"
                value={body}
                onChangeText={setBody}
                placeholder={'What you expected, what happened instead, and how to see it.'}
                multiline
                editable={!action.busy}
              />

              {labels.loading ? (
                <Loading label="reading labels…" />
              ) : options.length > 0 ? (
                <MultiChipPicker
                  label="labels"
                  options={options.slice(0, 24)}
                  selected={chosen}
                  onToggle={(value) =>
                    setChosen(
                      chosen.includes(value)
                        ? chosen.filter((label) => label !== value)
                        : [...chosen, value],
                    )
                  }
                />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <WarningCircle size={14} color={colors.textTertiary} weight="regular" />
                  <AppText variant="caption" tone="tertiary">
                    No labels read — the repository may have none, or the token cannot list them.
                  </AppText>
                </View>
              )}

              {action.error ? (
                <AppText variant="caption" tone="danger">
                  {action.error}
                </AppText>
              ) : null}

              <AppButton
                label={action.busy ? 'Filing…' : 'File the issue'}
                icon={FilePlus}
                full
                disabled={action.busy || title.trim().length === 0}
                onPress={() => void create()}
              />
              <Eyebrow>Filed as @you, open, on {repo}</Eyebrow>
            </Panel>
          </FadeUp>
        )}
      </GithubGate>
    </Screen>
  );
}
