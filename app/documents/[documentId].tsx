import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { getCurrentWorkspace, useComplianceData } from "@/lib/compliance/data";
import { createDocumentSignedUrl } from "@/lib/documents/mobile-documents";
import { toFriendlyNetworkError } from "@/lib/network";
import { supabase } from "@/lib/supabase/client";
import { colors } from "@/lib/theme";

export default function DocumentReviewScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const { data, loading, error, reload } = useComplianceData();
  const requirement = data.requirements.find((item) => item.document?.id === documentId) ?? null;
  const document = requirement?.document ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    documentType: "",
    businessName: "",
    policyNumber: "",
    effectiveDate: "",
    expirationDate: "",
    carrier: ""
  });

  useEffect(() => {
    if (!document) return;
    setFields({
      documentType: document.document_type ?? document.ai_extracted_document_type ?? "",
      businessName: document.business_name ?? document.ai_extracted_business_name ?? "",
      policyNumber: document.policy_number ?? document.ai_extracted_policy_number ?? "",
      effectiveDate: document.issued_at ?? document.ai_extracted_effective_date ?? "",
      expirationDate: document.expires_at ?? document.ai_extracted_expiration_date ?? "",
      carrier: document.issuing_authority ?? document.ai_extracted_issuing_authority ?? ""
    });
  }, [document]);

  useEffect(() => {
    let mounted = true;
    if (!document?.latestVersion?.storage_path) {
      setPreviewUrl(null);
      return;
    }

    createDocumentSignedUrl(document.latestVersion.storage_path)
      .then((url) => {
        if (mounted) setPreviewUrl(url);
      })
      .catch((error) => {
        if (mounted) setActionError(toFriendlyNetworkError(error, "Could not load the document preview."));
      });

    return () => {
      mounted = false;
    };
  }, [document?.latestVersion?.storage_path]);

  async function saveReview(status: "approved" | "rejected") {
    if (!document || !requirement) return;
    setSaving(true);
    setActionError(null);

    try {
      const { user, organization } = await getCurrentWorkspace();
      if (!user || !organization) throw new Error("Sign in again before reviewing documents.");
      const reviewedAt = new Date().toISOString();

      const documentUpdate = await supabase
        .from("documents")
        .update({
          document_type: fields.documentType.trim() || document.document_type,
          status,
          business_name: fields.businessName.trim() || null,
          policy_number: fields.policyNumber.trim() || null,
          issuing_authority: fields.carrier.trim() || null,
          issued_at: normalizeDate(fields.effectiveDate),
          expires_at: normalizeDate(fields.expirationDate),
          ai_extraction_confirmed_at: status === "approved" ? reviewedAt : null,
          ai_extraction_confirmed_by: status === "approved" ? user.id : null,
          ai_extraction_corrected_fields: fields,
          updated_at: reviewedAt
        })
        .eq("id", document.id);

      if (documentUpdate.error) throw new Error(documentUpdate.error.message);

      const requirementUpdate = await supabase
        .from("vendor_requirements")
        .update({
          status: status === "approved" ? "compliant" : "missing",
          expires_at: status === "approved" ? normalizeDate(fields.expirationDate) : requirement.expires_at,
          updated_at: reviewedAt
        })
        .eq("id", requirement.id);

      if (requirementUpdate.error) throw new Error(requirementUpdate.error.message);

      const reviewInsert = await supabase.from("document_reviews").insert({
        organization_id: organization.id,
        document_id: document.id,
        document_version_id: document.latestVersion?.id ?? null,
        reviewer_id: user.id,
        status,
        notes: status === "approved" ? "Approved from VendorProof Mobile." : "Resubmission requested from VendorProof Mobile.",
        reviewed_at: reviewedAt
      });

      if (reviewInsert.error) throw new Error(reviewInsert.error.message);

      await reload(true);
    } catch (reviewError) {
      setActionError(toFriendlyNetworkError(reviewError, "Could not save review."));
    } finally {
      setSaving(false);
    }
  }

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
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <>
              <MaterialCommunityIcons name="file-document-outline" size={42} color={colors.accent} />
              <Text variant="title">Document Preview</Text>
              <Text variant="muted">{document?.latestVersion?.file_name ?? "No document file loaded"}</Text>
            </>
          )}
        </Card>

        {document ? (
          <Card>
          <View style={styles.cardHeader}>
            <View>
              <Text variant="title">AI Extracted Data</Text>
              <Text variant="muted">AI-extracted, please confirm</Text>
            </View>
            <StatusBadge status={document.status === "approved" ? "compliant" : "under_review"} />
          </View>
          <FieldInput label="Document Type" value={fields.documentType} onChangeText={(documentType) => setFields((current) => ({ ...current, documentType }))} />
          <FieldInput label="Insured / Business Name" value={fields.businessName} onChangeText={(businessName) => setFields((current) => ({ ...current, businessName }))} />
          <FieldInput label="Policy / License Number" value={fields.policyNumber} onChangeText={(policyNumber) => setFields((current) => ({ ...current, policyNumber }))} />
          <FieldInput label="Effective Date" value={fields.effectiveDate} onChangeText={(effectiveDate) => setFields((current) => ({ ...current, effectiveDate }))} />
          <FieldInput label="Expiration Date" value={fields.expirationDate} onChangeText={(expirationDate) => setFields((current) => ({ ...current, expirationDate }))} />
          <FieldInput label="Carrier / Authority" value={fields.carrier} onChangeText={(carrier) => setFields((current) => ({ ...current, carrier }))} />
          {document.ai_extraction_error ? <Text className="text-expiring">AI extraction note: {document.ai_extraction_error}</Text> : null}
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
          {actionError ? (
            <View style={styles.errorBox}>
              <Text className="text-missing">{actionError}</Text>
            </View>
          ) : null}
          <Button disabled={saving} onPress={() => saveReview("approved")}>
            {saving ? "Saving..." : "Approve Document"}
          </Button>
          <Button disabled={saving} variant="danger" onPress={() => saveReview("rejected")}>
            Request Resubmission
          </Button>
          </View>
        ) : null}
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>
    </Screen>
  );
}

function FieldInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.fieldBox}>
      <Text variant="label">{label}</Text>
      <TextInput
        placeholder="Not captured"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
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
  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: 8
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
  input: {
    minHeight: 40,
    color: colors.foreground,
    fontSize: 16,
    padding: 0
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
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(253, 164, 175, 0.3)",
    backgroundColor: "rgba(253, 164, 175, 0.08)",
    padding: 12
  }
});
