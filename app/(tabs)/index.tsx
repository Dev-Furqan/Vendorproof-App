import { router } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";

import { AttentionRow } from "@/components/dashboard/AttentionRow";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FloatingCaptureButton } from "@/components/ui/FloatingCaptureButton";
import { RefreshSettleView } from "@/components/ui/RefreshSettleView";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { toAttentionItems, toDashboardStats } from "@/lib/compliance/view-models";
import { colors, spacing } from "@/lib/theme";

export default function DashboardScreen() {
  const { data, loading, refreshing, error, refresh } = useComplianceData();
  const stats = toDashboardStats(data);
  const attention = toAttentionItems(data);
  const organizationName = data.organization?.name ?? "No organization yet";

  return (
    <>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <RefreshSettleView refreshing={refreshing} style={styles.stack}>
        <AppHeader showFilters onSearch={() => router.push("/(tabs)/vendors")} onFilters={() => router.push("/(tabs)/vendors")} />
        <View style={styles.hero}>
          <Text variant="headline">{organizationName}</Text>
          <Text variant="muted">Real-time compliance overview</Text>
        </View>

        {error ? (
          <Card>
            <Text variant="title">Could not load live data</Text>
            <Text variant="muted">{error}</Text>
            <Text variant="muted">Sign in with a team account that has a VendorProof membership.</Text>
          </Card>
        ) : null}

        <View style={styles.statGrid}>
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} delay={index * 35} />
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text variant="title">Needs Attention</Text>
              <Text variant="muted">{loading ? "Syncing latest records..." : `${attention.length} open items`}</Text>
            </View>
            <Text className="text-accent font-semibold" variant="muted">
              View All
            </Text>
          </View>

          {attention.length > 0 ? (
            attention.map((item, index) => <AttentionRow key={item.id} item={item} index={index} />)
          ) : (
            <EmptyState
              icon={data.requirements.length === 0 ? "clipboard-text-outline" : "check-decagram-outline"}
              title={data.requirements.length === 0 ? "No requirements yet" : "All clear"}
              message={data.requirements.length === 0 ? "Add a document to begin tracking compliance." : "Every tracked requirement is compliant right now."}
              actionLabel={data.requirements.length === 0 ? "Capture a Document" : "View Vendors"}
              onAction={() => router.push(data.requirements.length === 0 ? "/capture" : "/(tabs)/vendors")}
            />
          )}
        </View>
        </RefreshSettleView>
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
  statGrid: {
    flexDirection: "row",
    gap: 10
  },
  section: {
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  }
});
