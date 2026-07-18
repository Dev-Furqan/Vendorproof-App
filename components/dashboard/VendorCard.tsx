import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { alpha, colors, radii, spacing } from "@/lib/theme";
import type { VendorSummary } from "@/types/compliance";

export function VendorCard({ vendor, index = 0 }: { vendor: VendorSummary; index?: number }) {
  const openDocument = () => {
    if (vendor.documentId) router.push(`/documents/${vendor.documentId}`);
  };

  return (
    <AnimatedPressable disabled={!vendor.documentId} onPress={openDocument}>
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
              <StatusBadge status={vendor.status} delay={index * 25} />
            </View>
            {vendor.expiresAt ? (
              <View style={styles.expiryRow}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={15} color={vendor.status === "expiring" ? colors.expiring : colors.muted} />
                <Text variant="muted" className={vendor.status === "expiring" ? "text-expiring" : ""}>Valid until {vendor.expiresAt}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(colors.accent, 0.08)
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
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  }
});
