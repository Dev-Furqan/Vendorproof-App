import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Text } from "@/components/ui/Text";
import { alpha, colors, radii, shadows, spacing } from "@/lib/theme";
import type { DashboardStat } from "@/types/compliance";

const metaByStatus = {
  compliant: { text: "text-compliant", color: colors.compliant, icon: "check-circle-outline" },
  expiring: { text: "text-expiring", color: colors.expiring, icon: "alert-outline" },
  missing: { text: "text-missing", color: colors.missing, icon: "file-alert-outline" },
  under_review: { text: "text-review", color: colors.review, icon: "clock-outline" },
  deficient: { text: "text-missing", color: colors.missing, icon: "close-circle-outline" },
  never_responded: { text: "text-muted", color: colors.muted, icon: "progress-question" }
};

export function StatCard({ stat, delay = 0 }: { stat: DashboardStat; delay?: number }) {
  const meta = metaByStatus[stat.status];

  return (
    <Card className="p-3" style={[styles.card, { borderColor: alpha(meta.color, 0.3) }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: alpha(meta.color, 0.1) }]}>
          <MaterialCommunityIcons name={meta.icon as never} size={18} color={meta.color} />
        </View>
      </View>
      <View style={styles.valueBlock}>
        <AnimatedNumber value={stat.value} duration={240 + delay} className={meta.text} style={styles.number} />
        <Text variant="label" style={{ color: meta.color }}>{stat.label}</Text>
        <Text variant="muted" style={styles.helper}>{stat.helper ?? "Live count"}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 154,
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radii.lg,
    ...shadows.card
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  valueBlock: {
    gap: 2
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center"
  },
  number: {
    fontSize: 42,
    lineHeight: 46
  },
  helper: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15
  }
});
