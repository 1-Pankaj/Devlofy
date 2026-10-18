/**
 * Colour — parse it, ramp it, and prove whether text on it can be read.
 *
 * Contrast is the point. The ratio is shown with the grade it earns at body size
 * and at large size, because "4.5" means nothing without "and that is the AA bar
 * for body text". A live preview — the colour as *text* on the comparison colour
 * — sits above the numbers, because the eye disagrees with arithmetic often
 * enough to be worth showing both.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Panel } from '@/components/ui/panel';
import { StatusPill } from '@/components/ui/pill';
import { TextField } from '@/components/ui/text-field';
import { contrastRatio, parseColour, ramp, toHex, toHslString, toRgbString, verdict } from '@/lib/bench/colour';
import { toolById } from '@/lib/bench/tools';
import { fonts, radius, spacing, useTheme } from '@/theme';
import { CopyButton, ToolFailure, ToolNote, ToolSection, monoInput } from './parts';
import { SaveSnippetPanel } from './save-snippet';

const TOOL = toolById('colour')!;

function Grade({ label, passes, threshold }: { label: string; passes: boolean; threshold: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <StatusPill label={passes ? 'pass' : 'fail'} tone={passes ? 'accent' : 'danger'} />
      <AppText variant="caption" tone="secondary">
        {label} · needs {threshold}:1
      </AppText>
    </View>
  );
}

export function ColourTool({ initial, snippetId = null }: { initial?: string; snippetId?: string | null }) {
  const { colors } = useTheme();
  const [input, setInput] = useState(initial ?? '#4f46e5');
  const [against, setAgainst] = useState('#ffffff');

  const colour = useMemo(() => parseColour(input), [input]);
  const background = useMemo(() => parseColour(against) ?? { r: 255, g: 255, b: 255, a: 1 }, [against]);
  const ratio = useMemo(() => (colour ? contrastRatio(colour, background) : 0), [colour, background]);
  const grades = useMemo(() => verdict(ratio), [ratio]);
  const swatches = useMemo(() => (colour ? ramp(colour) : []), [colour]);

  const hex = colour ? toHex(colour) : '';

  return (
    <>
      <ToolSection label="Preview">
        <Panel
          style={{
            backgroundColor: background.a < 1 ? colors.surfaceSunken : toHex(background),
            gap: spacing.sm,
            minHeight: 120,
            justifyContent: 'center',
          }}>
          <AppText
            style={{
              color: colour ? toHex(colour) : colors.text,
              fontFamily: fonts.bodySemibold,
              fontSize: 22,
              lineHeight: 28,
            }}>
            The quick brown fox
          </AppText>
          <AppText
            style={{
              color: colour ? toHex(colour) : colors.text,
              fontFamily: fonts.bodyRegular,
              fontSize: 14,
              lineHeight: 20,
              opacity: 0.9,
            }}>
            Body text at 14px, which is where the 4.5 rule applies.
          </AppText>
        </Panel>
      </ToolSection>

      <TextField
        label="Colour"
        value={input}
        onChangeText={setInput}
        placeholder="#4f46e5, rgb(79 70 229), hsl(243 75% 59%)"
        autoCapitalize="none"
        autoCorrect={false}
        inputStyle={monoInput}
      />

      <TextField
        label="Against"
        value={against}
        onChangeText={setAgainst}
        placeholder="#ffffff"
        autoCapitalize="none"
        autoCorrect={false}
        inputStyle={monoInput}
      />

      {!colour && input.trim().length > 0 ? (
        <ToolFailure
          title="Cannot read that colour"
          message="Hex (#abc, #aabbcc, #aabbccdd), rgb()/rgba(), hsl()/hsla(), or a common name."
        />
      ) : null}

      {colour ? (
        <>
          <ToolSection label="Readings" trailing={<CopyButton text={`${hex} · ${toRgbString(colour)}`} />}>
            <Panel style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    backgroundColor: hex,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                  }}
                />
                <View style={{ gap: 2 }}>
                  <AppText variant="mono">{hex}</AppText>
                  <AppText variant="mono" tone="tertiary">
                    {toRgbString(colour)}
                  </AppText>
                  <AppText variant="mono" tone="tertiary">
                    {toHslString(colour)}
                  </AppText>
                </View>
              </View>
            </Panel>
          </ToolSection>

          <ToolSection
            label="Contrast"
            trailing={
              <StatusPill
                label={`${ratio.toFixed(2)}:1`}
                tone={grades.body.aa.passes ? 'accent' : grades.large.aa.passes ? 'ember' : 'danger'}
              />
            }>
            <Panel style={{ gap: spacing.md }}>
              <Grade label="Body text (AA)" passes={grades.body.aa.passes} threshold={grades.body.aa.threshold} />
              <Grade label="Body text (AAA)" passes={grades.body.aaa.passes} threshold={grades.body.aaa.threshold} />
              <Grade label="Large text (AA)" passes={grades.large.aa.passes} threshold={grades.large.aa.threshold} />
              <Grade
                label="Large text (AAA)"
                passes={grades.large.aaa.passes}
                threshold={grades.large.aaa.threshold}
              />
              <Grade label="UI parts and icons" passes={grades.ui.passes} threshold={grades.ui.threshold} />
            </Panel>
          </ToolSection>

          <ToolSection
            label="Ramp"
            trailing={<CopyButton text={swatches.map((swatch) => swatch.hex).join('\n')} label="Copy hexes" />}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {swatches.map((swatch) => (
                <View key={swatch.step} style={{ alignItems: 'center', gap: 4, width: 62 }}>
                  <View
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: radius.sm,
                      backgroundColor: swatch.hex,
                      borderWidth: swatch.step === 500 ? 2 : 1,
                      borderColor: swatch.step === 500 ? colors.accent : colors.hairline,
                    }}
                  />
                  <AppText variant="caption" tone="tertiary" style={{ fontFamily: fonts.monoRegular }}>
                    {swatch.step}
                  </AppText>
                  <AppText variant="caption" tone="tertiary">
                    {swatch.onWhite.toFixed(1)}w
                  </AppText>
                </View>
              ))}
            </View>
            <ToolNote>
              500 is the colour you typed; lighter steps mix toward white, darker toward black. The
              small number under each is its contrast against white — 4.5 is the AA bar.
            </ToolNote>
          </ToolSection>

          <SaveSnippetPanel tool={TOOL} snippetId={snippetId} body={hex} language="plain" suggestedTitle="Colour · hex" />
        </>
      ) : null}
    </>
  );
}
