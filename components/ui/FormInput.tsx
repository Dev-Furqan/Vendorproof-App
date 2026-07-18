import { useState } from "react";
import { Platform, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from "react-native";

import { Text } from "@/components/ui/Text";
import { alpha, colors, radii, spacing } from "@/lib/theme";

export function FormInput({ label, hint, style, containerStyle, onFocus, onBlur, ...props }: TextInputProps & { label?: string; hint?: string; containerStyle?: ViewStyle }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="label">{label}</Text>
          {hint ? <Text variant="muted" style={styles.hint}>{hint}</Text> : null}
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, webInputStyle, focused && styles.focused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  hint: {
    fontSize: 12,
    lineHeight: 16
  },
  input: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.foreground,
    paddingHorizontal: spacing.lg,
    fontSize: 16
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: alpha(colors.accent, 0.045)
  }
});

const webInputStyle = Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : undefined;
