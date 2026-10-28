/**
 * TextField — an input drawn like every other box.
 *
 * White ground, 1px hairline, 6px radius, 44px tall. On focus the border turns
 * brand and a 3px soft-brand ring sits outside it (a `boxShadow`, so it never
 * shifts layout). Labels are mono, above the field, never inside a floating
 * notch.
 */
import { useState } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { fonts, radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';

export type TextFieldProps = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'multiline'
  | 'autoFocus'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'editable'
  | 'onFocus'
  | 'onBlur'
  | 'selectTextOnFocus'
  | 'keyboardType'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'secureTextEntry'
  | 'maxLength'
  | 'submitBehavior'
> & {
  label?: string;
  /** Outer wrapper. */
  style?: StyleProp<ViewStyle>;
  /** The input itself. */
  inputStyle?: StyleProp<TextStyle>;
};

export function TextField({
  label,
  style,
  inputStyle,
  multiline = false,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {label ? (
        <AppText variant="monoLabel" tone="tertiary">
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.hairlineStrong,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          boxShadow: focused ? `0 0 0 3px ${colors.accentSoft}` : undefined,
        }}>
        <TextInput
          {...inputProps}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[
            {
              backgroundColor: 'transparent',
              borderRadius: radius.md,
              paddingHorizontal: spacing.md + 2,
              paddingVertical: multiline ? spacing.md : 11,
              color: colors.text,
              fontFamily: fonts.bodyRegular,
              fontSize: 16,
              lineHeight: multiline ? 24 : 20,
              minHeight: multiline ? 140 : 44,
              textAlignVertical: multiline ? 'top' : 'center',
            } as TextStyle,
            inputStyle,
          ]}
        />
      </View>
    </View>
  );
}
