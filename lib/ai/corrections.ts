import { extractionResultSchema } from "@/lib/ai/extraction";
import type { DocumentRecord } from "@/types/compliance";

export type ReviewFields = {
  documentType: string;
  businessName: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  carrier: string;
};

export function getStoredExtraction(document: DocumentRecord | null) {
  if (!document?.ai_extraction_raw) return null;
  const parsed = extractionResultSchema.safeParse(document.ai_extraction_raw);
  return parsed.success ? parsed.data : null;
}

export function buildCorrectionRows({
  document,
  fields,
  organizationId,
  reviewerId
}: {
  document: DocumentRecord;
  fields: ReviewFields;
  organizationId: string;
  reviewerId: string;
}) {
  const extraction = getStoredExtraction(document);
  if (!extraction) return [];

  const candidates = [
    ["document_type", extraction.documentType === "unknown" ? null : extraction.documentType, fields.documentType],
    ["business_name", extraction.businessName, fields.businessName],
    ["policy_or_license_number", extraction.policyOrLicenseNumber, fields.policyNumber],
    ["effective_date", extraction.effectiveDate, fields.effectiveDate],
    ["expiration_date", extraction.expirationDate, fields.expirationDate],
    ["issuing_carrier_or_authority", extraction.issuingCarrierOrAuthority, fields.carrier]
  ] as const;

  return candidates
    .map(([fieldName, aiValue, correctedValue]) => ({
      fieldName,
      aiValue: normalizeValue(aiValue),
      correctedValue: normalizeValue(correctedValue)
    }))
    .filter((candidate) => candidate.aiValue !== candidate.correctedValue)
    .map((candidate) => ({
      organization_id: organizationId,
      document_id: document.id,
      document_version_id: document.latestVersion?.id ?? null,
      reviewer_id: reviewerId,
      document_type: normalizeValue(fields.documentType) ?? document.document_type,
      selected_document_type: extraction.selectedDocumentType,
      detected_document_type: extraction.documentType === "unknown" ? null : extraction.documentType,
      field_name: candidate.fieldName,
      ai_value: candidate.aiValue,
      corrected_value: candidate.correctedValue,
      model: extraction.model,
      image_quality: extraction.preprocessing
    }));
}

function normalizeValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}
