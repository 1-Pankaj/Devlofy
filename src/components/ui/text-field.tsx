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
        <AppText variant="eyebrow" tone="tertiary">
          {label}
        </AppText>
      ) : null}
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
            backgroundColor: colors.surfaceSunken,
            borderWidth: 2,
            borderColor: focused ? colors.accent : 'transparent',
            borderRadius: radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            color: colors.text,
            fontFamily: fonts.bodyRegular,
            fontSize: 16,
            lineHeight: multiline ? 24 : undefined,
            minHeight: multiline ? 140 : 48,
            textAlignVertical: multiline ? 'top' : 'center',
          } as TextStyle,
          inputStyle,
        ]}
      />
    </View>
  );
}
