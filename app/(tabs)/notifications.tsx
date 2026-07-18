import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FloatingCaptureButton } from "@/components/ui/FloatingCaptureButton";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { toAttentionItems } from "@/lib/compliance/view-models";
import { colors, spacing } from "@/lib/theme";

export default function NotificationsScreen() {
  const { data, loading, error } = useComplianceData();
  const alerts = toAttentionItems(data);

  return (
    <>
      <Screen>
        <View style={styles.stack}>
        <AppHeader />
        <View style={styles.hero}>
          <Text variant="headline">Notifications</Text>
          <Text variant="muted">Expiration alerts and review activity.</Text>
        </View>

        <View style={styles.list}>
          {error ? (
            <Card>
              <Text variant="title">Notifications unavailable</Text>
              <Text variant="muted">{error}</Text>
            </Card>
          ) : null}

          {alerts.map((alert, index) => (
            <AnimatedPressable
              key={alert.id}
              disabled={!alert.documentId}
              onPress={() => {
                if (alert.documentId) router.push(`/documents/${alert.documentId}`);
              }}
            >
              <Card>
                <View style={styles.alertTop}>
                  <View style={styles.alertCopy}>
                    <Text variant="title">{alert.requirement}</Text>
                    <Text variant="muted">
                      {alert.vendor} - {alert.property}
                    </Text>
                  </View>
                  <View style={styles.unreadDot} />
                </View>
                <StatusBadge status={alert.status} label={alert.dueLabel} delay={index * 35} />
              </Card>
            </AnimatedPressable>
          ))}

          {!loading && alerts.length === 0 ? (
            <EmptyState icon="bell-check-outline" title="You’re all caught up" message="Missing, expiring, and review alerts will appear here." actionLabel="View Dashboard" onAction={() => router.push("/(tabs)")} />
          ) : null}
        </View>
        </View>
      </Screen>
      <FloatingCaptureButton />
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.section
  },
  hero: {
    gap: 4
  },
  list: {
    gap: spacing.md
  },
  dateLabel: {
    marginBottom: 8,
    marginTop: 8
  },
  alertTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  alertCopy: {
    flex: 1,
    gap: 4
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accent
  }
});
