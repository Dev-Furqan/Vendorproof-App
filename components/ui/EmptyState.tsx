import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { alpha, colors, spacing } from "@/lib/theme";

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.icon}>
        <MaterialCommunityIcons name={icon} size={28} color={colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text variant="title">{title}</Text>
        <Text variant="muted" style={styles.message}>{message}</Text>
      </View>
      <Button variant="secondary" onPress={onAction}>{actionLabel}</Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    paddingVertical: spacing.xxxl
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: alpha(colors.accent, 0.24),
    backgroundColor: alpha(colors.accent, 0.08)
  },
  copy: {
    alignItems: "center",
    gap: spacing.sm
  },
  message: {
    maxWidth: 300,
    textAlign: "center"
  }
});
