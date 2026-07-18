import { File } from "expo-file-system";

import { extractDocumentFields, type ExtractionResult } from "@/lib/ai/extraction";
import { getCurrentWorkspace } from "@/lib/compliance/data";
import { isMissingColumnError } from "@/lib/compliance/schema";
import { bytesToBase64, preprocessDocument, type DocumentSource } from "@/lib/documents/preprocess";
import { fetchWithTimeout, toFriendlyNetworkError } from "@/lib/network";
import { supabase } from "@/lib/supabase/client";
import type { VendorRequirementRecord } from "@/types/compliance";

export const DOCUMENT_STORAGE_BUCKET = "documents";

export type UploadStep = "preparing" | "preprocessing" | "uploading" | "creating_record" | "extracting" | "saving_extraction" | "success";

export type CapturedDocumentUpload = {
  source: DocumentSource;
  documentType: string;
  requirement: VendorRequirementRecord;
  onStep?: (step: UploadStep) => void;
};

export type UploadResult = {
  documentId: string;
  extraction: ExtractionResult | null;
  extractionError: string | null;
};

export async function createManualReviewDocument({
  documentType,
  requirement,
  reason = "Document capture or automated extraction was skipped."
}: {
  documentType: string;
  requirement: VendorRequirementRecord;
  reason?: string;
}) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.user) throw new Error("Sign in again before creating a manual review.");
  const { organization } = await getCurrentWorkspace();
  if (!organization?.id) throw new Error("Your account is not connected to an organization.");

  const documentId = createUuid();
  const timestamp = new Date().toISOString();
  await insertDocumentCompat({
    id: documentId,
    organization_id: organization.id,
    vendor_id: requirement.vendor_id,
    property_id: requirement.property_id,
    vendor_requirement_id: requirement.id,
    document_type: documentType,
    status: "pending_review",
    ai_extraction_status: "manual_entry",
    ai_extraction_error: reason,
    ai_extraction_flags: ["manual_entry", "needs_manual_review"],
    created_at: timestamp,
    updated_at: timestamp
  });
  return documentId;
}

export async function uploadCapturedDocument({ source, documentType, requirement, onStep }: CapturedDocumentUpload): Promise<UploadResult> {
  onStep?.("preparing");
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.user) throw new Error("Sign in again before uploading documents.");

  const { organization } = await getCurrentWorkspace();
  if (!organization?.id) throw new Error("Your account is not connected to an organization.");

  onStep?.("preprocessing");
  const processed = await runPipelineStage("Image preprocessing", () => preprocessDocument(source));
  const fileBytes = await runPipelineStage("Document reading", () =>
    processed.base64 ? Promise.resolve(base64ToArrayBuffer(processed.base64)) : fetchFileBytes(processed.uri)
  );
  const fileBase64 = processed.base64 ?? bytesToBase64(new Uint8Array(fileBytes));
  const documentId = createUuid();
  const timestamp = new Date().toISOString();
  const extension = extensionForMimeType(processed.mimeType);
  const storagePath = `${organization.id}/${requirement.vendor_id}/${documentId}/${Date.now()}.${extension}`;
  const fileName = `vendorproof-${documentType.toLowerCase()}-${Date.now()}.${extension}`;

  onStep?.("uploading");
  const uploadResult = await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).upload(storagePath, fileBytes, {
    contentType: processed.mimeType,
    upsert: false
  });
  if (uploadResult.error) throw new Error(`Storage upload failed: ${uploadResult.error.message}`);
  try {
    await verifyStoredUpload(storagePath, fileBytes.byteLength);
  } catch (error) {
    await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).remove([storagePath]).catch(() => undefined);
    throw error;
  }

  try {
    onStep?.("creating_record");
    await insertDocumentCompat({
      id: documentId,
      organization_id: organization.id,
      vendor_id: requirement.vendor_id,
      property_id: requirement.property_id,
      vendor_requirement_id: requirement.id,
      document_type: documentType,
      status: "pending_review",
      ai_extraction_status: "processing",
      ai_extraction_error: null,
      created_at: timestamp,
      updated_at: timestamp
    });

    const versionInsert = await supabase.from("document_versions").insert({
      organization_id: organization.id,
      document_id: documentId,
      version_number: 1,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: processed.mimeType,
      size_bytes: fileBytes.byteLength,
      uploaded_by: session.user.id,
      created_at: timestamp
    });
    if (versionInsert.error) throw new Error(`Document version failed: ${versionInsert.error.message}`);
  } catch (error) {
    await Promise.allSettled([
      supabase.storage.from(DOCUMENT_STORAGE_BUCKET).remove([storagePath]),
      supabase.from("documents").delete().eq("id", documentId)
    ]);
    throw error;
  }

  onStep?.("extracting");
  try {
    const extraction = await extractDocumentFields(
      {
        fileBase64,
        mimeType: processed.mimeType,
        fileName,
        selectedDocumentType: documentType,
        preprocessing: processed.preprocessing
      },
      { accessToken: session.access_token }
    );
    onStep?.("saving_extraction");
    await saveExtraction(documentId, extraction);
    onStep?.("success");
    return { documentId, extraction, extractionError: null };
  } catch (error) {
    const message = toFriendlyNetworkError(error, "AI extraction failed.");
    await updateDocumentCompat(documentId, {
      ai_extraction_status: "failed",
      ai_extraction_error: message,
      ai_extraction_flags: ["ai_extraction_failed", "needs_manual_review"],
      updated_at: new Date().toISOString()
    }).catch(() => undefined);
    onStep?.("success");
    return { documentId, extraction: null, extractionError: message };
  }
}

