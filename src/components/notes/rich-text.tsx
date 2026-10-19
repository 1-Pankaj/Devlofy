/**
 * RichText — a block's words, drawn the way a reader expects.
 *
 * Pure presentation over `parseInline()`: bold is bold, `[a](b)` is tappable,
 * `[[Note]]` is a link into the library. The block editor draws *unfocused*
 * blocks with this and the reading view draws *every* block with it, so a note
 * looks the same whether you are skimming it or reading it. The one thing it
 * cannot do is render inside a `TextInput` — which is why the block you are
 * editing shows its inline markdown, and every other block does not.
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Linking, Text, type StyleProp, type TextStyle } from 'react-native';

import { AppText, type TextTone } from '@/components/ui/app-text';
import { parseInline, type InlineSpan } from '@/lib/notes/inline';
import { fonts, useTheme, type ThemeColors } from '@/theme';

export type RichTextProps = {
  text: string;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  /** `[[Target]]` → the id of the note with that title, or null. */
  resolveRef?: (target: string) => string | null;
  /** Tapping a link that resolves. */
  onOpenRef?: (target: string) => void;
  /** Tapping one that does not — the caller may offer to start it. */
  onStartRef?: (target: string) => void;
};

type Context = {
  colors: ThemeColors;
  resolveRef?: RichTextProps['resolveRef'];
  onOpenRef?: RichTextProps['onOpenRef'];
  onStartRef?: RichTextProps['onStartRef'];
};

function renderSpans(spans: InlineSpan[], context: Context): ReactNode[] {
  return spans.map((span, index) => {
    const key = `${index}-${span.kind}`;

    switch (span.kind) {
      case 'bold':
        return (
          <Text key={key} style={{ fontFamily: fonts.bodyBold }}>
            {renderSpans(parseInline(span.text), context)}
          </Text>
        );
      case 'italic':
        return (
          <Text key={key} style={{ fontStyle: 'italic' }}>
            {renderSpans(parseInline(span.text), context)}
          </Text>
        );
      case 'strike':
        return (
          <Text key={key} style={{ textDecorationLine: 'line-through' }}>
            {renderSpans(parseInline(span.text), context)}
          </Text>
        );
      case 'highlight':
        return (
          <Text key={key} style={{ backgroundColor: context.colors.emberSoft }}>
            {renderSpans(parseInline(span.text), context)}
          </Text>
        );
      case 'code':
        return (
          <Text
            key={key}
            style={{
              fontFamily: fonts.monoRegular,
              color: context.colors.accent,
              backgroundColor: context.colors.surfaceSunken,
            }}>
            {span.text}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            style={{ color: context.colors.accent, textDecorationLine: 'underline' }}
            onPress={() => {
              if (span.href) Linking.openURL(span.href).catch(() => {});
            }}>
            {span.text}
          </Text>
        );
      case 'wikilink': {
        const target = span.target ?? span.text;
        const id = context.resolveRef?.(target) ?? null;
        return (
          <Text
            key={key}
            style={
              id
                ? { color: context.colors.accent, fontFamily: fonts.bodyMedium }
                : { color: context.colors.textTertiary, textDecorationLine: 'underline' }
            }
            onPress={() => {
              if (id) context.onOpenRef?.(target);
              else context.onStartRef?.(target);
            }}>
            {span.text}
          </Text>
        );
      }
      case 'text':
      default:
        return span.text;
    }
  });
}

export function RichText({
  text,
  tone = 'default',
  style,
  resolveRef,
  onOpenRef,
  onStartRef,
}: RichTextProps) {
  const { colors } = useTheme();
  const spans = useMemo(() => parseInline(text), [text]);

  return (
    <AppText variant="body" tone={tone} style={style}>
      {renderSpans(spans, { colors, resolveRef, onOpenRef, onStartRef })}
    </AppText>
  );
}
