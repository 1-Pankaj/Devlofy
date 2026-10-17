/**
 * MarkdownPreview — a compact reader for the note editor: headings, lists,
 * task boxes, quotes, code fences, and inline bold / italic / code.
 * Deliberately small: it renders what a solo dev actually writes.
 */
import { Check } from 'phosphor-react-native';
import { View } from 'react-native';

import { AppText, type TextTone } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { fonts, radius, spacing, useTheme, type ThemeColors } from '@/theme';

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'check'; checked: boolean; text: string; line: number }
  | { kind: 'numbered'; index: number; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; lines: string[] };

function parse(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    if (code !== null) {
      if (line.trim().startsWith('```')) {
        blocks.push({ kind: 'code', lines: code });
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trim().startsWith('```')) {
      flushParagraph();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      continue;
    }
    const check = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (check) {
      flushParagraph();
      blocks.push({ kind: 'check', checked: check[1].toLowerCase() === 'x', text: check[2], line: lineNumber });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: 'bullet', text: bullet[1] });
      continue;
    }
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      blocks.push({ kind: 'numbered', index: Number(numbered[1]), text: numbered[2] });
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      blocks.push({ kind: 'quote', text: quote[1] });
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: 'paragraph', text: '· · ·' });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  if (code !== null) blocks.push({ kind: 'code', lines: code });
  return blocks;
}

const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function Inline({ text, colors, tone }: { text: string; colors: ThemeColors; tone: TextTone }) {
  const parts = text.split(INLINE_PATTERN).filter((part) => part !== '');

  return (
    <>
      {parts.map((part, index) => {
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
          return (
            <AppText
              key={index}
              variant="body"
              style={{
                fontFamily: fonts.monoRegular,
                fontSize: 14.5,
                color: colors.accent,
                backgroundColor: colors.accentSoft,
              }}>
              {part.slice(1, -1)}
            </AppText>
          );
        }
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return (
            <AppText key={index} variant="body" tone={tone} style={{ fontFamily: fonts.bodySemibold }}>
              {part.slice(2, -2)}
            </AppText>
          );
        }
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
          return (
            <AppText key={index} variant="body" tone={tone} style={{ fontStyle: 'italic' }}>
              {part.slice(1, -1)}
            </AppText>
          );
        }
        return (
          <AppText key={index} variant="body" tone={tone}>
            {part}
          </AppText>
        );
      })}
    </>
  );
}

export function MarkdownPreview({
  source,
  onToggleCheck,
}: {
  source: string;
  /** Tap a task box to flip `- [ ]` ↔ `- [x]` in the note's source. */
  onToggleCheck?: (line: number) => void;
}) {
  const { colors } = useTheme();
  const blocks = parse(source);

  if (blocks.length === 0) {
    return (
      <AppText variant="subhead" tone="tertiary">
        Nothing to preview yet — switch back and write something.
      </AppText>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            if (block.level === 1) {
              return (
                <AppText key={index} variant="title">
                  <Inline text={block.text} colors={colors} tone="default" />
                </AppText>
              );
            }
            if (block.level === 2) {
              return (
                <AppText key={index} variant="headline">
                  <Inline text={block.text} colors={colors} tone="default" />
                </AppText>
              );
            }
            return (
              <AppText key={index} variant="subheadMedium" tone="secondary">
                <Inline text={block.text} colors={colors} tone="secondary" />
              </AppText>
            );
          case 'paragraph':
            return (
              <AppText key={index} variant="body">
                <Inline text={block.text} colors={colors} tone="default" />
              </AppText>
            );
          case 'bullet':
            return (
              <View key={index} style={{ flexDirection: 'row', gap: spacing.md }}>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: colors.accent,
                    marginTop: 10,
                  }}
                />
                <AppText variant="body" style={{ flex: 1 }}>
                  <Inline text={block.text} colors={colors} tone="default" />
                </AppText>
              </View>
            );
          case 'check': {
            const checkbox = (
              <View
                style={{
                  width: 19,
                  height: 19,
                  marginTop: 3,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: block.checked ? colors.accentBorder : colors.hairlineStrong,
                  backgroundColor: block.checked ? colors.accentSoft : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {block.checked ? <Check size={11} color={colors.accent} weight="bold" /> : null}
              </View>
            );
            const label = (
              <AppText
                variant="body"
                tone={block.checked ? 'tertiary' : 'default'}
                style={{
                  flex: 1,
                  textDecorationLine: block.checked ? 'line-through' : 'none',
                }}>
                <Inline
                  text={block.text}
                  colors={colors}
                  tone={block.checked ? 'tertiary' : 'default'}
                />
              </AppText>
            );
            if (onToggleCheck) {
              return (
                <PressableScale
                  key={index}
                  haptic="selection"
                  hitSlop={6}
                  accessibilityLabel={block.checked ? 'Mark task not done' : 'Mark task done'}
                  onPress={() => onToggleCheck(block.line)}>
                  <View
                    style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                    {checkbox}
                    {label}
                  </View>
                </PressableScale>
              );
            }
            return (
              <View
                key={index}
                style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                {checkbox}
                {label}
              </View>
            );
          }
          case 'numbered':
            return (
              <View key={index} style={{ flexDirection: 'row', gap: spacing.md }}>
                <AppText variant="mono" tone="tertiary" style={{ marginTop: 4 }}>
                  {block.index}.
                </AppText>
                <AppText variant="body" style={{ flex: 1 }}>
                  <Inline text={block.text} colors={colors} tone="default" />
                </AppText>
              </View>
            );
          case 'quote':
            return (
              <View
                key={index}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.accentBorder,
                  paddingLeft: spacing.lg,
                }}>
                <AppText variant="body" tone="secondary">
                  <Inline text={block.text} colors={colors} tone="secondary" />
                </AppText>
              </View>
            );
          case 'code':
            return (
              <View
                key={index}
                style={{
                  backgroundColor: colors.surfaceSunken,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  borderRadius: radius.md,
                  borderCurve: 'continuous',
                  padding: spacing.lg,
                }}>
                <AppText variant="mono" style={{ color: colors.text }}>
                  {block.lines.join('\n') || ' '}
                </AppText>
              </View>
            );
        }
      })}
    </View>
  );
}
