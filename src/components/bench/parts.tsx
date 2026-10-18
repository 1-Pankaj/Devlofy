/**
 * The pieces every Bench tool is built from.
 *
 * A tool screen is: a labelled input, a live answer, and — when the answer is
 * worth keeping — a way to save it. That is the same shape eleven times over, so
 * the shape lives here and each tool file only holds its own logic.
 *
 * Two habits from the rest of the app are enforced here rather than left to each
 * tool: the accent is used for the *brand action* only, and copy feedback tells
 * the truth about what happened (`shareText` returns "copied" on web and
 * "shared" on Android, and those are different sentences).
 */
import { Check, Copy, WarningCircle } from 'phosphor-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Eyebrow } from '@/components/ui/pill';
import { Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { TextField } from '@/components/ui/text-field';
import { fonts, spacing, useTheme } from '@/theme';
import { shareText } from '@/lib/share';

/** The monospace style the tools' own fields share (ToolInput uses it already). */
export const monoInput: TextStyle = {
  fontFamily: fonts.monoRegular,
  fontSize: 13,
  lineHeight: 19,
};

/** A labelled block: eyebrow, optional trailing control, then the content. */export function ToolSection({
  label,
  trailing,
  children,
  style,
}: {
  label: string;
  trailing?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: spacing.md }, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}>
        <Eyebrow>{label}</Eyebrow>
        {trailing}
      </View>
      {children}
    </View>
  );
}

/** A monospace text area — the input of almost every tool. */
export function ToolInput({
  label = 'Paste or type',
  value,
  onChangeText,
  placeholder,
  minHeight = 150,
  autoFocus = false,
}: {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline
      autoFocus={autoFocus}
      autoCapitalize="none"
      autoCorrect={false}
      inputStyle={
        {
          fontFamily: fonts.monoRegular,
          fontSize: 13,
          lineHeight: 19,
          minHeight,
        } as TextStyle
      }    />
  );
}

/** A read-only answer, with copy. `text` empty → nothing is drawn. */
export function ToolAnswer({
  label,
  text,
  children,
  note,
  style,
}: {
  label: string;
  text: string;
  children: ReactNode;
  note?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ToolSection
      label={label}
      trailing={text.length > 0 ? <CopyButton text={text} label="Copy" /> : undefined}
      style={style}>
      {children}
      {note ? <ToolNote>{note}</ToolNote> : null}
    </ToolSection>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const { colors } = useTheme();
  const [state, setState] = useState<'idle' | 'copied' | 'shared' | 'unavailable'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  const wording =
    state === 'copied'
      ? 'Copied'
      : state === 'shared'
        ? 'Shared'
        : state === 'unavailable'
          ? 'Unavailable'
          : label;

  return (
    <PressableScale
      haptic="selection"
      accessibilityLabel={label}
      onPress={async () => {
        const result = await shareText(text, label);
        setState(result);
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {state === 'idle' ? (
          <Copy size={13} color={colors.textSecondary} weight="regular" />
        ) : (
          <Check size={13} color={state === 'unavailable' ? colors.danger : colors.accent} weight="bold" />
        )}
        <AppText variant="caption" tone="secondary">
          {wording}
        </AppText>
      </View>
    </PressableScale>
  );
}

/** A quiet sentence under a result — the caveat, the unit, the count. */
export function ToolNote({ children }: { children: ReactNode }) {
  return (
    <AppText variant="caption" tone="tertiary">
      {children}
    </AppText>
  );
}

/** Something is wrong with the input. Not a crash: a correction. */
export function ToolFailure({ title, message }: { title: string; message: string }) {
  const { colors } = useTheme();
  return (
    <Panel variant="outlined" style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <WarningCircle size={15} color={colors.danger} weight="fill" />
        <Eyebrow tone="danger">{title}</Eyebrow>
      </View>
      <AppText variant="subhead" tone="secondary">
        {message}
      </AppText>
    </Panel>
  );
}

/** A row that wraps: option chips, action buttons, small facts. */
export function ToolRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
        style,
      ]}>
      {children}
    </View>
  );
}

/** A one-line fact pair: label on the left, value on the right. */
export function ToolFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: spacing.lg,
      }}>
      <AppText variant="caption" tone="tertiary">
        {label}
      </AppText>
      <AppText variant={mono ? 'mono' : 'subhead'} tone="secondary" style={{ flexShrink: 1 }}>
        {value}
      </AppText>
    </View>
  );
}
