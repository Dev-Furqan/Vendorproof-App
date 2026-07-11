import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";
import type { DashboardStat } from "@/types/compliance";

const metaByStatus = {
  compliant: { text: "text-compliant", color: colors.compliant, icon: "check-circle-outline" },
  expiring: { text: "text-expiring", color: colors.expiring, icon: "alert-outline" },
  missing: { text: "text-missing", color: colors.missing, icon: "file-alert-outline" },
  under_review: { text: "text-review", color: colors.review, icon: "clock-outline" },
  deficient: { text: "text-missing", color: colors.missing, icon: "close-circle-outline" },
  never_responded: { text: "text-muted", color: colors.muted, icon: "progress-question" }
};

export function StatCard({ stat }: { stat: DashboardStat }) {
  const meta = metaByStatus[stat.status];

  return (
    <Card className="p-3" style={styles.card}>
      <View style={styles.header}>
        <Text variant="label">{stat.label}</Text>
        <MaterialCommunityIcons name={meta.icon as never} size={20} color={meta.color} />
      </View>
      <View style={styles.valueBlock}>
        <Text variant="display" className={meta.text}>
          {stat.value}
        </Text>
        <Text variant="muted">{stat.helper ?? "Live count"}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 124,
    justifyContent: "space-between"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  valueBlock: {
    gap: 0
  }
});
