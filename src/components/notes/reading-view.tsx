/**
 * ReadingView — the note as a reader.
 *
 * The same block model the editor edits, drawn without any of the syntax: one
 * renderer, so what you read is exactly what you wrote. Task boxes here are
 * live (tapping one flips it in the source), links are real, and `[[Notes]]`
 * are links into the library — resolved ones go there, unresolved ones offer to
 * start.
 */
import { Check } from 'phosphor-react-native';
import { useMemo } from 'react';
import { View, type TextStyle, type ViewStyle } from 'react-native';

import { RichText } from '@/components/notes/rich-text';
import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { parseBlocks, type Block } from '@/lib/notes/blocks';
import { fonts, radius, spacing, useTheme, type ThemeColors } from '@/theme';

export type ReadingViewProps = {
  body: string;
  onToggleTask: (index: number) => void;
  resolveRef?: (target: string) => string | null;
  onOpenRef?: (target: string) => void;
  onStartRef?: (target: string) => void;
};

function headingStyle(block: Block): TextStyle {
  if (block.hashes <= 1) return { fontFamily: fonts.bodyBold, fontSize: 25, lineHeight: 32, letterSpacing: -0.4 };
  if (block.hashes === 2) return { fontFamily: fonts.bodySemibold, fontSize: 21, lineHeight: 28, letterSpacing: -0.3 };
  return { fontFamily: fonts.bodySemibold, fontSize: 18, lineHeight: 26, letterSpacing: -0.2 };
}

function taskBox(checked: boolean, colors: ThemeColors): ViewStyle {
  return {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: checked ? colors.accent : colors.hairlineStrong,
    backgroundColor: checked ? colors.accent : 'transparent',
  };
}

export function ReadingView({ body, onToggleTask, resolveRef, onOpenRef, onStartRef }: ReadingViewProps) {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseBlocks(body), [body]);

  return (
    <View>
      {blocks.map((block, index) => {
        const key = `${index}-${block.type}`;
        const indent = block.indent * spacing.lg;

        if (block.type === 'divider') {
          return (
            <View key={key} style={{ paddingVertical: spacing.md }}>
              <View style={{ height: 1, backgroundColor: colors.hairlineStrong }} />
            </View>
          );
        }

        if (block.type === 'code') {
          return (
            <View
              key={key}
              style={{
                marginVertical: spacing.sm,
                marginLeft: indent,
                backgroundColor: colors.surfaceSunken,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
              }}>
              {block.lang ? (
                <AppText variant="eyebrow" tone="tertiary" style={{ marginBottom: spacing.xs }}>
                  {block.lang}
                </AppText>
              ) : null}
              <AppText
                variant="mono"
                style={{ fontFamily: fonts.monoRegular, fontSize: 14, lineHeight: 21 }}>
                {block.text}
              </AppText>
            </View>
          );
        }

        if (block.type === 'task') {
          return (
            <PressableScale
              key={key}
              haptic="selection"
              accessibilityLabel={block.checked ? 'Mark as not done' : 'Mark as done'}
              onPress={() => onToggleTask(index)}
              contentStyle={{
                flexDirection: 'row',
                gap: spacing.md,
                alignItems: 'flex-start',
                paddingVertical: spacing.xs,
                paddingLeft: indent,
              }}>
              <View style={[taskBox(block.checked, colors), { marginTop: 3 }]}>
                {block.checked ? <Check size={12} color={colors.accentContrast} weight="bold" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <RichText
                  text={block.text}
                  tone={block.checked ? 'tertiary' : 'default'}
                  style={block.checked ? { textDecorationLine: 'line-through' } : undefined}
                  resolveRef={resolveRef}
                  onOpenRef={onOpenRef}
                  onStartRef={onStartRef}
                />
              </View>
            </PressableScale>
          );
        }

        if (block.type === 'bullet' || block.type === 'numbered') {
          return (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                paddingVertical: spacing.xs,
                paddingLeft: indent,
              }}>
              {block.type === 'bullet' ? (
                <AppText variant="body" tone="tertiary" style={{ lineHeight: 26 }}>
                  •
                </AppText>
              ) : (
                <AppText variant="mono" tone="tertiary" style={{ lineHeight: 28 }}>
                  {block.number ?? 1}.
                </AppText>
              )}
              <View style={{ flex: 1 }}>
                <RichText
                  text={block.text}
                  resolveRef={resolveRef}
                  onOpenRef={onOpenRef}
                  onStartRef={onStartRef}
                />
              </View>
            </View>
          );
        }

        if (block.type === 'quote') {
          return (
            <View
              key={key}
              style={{
                marginVertical: spacing.xs,
                marginLeft: indent,
                borderLeftWidth: 3,
                borderLeftColor: colors.accentBorder,
                paddingLeft: spacing.md,
              }}>
              <RichText
                text={block.text}
                tone="secondary"
                resolveRef={resolveRef}
                onOpenRef={onOpenRef}
                onStartRef={onStartRef}
              />
            </View>
          );
        }

        if (block.type === 'heading') {
          return (
            <View key={key} style={{ paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
              <RichText
                text={block.text}
                style={headingStyle(block)}
                resolveRef={resolveRef}
                onOpenRef={onOpenRef}
                onStartRef={onStartRef}
              />
            </View>
          );
        }

        if (block.text.length === 0) return <View key={key} style={{ height: spacing.md }} />;

        return (
          <View key={key} style={{ paddingVertical: spacing.xs }}>
            <RichText
              text={block.text}
              resolveRef={resolveRef}
              onOpenRef={onOpenRef}
              onStartRef={onStartRef}
            />
          </View>
        );
      })}
    </View>
  );
}
