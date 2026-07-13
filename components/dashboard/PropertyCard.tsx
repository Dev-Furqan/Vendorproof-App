import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";
import type { PropertySummary } from "@/types/compliance";

export function PropertyCard({ property, index = 0 }: { property: PropertySummary; index?: number }) {
  return (
    <AnimatedPressable>
      <Card>
        <View style={styles.topRow}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="office-building-outline" size={22} color={colors.accent} />
          </View>
          <StatusBadge status={property.status} label={`${property.compliant}/${property.total} Compliant`} delay={index * 25} />
        </View>
        <View style={styles.copy}>
          <Text variant="title">{property.name}</Text>
          <Text variant="muted">{property.address}</Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.avatarStack}>
            <View style={styles.miniAvatar}>
              <MaterialCommunityIcons name="briefcase-outline" size={14} color={colors.muted} />
            </View>
            <View style={styles.miniAvatar}>
              <Text variant="label">+{Math.max(property.total - property.compliant, 0)}</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent} />
        </View>
      </Card>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(87, 241, 219, 0.1)"
  },
  copy: {
    gap: 3
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginTop: 4
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center"
  },
  miniAvatar: {
    width: 28,
    height: 28,
    marginRight: -6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHigh
  }
});
