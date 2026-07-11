import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";
import type { AttentionItem } from "@/types/compliance";

export function AttentionRow({ item }: { item: AttentionItem }) {
  const openDocument = () => {
    if (item.documentId) router.push(`/documents/${item.documentId}`);
  };

  return (
    <Pressable disabled={!item.documentId} style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={openDocument}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="file-document-outline" size={21} color={colors.accent} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="title">{item.vendor}</Text>
          <StatusBadge status={item.status} label={item.dueLabel} />
        </View>
        <Text variant="muted">
          {item.property} - {item.requirement}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.82
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 242, 210, 0.1)"
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
