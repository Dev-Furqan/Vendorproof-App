import { StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/lib/theme";
import type { ComplianceStatus } from "@/types/compliance";

const badgeStyles: Record<ComplianceStatus, { label: string; className: string; dot: string; color: string; backgroundColor: string; borderColor: string }> = {
  compliant: {
    label: "Compliant",
    className: "border-compliant/30 bg-compliant/10",
    dot: "bg-compliant",
    color: colors.compliant,
    backgroundColor: "rgba(87, 241, 219, 0.1)",
    borderColor: "rgba(87, 241, 219, 0.24)"
  },
  expiring: {
    label: "Expiring Soon",
    className: "border-expiring/30 bg-expiring/10",
    dot: "bg-expiring",
    color: colors.expiring,
    backgroundColor: "rgba(211, 218, 239, 0.1)",
    borderColor: "rgba(211, 218, 239, 0.24)"
  },
  missing: {
    label: "Missing",
    className: "border-missing/30 bg-missing/10",
    dot: "bg-missing",
    color: colors.missing,
    backgroundColor: "rgba(255, 180, 171, 0.1)",
    borderColor: "rgba(255, 180, 171, 0.28)"
  },
  under_review: {
    label: "Under Review",
    className: "border-review/30 bg-review/10",
    dot: "bg-review",
    color: colors.review,
    backgroundColor: "rgba(195, 198, 212, 0.1)",
    borderColor: "rgba(195, 198, 212, 0.24)"
  },
  deficient: {
    label: "Deficient",
    className: "border-missing/30 bg-missing/10",
    dot: "bg-missing",
    color: colors.missing,
    backgroundColor: "rgba(253, 164, 175, 0.1)",
    borderColor: "rgba(253, 164, 175, 0.3)"
  },
  never_responded: {
    label: "No Response",
    className: "border-missing/30 bg-missing/10",
    dot: "bg-missing",
    color: colors.muted,
    backgroundColor: "rgba(155, 166, 182, 0.1)",
    borderColor: "rgba(155, 166, 182, 0.3)"
  }
};

export function StatusBadge({ status, label }: { status: ComplianceStatus; label?: string }) {
  const badge = badgeStyles[status];

  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${badge.className}`}
      style={[styles.badge, { backgroundColor: badge.backgroundColor, borderColor: badge.borderColor }]}
    >
      <View className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} style={[styles.dot, { backgroundColor: badge.color }]} />
      <Text className="text-xs font-semibold" style={{ color: badge.color }}>
        {label ?? badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start"
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999
  }
});
