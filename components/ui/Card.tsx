import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors, shadows } from "@/lib/theme";

export function Card({ children, className = "", style }: PropsWithChildren<{ className?: string; style?: ViewStyle | ViewStyle[] }>) {
  return (
    <View
      className={`rounded-card border border-border bg-surface p-4 ${className}`}
      style={[styles.card, className.includes("bg-surface-muted") && styles.muted, className.includes("p-3") && styles.compact, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 14,
    ...shadows.card
  },
  muted: {
    backgroundColor: colors.surfaceMuted
  },
  compact: {
    padding: 12
  }
});
