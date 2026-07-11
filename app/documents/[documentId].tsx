import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { useComplianceData } from "@/lib/compliance/data";
import { colors } from "@/lib/theme";

export default function DocumentReviewScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const { data, loading, error } = useComplianceData();
  const document = data.requirements.map((requirement) => requirement.document).find((item) => item?.id === documentId) ?? null;
  const fields = document
    ? [
        ["Document Type", document.document_type],
        ["Business Name", document.business_name ?? document.ai_extracted_business_name],
        ["Policy Number", document.policy_number ?? document.ai_extracted_policy_number],
        ["Effective Date", document.issued_at ?? document.ai_extracted_effective_date],
        ["Expiration Date", document.expires_at ?? document.ai_extracted_expiration_date],
        ["Carrier", document.issuing_authority ?? document.ai_extracted_issuing_authority]
      ]
    : [];

  return (
    <Screen>
      <View style={styles.stack}>
        <View style={styles.header}>
          <Button variant="ghost" className="items-start px-0" onPress={() => router.back()}>
            Back
          </Button>
          <View style={styles.hero}>
            <Text variant="headline">Document Review</Text>
            <Text variant="muted">{document?.latestVersion?.file_name ?? documentId}</Text>
          </View>
        </View>

        {error ? (
          <Card>
            <Text variant="title">Document unavailable</Text>
            <Text variant="muted">{error}</Text>
          </Card>
        ) : null}

        {!loading && !document ? (
          <Card>
            <Text variant="title">Document not found</Text>
            <Text variant="muted">This review opens only for real documents synced from Supabase.</Text>
          </Card>
        ) : null}

        <Card className="bg-surface-muted" style={styles.preview}>
          <MaterialCommunityIcons name="file-document-outline" size={42} color={colors.accent} />
          <Text variant="title">Document Preview</Text>
          <Text variant="muted">{document?.latestVersion?.file_name ?? "No document file loaded"}</Text>
        </Card>

        {document ? (
          <Card>
          <View style={styles.cardHeader}>
            <Text variant="title">AI Extracted Data</Text>
            <StatusBadge status={document.status === "approved" ? "compliant" : "under_review"} />
          </View>
          {fields.map(([label, value]) => (
            <View key={label} style={styles.fieldBox}>
              <Text variant="label">{label}</Text>
              <Text>{value ?? "Not captured"}</Text>
            </View>
          ))}
          </Card>
        ) : null}

        {document ? (
          <Card>
          <Text variant="title">Requirement Checklist</Text>
          {["Confirm extracted fields", "Verify document belongs to the vendor", "Check expiration date"].map((item) => (
            <View key={item} style={styles.checkRow}>
              <View style={styles.checkDot} />
              <Text>{item}</Text>
            </View>
          ))}
          </Card>
        ) : null}

        {document ? (
          <View style={styles.actions}>
          <Button>Approve Document</Button>
          <Button variant="danger">Request Resubmission</Button>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 24
  },
  header: {
    gap: 12
  },
  hero: {
    gap: 4
  },
  preview: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    backgroundColor: colors.surface
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  fieldBox: {
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    padding: 12
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.compliant
  },
  actions: {
    gap: 12
  }
});
