/**
 * CodeBlock — a syntax-highlighted, line-numbered read view for one file.
 *
 * It is a **text** surface, not a list: the horizontal scroll keeps long lines
 * aligned instead of wrapped, the gutter is dimmed and non-selectable, and the
 * colour comes entirely from `src/theme` through `src/lib/highlight` (which
 * emits token *kinds*, never colours). A dark-mode bug in here is impossible by
 * construction.
 *
 * The one compromise is a line budget. A 10,000-line file rendered as 10,000
 * rows would stall the UI thread on a tablet, so the block draws 600 lines and
 * offers to draw the next 600 — bounded work with no dead end.
 */
import { useMemo, useState } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { languageOf, tokenizeLine, type HighlightLanguage, type TokenKind } from '@/lib/highlight';
import { fonts, radius, spacing, useTheme } from '@/theme';

const LINE_BUDGET = 600;

export function CodeBlock({
  code,
  path,
  language,
  style,
  /** Turn off for plain text (commit messages, terminal output). */
  highlight = true,
  /** Don't draw the gutter — for pasted snippets. */
  showLineNumbers = true,
}: {
  code: string;
  path?: string;
  language?: HighlightLanguage;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
  showLineNumbers?: boolean;
}) {
  const { colors } = useTheme();
  const [budget, setBudget] = useState(LINE_BUDGET);

  const resolved: HighlightLanguage = language ?? (path ? languageOf(path) : 'plain');
  const lines = useMemo(() => (code.length === 0 ? [] : code.replace(/\n$/, '').split('\n')), [code]);
  const visible = useMemo(() => lines.slice(0, budget), [lines, budget]);

  const gutterWidth = Math.max(3, String(lines.length).length) * 9 + 16;

  /**
   * Kind → colour, using only theme tokens:
   * indigo for the language's own words, blue for data, grey for punctuation.
   */
  const colourFor: Record<TokenKind, string> = {
    plain: colors.text,
    comment: colors.textTertiary,
    string: colors.info,
    number: colors.info,
    keyword: colors.accent,
    function: colors.text,
    type: colors.info,
    property: colors.textSecondary,
    punctuation: colors.textSecondary,
    heading: colors.accent,
    link: colors.info,
    tag: colors.accent,
    attribute: colors.textSecondary,
  };

  const weightFor: Partial<Record<TokenKind, string>> = {
    keyword: fonts.monoSemibold,
    heading: fonts.monoSemibold,
    function: fonts.monoMedium,
    tag: fonts.monoMedium,
  };

  const rows = useMemo(() => {
    if (!highlight) return visible.map((line) => [{ kind: 'plain' as TokenKind, text: line }]);
    return visible.map((line) => tokenizeLine(line, resolved));
  }, [visible, highlight, resolved]);

  if (lines.length === 0) {
    return (
      <View
        style={[
          {
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.lg,
            padding: spacing.lg,
          },
          style,
        ]}>
        <AppText variant="mono" tone="tertiary">
          this file is empty
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceSunken,
          borderRadius: radius.lg,
          overflow: 'hidden',
        },
        style,
      ]}>
      <ScrollView horizontal showsHorizontalScrollIndicator bounces={false}>
        <View style={{ paddingVertical: spacing.md }}>
          {rows.map((tokens, index) => (
            <View key={index} style={{ flexDirection: 'row', paddingHorizontal: spacing.md }}>
              {showLineNumbers ? (
                <AppText
                  selectable={false}
                  style={{
                    width: gutterWidth,
                    fontFamily: fonts.monoRegular,
                    fontSize: 12,
                    lineHeight: 20,
                    color: colors.textTertiary,
                    textAlign: 'right',
                    paddingRight: spacing.md,
                  }}>
                  {index + 1}
                </AppText>
              ) : null}
              <AppText
                selectable
                style={{
                  fontFamily: fonts.monoRegular,
                  fontSize: 12,
                  lineHeight: 20,
                  color: colors.text,
                }}>
                {tokens.map((token, tokenIndex) => (
                  <AppText
                    key={tokenIndex}
                    style={{
                      fontFamily: weightFor[token.kind] ?? fonts.monoRegular,
                      fontSize: 12,
                      lineHeight: 20,
                      color: colourFor[token.kind],
                    }}>
                    {token.text}
                  </AppText>
                ))}
                {tokens.length === 0 ? ' ' : null}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>

      {lines.length > visible.length ? (
        <PressableScale
          haptic="selection"
          style={{ borderTopWidth: 1, borderTopColor: colors.hairline }}
          onPress={() => setBudget((value) => value + LINE_BUDGET)}>
          <View style={{ padding: spacing.md, alignItems: 'center' }}>
            <AppText variant="captionMedium" tone="accent">
              Show {Math.min(LINE_BUDGET, lines.length - visible.length)} more of {lines.length} lines
            </AppText>
          </View>
        </PressableScale>
      ) : null}
    </View>
  );
}
