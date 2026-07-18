import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { FadeInView } from "@/components/ui/FadeInView";
import { Text } from "@/components/ui/Text";
import { alpha, colors } from "@/lib/theme";
import type { ComplianceStatus } from "@/types/compliance";

const badgeStyles: Record<ComplianceStatus, { label: string; className: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; color: string; backgroundColor: string; borderColor: string }> = {
  compliant: {
    label: "Compliant",
    className: "border-compliant/30 bg-compliant/10",
    icon: "check-circle",
    color: colors.compliant,
    backgroundColor: alpha(colors.compliant, 0.1),
    borderColor: alpha(colors.compliant, 0.24)
  },
  expiring: {
    label: "Expiring Soon",
    className: "border-expiring/30 bg-expiring/10",
    icon: "clock-alert-outline",
    color: colors.expiring,
    backgroundColor: alpha(colors.expiring, 0.1),
    borderColor: alpha(colors.expiring, 0.24)
  },
  missing: {
    label: "Missing",
    className: "border-missing/30 bg-missing/10",
    icon: "alert-circle",
    color: colors.missing,
    backgroundColor: alpha(colors.missing, 0.1),
    borderColor: alpha(colors.missing, 0.28)
  },
  under_review: {
    label: "Under Review",
    className: "border-review/30 bg-review/10",
    icon: "eye-check-outline",
    color: colors.review,
    backgroundColor: alpha(colors.review, 0.1),
    borderColor: alpha(colors.review, 0.24)
  },
  deficient: {
    label: "Deficient",
    className: "border-missing/30 bg-missing/10",
    icon: "close-circle",
    color: colors.missing,
    backgroundColor: alpha(colors.missing, 0.1),
    borderColor: alpha(colors.missing, 0.3)
  },
  never_responded: {
    label: "No Response",
    className: "border-missing/30 bg-missing/10",
    icon: "message-question-outline",
    color: colors.muted,
    backgroundColor: alpha(colors.muted, 0.1),
    borderColor: alpha(colors.muted, 0.3)
  }
};

export function StatusBadge({ status, label, delay = 0 }: { status: ComplianceStatus; label?: string; delay?: number }) {
  const badge = badgeStyles[status];

  return (
    <FadeInView delay={delay} distance={4}>
      <View
        className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${badge.className}`}
        style={[styles.badge, { backgroundColor: badge.backgroundColor, borderColor: badge.borderColor }]}
      >
        <MaterialCommunityIcons name={badge.icon} size={13} color={badge.color} />
        <Text className="text-xs font-semibold" style={{ color: badge.color }}>
          {label ?? badge.label}
        </Text>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start"
  }
});
