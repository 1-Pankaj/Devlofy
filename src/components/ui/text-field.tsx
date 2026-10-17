import { TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { fonts, radius, spacing, useTheme } from '@/theme';
import { AppText } from './app-text';

export type TextFieldProps = Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'multiline' | 'autoFocus' | 'returnKeyType' | 'onSubmitEditing' | 'editable'
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
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();

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
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        style={[
          {
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.hairline,
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
