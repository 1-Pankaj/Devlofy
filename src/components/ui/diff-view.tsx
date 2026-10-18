/**
 * DiffView — one renderer for both kinds of diff this app shows.
 *
 * Our own edits (`diffLines`) and GitHub's pull-request patches (`parsePatch`)
 * arrive as the same `DiffHunk[]`, so they look identical on screen: a dimmed
 * gutter with two line numbers, a sign, and a tinted row — indigo for what you
 * are adding, error-red for what you are taking away. Colour is never the only
 * signal; the `+` and `−` are always there.
 *
 * Long lines wrap rather than scroll sideways, which is how a diff reads best on
 * a phone: you want the whole changed line, not the first 40 characters of it.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { hunkHeader, type DiffHunk } from '@/lib/diff';
import { fonts, radius, spacing, useTheme } from '@/theme';

export function DiffView({
  hunks,
  emptyLabel = 'no line changes',
  style,
}: {
  hunks: DiffHunk[];
  emptyLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  if (hunks.length === 0) {
    return (
      <View
        style={[
          {
            backgroundColor: colors.surfaceSunken,
            borderRadius: radius.md,
            padding: spacing.lg,
          },
          style,
        ]}>
        <AppText variant="mono" tone="tertiary">
          {emptyLabel}
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={[
        { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, overflow: 'hidden' },
        style,
      ]}>
      {hunks.map((hunk, hunkIndex) => (
        <View key={hunkIndex}>
          <View
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              backgroundColor: colors.surfaceElevated,
              borderTopWidth: hunkIndex === 0 ? 0 : 1,
              borderTopColor: colors.hairline,
            }}>
            <AppText variant="mono" tone="tertiary" style={{ fontSize: 12 }}>
              {hunkHeader(hunk)}
            </AppText>
          </View>

          {hunk.lines.map((line, lineIndex) => {
            const added = line.kind === 'add';
            const removed = line.kind === 'remove';
            return (
              <View
                key={lineIndex}
                style={{
                  flexDirection: 'row',
                  backgroundColor: added
                    ? colors.accentSoft
                    : removed
                      ? colors.dangerSoft
                      : 'transparent',
                }}>
                <AppText
                  selectable={false}
                  style={{
                    width: 34,
                    fontFamily: fonts.monoRegular,
                    fontSize: 12,
                    lineHeight: 19,
                    color: colors.textTertiary,
                    textAlign: 'right',
                  }}>
                  {line.beforeNo ?? ''}
                </AppText>
                <AppText
                  selectable={false}
                  style={{
                    width: 34,
                    fontFamily: fonts.monoRegular,
                    fontSize: 12,
                    lineHeight: 19,
                    color: colors.textTertiary,
                    textAlign: 'right',
                  }}>
                  {line.afterNo ?? ''}
                </AppText>
                <AppText
                  selectable={false}
                  style={{
                    width: 18,
                    fontFamily: fonts.monoSemibold,
                    fontSize: 12,
                    lineHeight: 19,
                    textAlign: 'center',
                    color: added ? colors.accent : removed ? colors.danger : colors.textTertiary,
                  }}>
                  {added ? '+' : removed ? '−' : ' '}
                </AppText>
                <AppText
                  selectable
                  style={{
                    flex: 1,
                    fontFamily: fonts.monoRegular,
                    fontSize: 12,
                    lineHeight: 19,
                    color: added ? colors.accent : removed ? colors.danger : colors.text,
                  }}>
                  {line.text.length > 0 ? line.text : ' '}
                </AppText>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** `+3 −1` — a chip-sized summary that never needs a second line. */
export function DiffStat({
  added,
  removed,
  style,
}: {
  added: number;
  removed: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View style={[{ flexDirection: 'row', gap: spacing.sm }, style]}>
      {added > 0 ? (
        <AppText variant="mono" style={{ color: colors.accent, fontSize: 12 }}>
          +{added}
        </AppText>
      ) : null}
      {removed > 0 ? (
        <AppText variant="mono" style={{ color: colors.danger, fontSize: 12 }}>
          −{removed}
        </AppText>
      ) : null}
      {added === 0 && removed === 0 ? (
        <AppText variant="mono" tone="tertiary" style={{ fontSize: 12 }}>
          no changes
        </AppText>
      ) : null}
    </View>
  );
}
