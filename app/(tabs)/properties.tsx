import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { PropertyCard } from "@/components/dashboard/PropertyCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FloatingCaptureButton } from "@/components/ui/FloatingCaptureButton";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { toPropertySummaries } from "@/lib/compliance/view-models";
import { spacing } from "@/lib/theme";

export default function PropertiesScreen() {
  const { data, loading, error } = useComplianceData();
  const rows = toPropertySummaries(data);

  return (
    <>
      <Screen>
        <View style={styles.stack}>
        <AppHeader />
        <View style={styles.hero}>
          <Text variant="headline">Properties</Text>
          <Text variant="muted">Manage compliance across {rows.length} active locations.</Text>
        </View>

        {error ? (
          <Card>
            <Text variant="title">Properties unavailable</Text>
            <Text variant="muted">{error}</Text>
          </Card>
        ) : null}

        <View style={styles.list}>
          {rows.map((property, index) => (
            <PropertyCard key={property.id} property={property} index={index} />
          ))}
          {!loading && rows.length === 0 ? (
            <EmptyState icon="office-building-plus-outline" title="No properties yet" message="Properties will appear here as soon as their first vendor document is added." actionLabel="Capture a Document" onAction={() => router.push("/capture")} />
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
  }
});
import { router } from "expo-router";
