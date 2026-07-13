import { extractDocumentFieldsFromImage, type ExtractionResult } from "@/lib/ai/extraction";
import { getCurrentWorkspace } from "@/lib/compliance/data";
import { fetchWithTimeout, toFriendlyNetworkError } from "@/lib/network";
import { supabase } from "@/lib/supabase/client";
import type { VendorRequirementRecord } from "@/types/compliance";

export const DOCUMENT_STORAGE_BUCKET = "documents";

export type UploadStep = "preparing" | "uploading" | "creating_record" | "extracting" | "saving_extraction" | "success";

export type CapturedDocumentUpload = {
  imageUri: string;
  imageBase64: string | null;
  documentType: string;
  requirement: VendorRequirementRecord;
  onStep?: (step: UploadStep) => void;
};

export type UploadResult = {
  documentId: string;
  extraction: ExtractionResult | null;
  extractionError: string | null;
};

export async function uploadCapturedDocument({
  imageUri,
  imageBase64,
  documentType,
  requirement,
  onStep
}: CapturedDocumentUpload): Promise<UploadResult> {
  onStep?.("preparing");
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.user) throw new Error("Sign in again before uploading documents.");

  const { organization } = await getCurrentWorkspace();
  if (!organization?.id) throw new Error("Your account is not connected to an organization.");

  const imageBytes = imageBase64 ? base64ToArrayBuffer(imageBase64) : await fetchImageBytes(imageUri);
  const documentId = createUuid();
  const timestamp = new Date().toISOString();
  const extension = inferImageExtension(imageUri);
  const storagePath = `${organization.id}/${requirement.vendor_id}/${documentId}/${Date.now()}.${extension}`;
  const fileName = `vendorproof-${documentType.toLowerCase()}-${Date.now()}.${extension}`;
  const mimeType = extension === "png" ? "image/png" : "image/jpeg";

  onStep?.("uploading");
  const uploadResult = await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).upload(storagePath, imageBytes, {
    contentType: mimeType,
    upsert: false
  });

  if (uploadResult.error) {
    throw new Error(`Upload failed: ${uploadResult.error.message}`);
  }

  onStep?.("creating_record");
  const documentInsert = await supabase
    .from("documents")
    .insert({
      id: documentId,
      organization_id: organization.id,
      vendor_id: requirement.vendor_id,
      property_id: requirement.property_id,
      vendor_requirement_id: requirement.id,
      document_type: documentType,
      status: "pending_review",
      ai_extraction_status: imageBase64 ? "processing" : "failed",
      ai_extraction_error: imageBase64 ? null : "No image data was available for AI extraction.",
      created_at: timestamp,
      updated_at: timestamp
    })
    .select("id")
    .single();

  if (documentInsert.error) {
    throw new Error(`Document record failed: ${documentInsert.error.message}`);
  }

  const versionInsert = await supabase.from("document_versions").insert({
    organization_id: organization.id,
    document_id: documentId,
    version_number: 1,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: imageBytes.byteLength,
    uploaded_by: session.user.id,
    created_at: timestamp
  });

  if (versionInsert.error) {
    throw new Error(`Document version failed: ${versionInsert.error.message}`);
  }

  if (!imageBase64) {
    onStep?.("success");
    return { documentId, extraction: null, extractionError: "No image data was available for AI extraction." };
  }

  onStep?.("extracting");
  try {
    const extraction = await extractDocumentFieldsFromImage(imageBase64, undefined, session.access_token);
    onStep?.("saving_extraction");
    const extractionUpdate = await supabase
      .from("documents")
      .update({
        ai_extraction_status: "completed",
        ai_extraction_model: "openai/gpt-4.1-mini",
        ai_extraction_raw: extraction,
        ai_extraction_confidence: extraction.confidence,
        ai_extraction_flags: extraction.flags,
        ai_extraction_error: null,
        ai_extraction_completed_at: new Date().toISOString(),
        ai_extracted_document_type: extraction.documentType,
        ai_extracted_business_name: extraction.businessName,
        ai_extracted_policy_number: extraction.policyOrLicenseNumber,
        ai_extracted_effective_date: extraction.effectiveDate,
        ai_extracted_expiration_date: extraction.expirationDate,
        ai_extracted_issuing_authority: extraction.issuingCarrierOrAuthority,
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId);

    if (extractionUpdate.error) {
      throw new Error(extractionUpdate.error.message);
    }

    onStep?.("success");
    return { documentId, extraction, extractionError: null };
  } catch (error) {
    const message = toFriendlyNetworkError(error, "AI extraction failed.");
    await supabase
      .from("documents")
      .update({
        ai_extraction_status: "failed",
        ai_extraction_error: message,
        ai_extraction_flags: ["ai_extraction_failed", "needs_manual_review"],
        updated_at: new Date().toISOString()
      })
      .eq("id", documentId);
    onStep?.("success");
    return { documentId, extraction: null, extractionError: message };
  }
}

export async function createDocumentSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

async function fetchImageBytes(uri: string) {
  const response = await fetchWithTimeout(uri);
  if (!response.ok) throw new Error("Could not read the captured image.");
  return response.arrayBuffer();
}

function inferImageExtension(uri: string) {
  if (/\.png(?:\?|$)/i.test(uri)) return "png";
  return "jpg";
}

function base64ToArrayBuffer(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
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
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}
