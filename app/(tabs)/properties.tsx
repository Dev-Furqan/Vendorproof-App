import { StyleSheet, View } from "react-native";

import { AppHeader } from "@/components/ui/AppHeader";
import { PropertyCard } from "@/components/dashboard/PropertyCard";
import { Card } from "@/components/ui/Card";
import { FloatingCaptureButton } from "@/components/ui/FloatingCaptureButton";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { toPropertySummaries } from "@/lib/compliance/view-models";

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
            <Card>
              <Text variant="title">No properties yet</Text>
              <Text variant="muted">Add portfolio properties in the web app and they will appear here in real time.</Text>
            </Card>
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
    gap: 24
  },
  hero: {
    gap: 4
  },
  list: {
    gap: 12
  }
});
