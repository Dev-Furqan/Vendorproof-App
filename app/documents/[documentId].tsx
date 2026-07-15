import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Text } from "@/components/ui/Text";
import { buildCorrectionRows, getStoredExtraction } from "@/lib/ai/corrections";
import { getCurrentWorkspace, useComplianceData } from "@/lib/compliance/data";
import { createDocumentSignedUrl, updateDocumentCompat } from "@/lib/documents/mobile-documents";
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
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [fields, setFields] = useState({
    documentType: "",
    businessName: "",
    policyNumber: "",
    effectiveDate: "",
    expirationDate: "",
    carrier: ""
  });
  const extraction = useMemo(() => getStoredExtraction(document), [document]);

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
    setActionNotice(null);

    try {
      const { user, organization } = await getCurrentWorkspace();
      if (!user || !organization) throw new Error("Sign in again before reviewing documents.");
      const reviewedAt = new Date().toISOString();
      const corrections = buildCorrectionRows({
        document,
        fields,
        organizationId: organization.id,
        reviewerId: user.id
      });
      let correctionWarning: string | null = null;

      if (corrections.length) {
        const correctionInsert = await supabase.from("document_ai_corrections").insert(corrections);
        if (correctionInsert.error) {
          if (isMissingCorrectionsTable(correctionInsert.error)) {
            correctionWarning = "Correction details could not be added to the report until the AI quality migration is applied.";
          } else {
            throw new Error(`Correction logging failed: ${correctionInsert.error.message}`);
          }
        }
      }

      await updateDocumentCompat(document.id, {
        document_type: fields.documentType.trim() || document.document_type,
        status,
        business_name: fields.businessName.trim() || null,
        policy_number: fields.policyNumber.trim() || null,
        issuing_authority: fields.carrier.trim() || null,
        issued_at: normalizeDate(fields.effectiveDate),
        expires_at: normalizeDate(fields.expirationDate),
        ai_extraction_confirmed_at: status === "approved" ? reviewedAt : null,
        ai_extraction_confirmed_by: status === "approved" ? user.id : null,
        ai_extraction_corrected_fields: { fields, corrections },
        updated_at: reviewedAt
      });

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
      setActionNotice(
        `${status === "approved" ? "Document approved" : "Resubmission requested"}.${correctionWarning ? ` ${correctionWarning}` : corrections.length ? ` Logged ${corrections.length} AI correction${corrections.length === 1 ? "" : "s"}.` : " No AI fields were changed."}`
      );
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
          {extraction ? (
            <Text variant="muted">
              {extraction.model ?? "AI model"} - {Math.round((extraction.confidence ?? 0) * 100)}% aggregate confidence
            </Text>
          ) : null}
          {extraction?.validationWarnings.length ? (
            <View style={styles.warningBox}>
              <Text variant="title">Manual review required</Text>
              {extraction.validationWarnings.map((warning) => (
                <Text key={warning} className="text-expiring">{formatWarning(warning)}</Text>
              ))}
            </View>
          ) : null}
          <FieldInput label="Document Type" confidence={extraction?.documentTypeConfidence} value={fields.documentType} onChangeText={(documentType) => setFields((current) => ({ ...current, documentType }))} />
          <FieldInput label="Insured / Business Name" confidence={extraction?.fieldConfidence.businessName} value={fields.businessName} onChangeText={(businessName) => setFields((current) => ({ ...current, businessName }))} />
          <FieldInput label="Policy / License Number" confidence={extraction?.fieldConfidence.policyOrLicenseNumber} value={fields.policyNumber} onChangeText={(policyNumber) => setFields((current) => ({ ...current, policyNumber }))} />
          <FieldInput label="Effective Date" confidence={extraction?.fieldConfidence.effectiveDate} value={fields.effectiveDate} onChangeText={(effectiveDate) => setFields((current) => ({ ...current, effectiveDate }))} />
          <FieldInput label="Expiration Date" confidence={extraction?.fieldConfidence.expirationDate} value={fields.expirationDate} onChangeText={(expirationDate) => setFields((current) => ({ ...current, expirationDate }))} />
          <FieldInput label="Carrier / Authority" confidence={extraction?.fieldConfidence.issuingCarrierOrAuthority} value={fields.carrier} onChangeText={(carrier) => setFields((current) => ({ ...current, carrier }))} />
          {document.ai_extraction_error ? <Text className="text-expiring">AI extraction note: {document.ai_extraction_error}</Text> : null}
          </Card>
        ) : null}

        {extraction?.coverageLines.length ? (
          <Card>
            <Text variant="title">COI Coverage Lines</Text>
            <Text variant="muted">The primary expiration above must be the earliest date shown here.</Text>
            {extraction.coverageLines.map((line, index) => (
              <View key={`${line.coverageType ?? "coverage"}-${index}`} style={styles.coverageRow}>
                <View style={styles.cardHeader}>
                  <Text variant="title">{line.coverageType ?? "Unlabeled coverage"}</Text>
                  <Text variant="muted">{line.confidence} confidence</Text>
                </View>
                <Text variant="muted">Policy: {line.policyNumber ?? "Not captured"}</Text>
                <Text variant="muted">Effective: {line.effectiveDate ?? "Not captured"} | Expires: {line.expirationDate ?? "Not captured"}</Text>
                <Text variant="muted">Carrier: {line.carrier ?? "Not captured"}</Text>
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
          {actionError ? (
            <View style={styles.errorBox}>
              <Text className="text-missing">{actionError}</Text>
            </View>
          ) : null}
          {actionNotice ? (
            <View style={styles.noticeBox}>
              <Text>{actionNotice}</Text>
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

function FieldInput({ label, confidence, value, onChangeText }: { label: string; confidence?: "high" | "medium" | "low"; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.fieldBox}>
      <View style={styles.fieldLabelRow}>
        <Text variant="label">{label}</Text>
        {confidence ? <Text variant="muted">{confidence} confidence</Text> : null}
      </View>
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

function isMissingCorrectionsTable(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || /document_ai_corrections|schema cache|does not exist/i.test(error.message ?? "");
}

function formatWarning(warning: string) {
  return warning.replace(/[_:]/g, " ").replace(/\s+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
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
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
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
  },
  warningBox: {
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    padding: 12
  },
  coverageRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12
  },
  noticeBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 242, 210, 0.28)",
    backgroundColor: "rgba(34, 242, 210, 0.08)",
    padding: 12
  }
});
