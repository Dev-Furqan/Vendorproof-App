import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { VendorCard } from "@/components/dashboard/VendorCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { FloatingCaptureButton } from "@/components/ui/FloatingCaptureButton";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { toVendorSummaries } from "@/lib/compliance/view-models";
import { colors } from "@/lib/theme";
import type { ComplianceStatus } from "@/types/compliance";

const filters: Array<{ label: string; value: ComplianceStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Expiring Soon", value: "expiring" },
  { label: "Missing", value: "missing" },
  { label: "Compliant", value: "compliant" }
];

export default function VendorsScreen() {
  const { data, loading, error } = useComplianceData();
  const vendors = toVendorSummaries(data);
  const [filter, setFilter] = useState<ComplianceStatus | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      vendors.filter((vendor) => {
        const statusMatch = filter === "all" || vendor.status === filter;
        const textMatch = vendor.name.toLowerCase().includes(query.toLowerCase()) || vendor.trade.toLowerCase().includes(query.toLowerCase());
        return statusMatch && textMatch;
      }),
    [filter, query, vendors]
  );

  return (
    <>
      <Screen>
        <View style={styles.stack}>
        <AppHeader />
        <View style={styles.hero}>
          <Text variant="headline">Vendors</Text>
          <Text variant="muted">Manage compliance for {vendors.length} registered entities.</Text>
        </View>

        <TextInput
          placeholder="Search vendors"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
        />

        <View style={styles.filters}>
          {filters.map((item) => {
            const active = filter === item.value;
            return (
              <Pressable
                key={item.value}
                style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
                onPress={() => setFilter(item.value)}
              >
                <Text className={`text-sm font-semibold ${active ? "text-accent-foreground" : "text-muted"}`}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Card>
            <Text variant="title">Vendors unavailable</Text>
            <Text variant="muted">{error}</Text>
          </Card>
        ) : null}

        <View style={styles.list}>
          {filtered.map((vendor, index) => (
            <VendorCard key={vendor.id} vendor={vendor} index={index} />
          ))}
          {!loading && filtered.length === 0 ? (
            <Card>
              <Text variant="title">No vendors found</Text>
              <Text variant="muted">Adjust the search or add vendors in the web app.</Text>
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
    gap: 16
  },
  hero: {
    gap: 4
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.foreground,
    paddingHorizontal: 16,
    fontSize: 16
  },
  filters: {
    flexDirection: "row",
    gap: 8
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  filterChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  pressed: {
    opacity: 0.82
  },
  list: {
    gap: 12
  }
});
