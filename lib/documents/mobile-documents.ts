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
  const processed = await preprocessDocument(source);
  const fileBytes = processed.base64 ? base64ToArrayBuffer(processed.base64) : await fetchFileBytes(processed.uri);
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
  if (uploadResult.error) throw new Error(`Upload failed: ${uploadResult.error.message}`);

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
    await updateDocumentCompat(documentId, {
      ai_extraction_status: "completed",
      ai_extraction_model: extraction.model,
      ai_extraction_raw: extraction,
      ai_extraction_confidence: extraction.confidence,
      ai_extraction_flags: [...new Set([...extraction.flags, ...extraction.validationWarnings])],
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
