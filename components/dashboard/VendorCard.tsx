import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";
import type { VendorSummary } from "@/types/compliance";

export function VendorCard({ vendor }: { vendor: VendorSummary }) {
  const openDocument = () => {
    if (vendor.documentId) router.push(`/documents/${vendor.documentId}`);
  };

  return (
    <Pressable disabled={!vendor.documentId} style={({ pressed }) => [pressed && styles.pressed]} onPress={openDocument}>
      <Card>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name={vendor.status === "missing" ? "file-alert-outline" : "briefcase-check-outline"} size={22} color={colors.accent} />
          </View>
          <View style={styles.body}>
            <View style={styles.topRow}>
              <View style={styles.titleWrap}>
                <Text variant="title">{vendor.name}</Text>
                <Text variant="muted">
                  ID: V-{vendor.id.slice(0, 5).toUpperCase()} - {vendor.trade}
                </Text>
              </View>
              <StatusBadge status={vendor.status} />
            </View>
            {vendor.expiresAt ? <Text variant="muted">Valid until {vendor.expiresAt}</Text> : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  body: {
    flex: 1,
    gap: 10
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  titleWrap: {
    flex: 1
  }
});
