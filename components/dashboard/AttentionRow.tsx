import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { alpha, colors, radii, shadows, spacing } from "@/lib/theme";
import type { AttentionItem } from "@/types/compliance";

export function AttentionRow({ item, index = 0 }: { item: AttentionItem; index?: number }) {
  const openDocument = () => {
    if (item.documentId) router.push(`/documents/${item.documentId}`);
  };

  return (
    <AnimatedPressable disabled={!item.documentId} style={styles.row} onPress={openDocument}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="file-document-outline" size={21} color={colors.accent} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="title">{item.vendor}</Text>
          <StatusBadge status={item.status} label={item.dueLabel} delay={index * 35} />
        </View>
        <Text variant="muted">
          {item.property} - {item.requirement}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(colors.accent, 0.1)
  },
  body: {
    flex: 1,
    gap: 8
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  }
});