export async function retryCapturedDocumentExtraction({
  documentId,
  source,
  documentType,
  onStep
}: {
  documentId: string;
  source: DocumentSource;
  documentType: string;
  onStep?: (step: UploadStep) => void;
}): Promise<UploadResult> {
  onStep?.("preprocessing");
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.user) throw new Error("Sign in again before retrying extraction.");

  const processed = await runPipelineStage("Image preprocessing", () => preprocessDocument(source));
  const fileBytes = await runPipelineStage("Document reading", () =>
    processed.base64 ? Promise.resolve(base64ToArrayBuffer(processed.base64)) : fetchFileBytes(processed.uri)
  );
  const fileBase64 = processed.base64 ?? bytesToBase64(new Uint8Array(fileBytes));

  onStep?.("extracting");
  try {
    const extraction = await extractDocumentFields(
      {
        fileBase64,
        mimeType: processed.mimeType,
        fileName: processed.fileName,
        selectedDocumentType: documentType,
        preprocessing: processed.preprocessing
      },
      { accessToken: session.access_token }
    );
    onStep?.("saving_extraction");
    await saveExtraction(documentId, extraction);
    onStep?.("success");
    return { documentId, extraction, extractionError: null };
  } catch (error) {
    const message = toFriendlyNetworkError(error, "AI extraction failed.");
    await markExtractionFailed(documentId, message);
    onStep?.("success");
    return { documentId, extraction: null, extractionError: message };
  }
}

export async function createDocumentSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

async function insertDocumentCompat(row: Record<string, unknown>) {
  let payload = { ...row };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { error } = await supabase.from("documents").insert(payload);
    if (!error) return;
    const missingColumn = getMissingColumn(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      throw new Error(`Document record failed: ${error.message}`);
    }
    delete payload[missingColumn];
  }
  throw new Error("Document record failed after schema compatibility retries.");
}

export async function updateDocumentCompat(documentId: string, row: Record<string, unknown>) {
  let payload = { ...row };
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { error } = await supabase.from("documents").update(payload).eq("id", documentId);
    if (!error) return;
    const missingColumn = getMissingColumn(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(payload, missingColumn)) throw new Error(error.message);
    delete payload[missingColumn];
  }
  throw new Error("Document update failed after schema compatibility retries.");
}

async function saveExtraction(documentId: string, extraction: ExtractionResult) {
  const needsManualReview = extraction.reviewStatus === "needs_manual_review";
  await updateDocumentCompat(documentId, {
    ai_extraction_status: needsManualReview ? "needs_manual_review" : "completed",
    ai_extraction_model: extraction.model,
    ai_extraction_raw: extraction,
    ai_extraction_confidence: extraction.confidence,
    ai_extraction_flags: [
      ...new Set([
        ...extraction.flags,
        ...extraction.validationWarnings,
        ...(needsManualReview ? ["needs_manual_review"] : [])
      ])
    ],
    ai_extraction_usage: extraction.usage,
    ai_extraction_error: null,
    ai_extraction_completed_at: new Date().toISOString(),
    ai_extracted_document_type: extraction.documentType === "unknown" ? null : extraction.documentType,
    ai_extracted_business_name: extraction.businessName,
    ai_extracted_policy_number: extraction.policyOrLicenseNumber,
    ai_extracted_effective_date: extraction.effectiveDate,
    ai_extracted_expiration_date: extraction.expirationDate,
    ai_extracted_issuing_authority: extraction.issuingCarrierOrAuthority,
    updated_at: new Date().toISOString()
  });
}

async function markExtractionFailed(documentId: string, message: string) {
  await updateDocumentCompat(documentId, {
    ai_extraction_status: "failed",
    ai_extraction_error: message,
    ai_extraction_flags: ["ai_extraction_failed", "needs_manual_review"],
    updated_at: new Date().toISOString()
  }).catch(() => undefined);
}

async function verifyStoredUpload(storagePath: string, expectedBytes: number) {
  const slash = storagePath.lastIndexOf("/");
  const folder = storagePath.slice(0, slash);
  const fileName = storagePath.slice(slash + 1);
  const { data, error } = await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).list(folder, {
    limit: 10,
    search: fileName
  });
  if (error) throw new Error(`Storage verification failed: ${error.message}`);
  const stored = data?.find((entry) => entry.name === fileName);
  if (!stored) throw new Error("Storage verification failed: the uploaded file could not be read back.");
  const storedBytes = Number(stored.metadata?.size);
  if (Number.isFinite(storedBytes) && storedBytes !== expectedBytes) {
    throw new Error(`Storage verification failed: expected ${expectedBytes} bytes but storage reports ${storedBytes}.`);
  }
}

async function runPipelineStage<T>(stage: string, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    throw new Error(`${stage} failed: ${message}`);
  }
}

function getMissingColumn(error: { message?: string; code?: string }) {
  if (!isMissingColumnError(error)) return null;
  const message = error.message ?? "";
  return (
    message.match(/'([^']+)' column/i)?.[1] ??
    message.match(/column "([^"]+)"/i)?.[1] ??
    message.match(/column ([a-zA-Z0-9_]+) does not exist/i)?.[1] ??
    null
  );
}

async function fetchFileBytes(uri: string) {
  if (/^(file|content):/i.test(uri)) return new File(uri).arrayBuffer();
  const response = await fetchWithTimeout(uri);
  if (!response.ok) throw new Error("Could not read the selected document.");
  return response.arrayBuffer();
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

function base64ToArrayBuffer(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function createUuid() {
  const random = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (random) {
    const bytes = new Uint8Array(16);
    random(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes]
      .map((byte, index) => (index === 4 || index === 6 || index === 8 || index === 10 ? `-${byte.toString(16).padStart(2, "0")}` : byte.toString(16).padStart(2, "0")))
      .join("");
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = (Math.random() * 16) | 0;
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}
