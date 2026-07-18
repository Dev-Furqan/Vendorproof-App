import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { VendorCard } from "@/components/dashboard/VendorCard";
import { AppHeader } from "@/components/ui/AppHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormInput } from "@/components/ui/FormInput";
import { FloatingCaptureButton } from "@/components/ui/FloatingCaptureButton";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { toVendorSummaries } from "@/lib/compliance/view-models";
import { colors, spacing } from "@/lib/theme";
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

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
        <FormInput
          placeholder="Search vendors"
          containerStyle={styles.searchInput}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
        />
        </View>

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
            <EmptyState
              icon={query || filter !== "all" ? "magnify-close" : "account-hard-hat-outline"}
              title={query || filter !== "all" ? "No matching vendors" : "No vendors yet"}
              message={query || filter !== "all" ? "Try a different search or clear the active filter." : "Capture a vendor document to start building your compliance list."}
              actionLabel={query || filter !== "all" ? "Clear Filters" : "Capture a Document"}
              onAction={() => {
                if (query || filter !== "all") {
                  setQuery("");
                  setFilter("all");
                } else router.push("/capture");
              }}
            />
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
  input: {
    flex: 1,
    minHeight: 50,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingLeft: 0
  },
  searchWrap: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    paddingLeft: 14,
    paddingRight: 4
  },
  searchInput: {
    flex: 1
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
    gap: spacing.md
  }
});
