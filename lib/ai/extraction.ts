import { z } from "zod";

import type { PreprocessingMetadata } from "@/lib/documents/preprocess";
import { fetchWithTimeout, toFriendlyNetworkError } from "@/lib/network";

export const DEFAULT_EXTRACTION_MODEL =
  process.env.EXPO_PUBLIC_OPENROUTER_MODEL ?? process.env.OPENROUTER_MODEL ?? "google/gemini-3.5-flash";

const confidenceLevelSchema = z.enum(["high", "medium", "low"]);
const documentTypeSchema = z.enum(["coi", "license", "w9", "unknown"]);

const fieldConfidenceSchema = z.object({
  businessName: confidenceLevelSchema,
  policyOrLicenseNumber: confidenceLevelSchema,
  effectiveDate: confidenceLevelSchema,
  expirationDate: confidenceLevelSchema,
  issuingCarrierOrAuthority: confidenceLevelSchema
});

export const coverageLineSchema = z.object({
  coverageType: z.string().nullable(),
  policyNumber: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  carrier: z.string().nullable(),
  confidence: confidenceLevelSchema
});

export const extractionResultSchema = z.object({
  documentType: documentTypeSchema,
  documentTypeConfidence: confidenceLevelSchema,
  businessName: z.string().nullable(),
  policyOrLicenseNumber: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  issuingCarrierOrAuthority: z.string().nullable(),
  fieldConfidence: fieldConfidenceSchema,
  coverageLines: z.array(coverageLineSchema),
  confidence: z.number().min(0).max(1).nullable(),
  flags: z.array(z.string()),
  validationWarnings: z.array(z.string()),
  reviewStatus: z.enum(["ready_for_review", "needs_manual_review"]),
  selectedDocumentType: z.string().nullable(),
  model: z.string().nullable(),
  usage: z.unknown().nullable(),
  preprocessing: z.unknown().nullable()
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export type ExtractionInput = {
  fileBase64: string;
  mimeType: string;
  fileName: string;
  selectedDocumentType: string;
  preprocessing?: PreprocessingMetadata | null;
};

type ExtractOptions = {
  accessToken?: string;
  model?: string;
};

const MODEL_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: "string", enum: ["coi", "license", "w9", "unknown"] },
    documentTypeConfidence: { type: "string", enum: ["high", "medium", "low"] },
    businessName: { type: ["string", "null"] },
    policyOrLicenseNumber: { type: ["string", "null"] },
    effectiveDate: { type: ["string", "null"] },
    expirationDate: { type: ["string", "null"] },
    issuingCarrierOrAuthority: { type: ["string", "null"] },
    fieldConfidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        businessName: { type: "string", enum: ["high", "medium", "low"] },
        policyOrLicenseNumber: { type: "string", enum: ["high", "medium", "low"] },
        effectiveDate: { type: "string", enum: ["high", "medium", "low"] },
        expirationDate: { type: "string", enum: ["high", "medium", "low"] },
        issuingCarrierOrAuthority: { type: "string", enum: ["high", "medium", "low"] }
      },
      required: ["businessName", "policyOrLicenseNumber", "effectiveDate", "expirationDate", "issuingCarrierOrAuthority"]
    },
    coverageLines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          coverageType: { type: ["string", "null"] },
          policyNumber: { type: ["string", "null"] },
          effectiveDate: { type: ["string", "null"] },
          expirationDate: { type: ["string", "null"] },
          carrier: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["coverageType", "policyNumber", "effectiveDate", "expirationDate", "carrier", "confidence"]
      }
    },
    flags: { type: "array", items: { type: "string" } }
  },
  required: [
    "documentType",
    "documentTypeConfidence",
    "businessName",
    "policyOrLicenseNumber",
    "effectiveDate",
    "expirationDate",
    "issuingCarrierOrAuthority",
    "fieldConfidence",
    "coverageLines",
    "flags"
  ]
} as const;

export const EXTRACTION_SYSTEM_PROMPT = `You extract structured data from vendor compliance documents. Read only visible document text. Never invent, infer, or complete a plausible value. If a field is absent or not reasonably legible, return null and confidence "low".

Return exactly the supplied JSON schema. Dates must be ISO 8601 calendar dates in YYYY-MM-DD. Convert printed dates such as 06/01/2026 to 2026-06-01. Never swap effective and expiration dates: effective means coverage/license begins; expiration means it ends.

Document rules:
- coi: Certificate of Insurance or ACORD certificate. businessName is the named insured, not the certificate holder, producer, or property manager. Extract every visible policy/coverage row into coverageLines. Set expirationDate to the EARLIEST valid expiration date across all coverageLines. Set effectiveDate and policyOrLicenseNumber from the primary commercial general liability row when present, otherwise the clearest main coverage row. Do not collapse different policy dates into one invented range.
- license: Government or trade/business license. businessName is the licensed entity; policyOrLicenseNumber is the license/registration number; issuingCarrierOrAuthority is the issuing government agency. Dates are the license issue/effective and expiration dates.
- w9: IRS Form W-9. businessName is line 1 (name as shown on income tax return); if line 1 is blank, use line 2. Do not extract or return a Social Security Number or EIN. Policy, dates, carrier, and coverageLines must be null/empty.
- unknown: use only when the document is not one of the three types or the page is unreadable.

Confidence rules:
- high: clearly printed and unambiguous.
- medium: likely correct but affected by layout, blur, or multiple candidates.
- low: missing, illegible, or too uncertain; the corresponding value should normally be null.

Example 1 - COI layout: ACORD certificate. NAMED INSURED is "Apex Fire Protection LLC". Commercial General Liability row shows policy GL-204881, effective 01/01/2026, expiration 01/01/2027, carrier Hartford. Automobile row shows BA-88310, effective 06/01/2025, expiration 06/01/2026, carrier Travelers.
Correct JSON:
{"documentType":"coi","documentTypeConfidence":"high","businessName":"Apex Fire Protection LLC","policyOrLicenseNumber":"GL-204881","effectiveDate":"2026-01-01","expirationDate":"2026-06-01","issuingCarrierOrAuthority":"Hartford","fieldConfidence":{"businessName":"high","policyOrLicenseNumber":"high","effectiveDate":"high","expirationDate":"high","issuingCarrierOrAuthority":"high"},"coverageLines":[{"coverageType":"Commercial General Liability","policyNumber":"GL-204881","effectiveDate":"2026-01-01","expirationDate":"2027-01-01","carrier":"Hartford","confidence":"high"},{"coverageType":"Automobile Liability","policyNumber":"BA-88310","effectiveDate":"2025-06-01","expirationDate":"2026-06-01","carrier":"Travelers","confidence":"high"}],"flags":[]}

Example 2 - license layout: Texas state trade license headed "Air Conditioning and Refrigeration Contractors". Licensee is "Apex Air & Mechanical LLC". License number TACLA012345C. Issued 03/18/2025. Expires 03/18/2026. Issuer is Texas Department of Licensing and Regulation.
Correct JSON:
{"documentType":"license","documentTypeConfidence":"high","businessName":"Apex Air & Mechanical LLC","policyOrLicenseNumber":"TACLA012345C","effectiveDate":"2025-03-18","expirationDate":"2026-03-18","issuingCarrierOrAuthority":"Texas Department of Licensing and Regulation","fieldConfidence":{"businessName":"high","policyOrLicenseNumber":"high","effectiveDate":"high","expirationDate":"high","issuingCarrierOrAuthority":"high"},"coverageLines":[],"flags":[]}

Example 3 - W-9 layout: IRS Form W-9. Line 1 reads "BrightSweep Janitorial LLC". Line 2 is blank. Federal tax classification marks Limited liability company. TIN boxes are present.
Correct JSON:
{"documentType":"w9","documentTypeConfidence":"high","businessName":"BrightSweep Janitorial LLC","policyOrLicenseNumber":null,"effectiveDate":null,"expirationDate":null,"issuingCarrierOrAuthority":null,"fieldConfidence":{"businessName":"high","policyOrLicenseNumber":"low","effectiveDate":"low","expirationDate":"low","issuingCarrierOrAuthority":"low"},"coverageLines":[],"flags":[]}`;

export async function extractDocumentFields(input: ExtractionInput, options: ExtractOptions = {}) {
  const model = options.model ?? DEFAULT_EXTRACTION_MODEL;
  const apiResult = await extractViaVendorProofApi(input, model, options.accessToken);
  if (apiResult) return apiResult;
  return extractDocumentFieldsDirect(input, model);
}

export async function extractDocumentFieldsFromImage(imageBase64: string, model?: string, accessToken?: string) {
  return extractDocumentFields(
    {
      fileBase64: imageBase64,
      mimeType: "image/jpeg",
      fileName: "vendor-document.jpg",
      selectedDocumentType: "unknown",
      preprocessing: null
    },
    { model, accessToken }
  );
}

export async function extractDocumentFieldsDirect(input: ExtractionInput, model = DEFAULT_EXTRACTION_MODEL) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return emptyExtraction(input, model, ["openrouter_api_key_missing"]);

  const isPdf = input.mimeType === "application/pdf";
  const content = isPdf
    ? {
        type: "file",
        file: {
          filename: input.fileName || "vendor-document.pdf",
          file_data: `data:application/pdf;base64,${input.fileBase64}`
        }
      }
    : {
        type: "image_url",
        image_url: { url: `data:${input.mimeType || "image/jpeg"};base64,${input.fileBase64}` }
      };
  const plugins: Record<string, unknown>[] = [{ id: "response-healing" }];
  if (isPdf) plugins.unshift({ id: "file-parser", pdf: { engine: "mistral-ocr" } });

  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vendorproof.app",
        "X-Title": "VendorProof Document Extraction"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `The user selected document type "${normalizeDocumentType(input.selectedDocumentType)}" before upload. Independently identify the visible document type. Do not force the selected type; return a different detected type when the page shows one. Extract the document now.`
              },
              content
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vendor_compliance_document",
            strict: true,
            schema: MODEL_RESPONSE_JSON_SCHEMA
          }
        },
        provider: { require_parameters: true },
        plugins,
        temperature: 0,
        max_tokens: 1600
      })
    },
    60000
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = getProviderError(payload);
    throw new Error(`OpenRouter extraction failed (${response.status})${providerMessage ? `: ${providerMessage}` : ""}`);
  }

  const rawContent = payload.choices?.[0]?.message?.content ?? "{}";
  const parsed = parseExtractionContent(typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent));
  return finalizeExtraction(parsed, input, payload.model ?? model, payload.usage ?? null);
}

async function extractViaVendorProofApi(input: ExtractionInput, model: string, accessToken?: string) {
  const apiUrl = process.env.EXPO_PUBLIC_VENDORPROOF_API_URL?.replace(/\/$/, "");
  if (!apiUrl || !accessToken) return null;

  try {
    const response = await fetchWithTimeout(
      `${apiUrl}/api/mobile/extract-document`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ ...input, model })
      },
      65000
    );

    if (response.status === 404) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : `Document extraction failed (${response.status}).`);
    }
    return finalizeExtraction(normalizeExtraction(payload), input, payload.model ?? model, payload.usage ?? null);
  } catch (error) {
    if (error instanceof TypeError) return null;
    if (error instanceof Error && /abort|timeout|network|fetch/i.test(error.message)) {
      throw new Error(toFriendlyNetworkError(error, "AI extraction is temporarily unavailable."));
    }
    throw error;
  }
}

export function parseExtractionContent(content: string) {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const direct = safeJsonParse(stripped);
  if (direct) return normalizeExtraction(direct);
  const objectMatch = stripped.match(/\{[\s\S]*\}/);
  const matched = objectMatch ? safeJsonParse(objectMatch[0]) : null;
  return matched ? normalizeExtraction(matched) : emptyModelExtraction(["malformed_ai_json"]);
}

export function validateExtraction(result: ReturnType<typeof normalizeExtraction>, selectedDocumentType: string, now = new Date()) {
  const warnings = [...result.flags];
  const selected = normalizeDocumentType(selectedDocumentType);
  if (selected !== "unknown" && result.documentType !== "unknown" && selected !== result.documentType) {
    warnings.push(`document_type_mismatch:selected_${selected}:detected_${result.documentType}`);
  }

  const requiredFields: Record<string, Array<keyof typeof result>> = {
    coi: ["businessName", "effectiveDate", "expirationDate", "issuingCarrierOrAuthority"],
    license: ["businessName", "policyOrLicenseNumber", "expirationDate", "issuingCarrierOrAuthority"],
    w9: ["businessName"]
  };
  for (const field of requiredFields[selected === "unknown" ? result.documentType : selected] ?? []) {
    if (!result[field]) warnings.push(`missing_required_field:${String(field)}`);
  }

  const effective = parseIsoDate(result.effectiveDate);
  const expiration = parseIsoDate(result.expirationDate);
  if (result.effectiveDate && !effective) warnings.push("invalid_effective_date");
  if (result.expirationDate && !expiration) warnings.push("invalid_expiration_date");
  if (effective && expiration && expiration.getTime() < effective.getTime()) warnings.push("expiration_before_effective_date");
  if (expiration && expiration.getTime() < startOfDay(now).getTime()) warnings.push("expiration_date_in_past");
  const fiveYearsAhead = new Date(now);
  fiveYearsAhead.setFullYear(fiveYearsAhead.getFullYear() + 5);
  if (expiration && expiration.getTime() > fiveYearsAhead.getTime()) warnings.push("expiration_date_more_than_5_years_ahead");

  if (result.documentType === "coi") {
    const lineExpirations = result.coverageLines
      .map((line) => ({ value: line.expirationDate, date: parseIsoDate(line.expirationDate) }))
      .filter((line): line is { value: string; date: Date } => Boolean(line.value && line.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (lineExpirations[0] && result.expirationDate !== lineExpirations[0].value) {
      warnings.push("coi_primary_expiration_is_not_earliest_coverage_expiration");
    }
  }

  const confidenceEntries = Object.entries(result.fieldConfidence) as Array<[keyof typeof result.fieldConfidence, ConfidenceLevel]>;
  for (const [field, confidence] of confidenceEntries) {
    if (confidence === "low" && result[field]) warnings.push(`low_confidence_field:${field}`);
  }

  return [...new Set(warnings)];
}

function finalizeExtraction(
  normalized: ReturnType<typeof normalizeExtraction>,
  input: ExtractionInput,
  model: string,
  usage: unknown
): ExtractionResult {
  const qualityFlags: string[] = [];
  const outputWidth = input.preprocessing?.outputWidth ?? null;
  const outputHeight = input.preprocessing?.outputHeight ?? null;
  if (input.mimeType !== "application/pdf" && outputWidth && outputHeight && Math.max(outputWidth, outputHeight) < 1200) {
    qualityFlags.push("low_input_resolution");
  }
  const withQuality = { ...normalized, flags: [...new Set([...normalized.flags, ...qualityFlags])] };
  const validationWarnings = validateExtraction(withQuality, input.selectedDocumentType);
  return extractionResultSchema.parse({
    ...withQuality,
    confidence: calculateConfidence(withQuality),
    validationWarnings,
    reviewStatus: validationWarnings.length ? "needs_manual_review" : "ready_for_review",
    selectedDocumentType: normalizeDocumentType(input.selectedDocumentType),
    model,
    usage,
    preprocessing: input.preprocessing ?? null
  });
}

function normalizeExtraction(value: unknown) {
  const raw = isRecord(value) ? value : {};
  const rawConfidence = isRecord(raw.fieldConfidence) ? raw.fieldConfidence : isRecord(raw.field_confidence) ? raw.field_confidence : {};
  const coverageSource = Array.isArray(raw.coverageLines) ? raw.coverageLines : Array.isArray(raw.coverage_lines) ? raw.coverage_lines : [];
  return {
    documentType: normalizeDocumentType(raw.documentType ?? raw.document_type),
    documentTypeConfidence: normalizeConfidence(raw.documentTypeConfidence ?? raw.document_type_confidence),
    businessName: nullableText(raw.businessName ?? raw.business_name),
    policyOrLicenseNumber: nullableText(raw.policyOrLicenseNumber ?? raw.policy_or_license_number ?? raw.policyNumber),
    effectiveDate: nullableText(raw.effectiveDate ?? raw.effective_date),
    expirationDate: nullableText(raw.expirationDate ?? raw.expiration_date),
    issuingCarrierOrAuthority: nullableText(raw.issuingCarrierOrAuthority ?? raw.issuing_carrier_or_authority ?? raw.carrier),
    fieldConfidence: {
      businessName: normalizeConfidence(rawConfidence.businessName ?? rawConfidence.business_name),
      policyOrLicenseNumber: normalizeConfidence(rawConfidence.policyOrLicenseNumber ?? rawConfidence.policy_or_license_number),
      effectiveDate: normalizeConfidence(rawConfidence.effectiveDate ?? rawConfidence.effective_date),
      expirationDate: normalizeConfidence(rawConfidence.expirationDate ?? rawConfidence.expiration_date),
      issuingCarrierOrAuthority: normalizeConfidence(rawConfidence.issuingCarrierOrAuthority ?? rawConfidence.issuing_carrier_or_authority)
    },
    coverageLines: coverageSource.map(normalizeCoverageLine),
    flags: Array.isArray(raw.flags) ? raw.flags.filter((flag): flag is string => typeof flag === "string") : []
  };
}

function normalizeCoverageLine(value: unknown) {
  const raw = isRecord(value) ? value : {};
  return coverageLineSchema.parse({
    coverageType: nullableText(raw.coverageType ?? raw.coverage_type),
    policyNumber: nullableText(raw.policyNumber ?? raw.policy_number),
    effectiveDate: nullableText(raw.effectiveDate ?? raw.effective_date),
    expirationDate: nullableText(raw.expirationDate ?? raw.expiration_date),
    carrier: nullableText(raw.carrier),
    confidence: normalizeConfidence(raw.confidence)
  });
}

function emptyModelExtraction(flags: string[]) {
  return normalizeExtraction({ documentType: "unknown", flags });
}

function emptyExtraction(input: ExtractionInput, model: string, flags: string[]) {
  return finalizeExtraction(emptyModelExtraction(flags), input, model, null);
}

function calculateConfidence(result: ReturnType<typeof normalizeExtraction>) {
  const values: number[] = [confidenceNumber(result.documentTypeConfidence)];
  for (const [field, confidence] of Object.entries(result.fieldConfidence) as Array<[keyof typeof result.fieldConfidence, ConfidenceLevel]>) {
    if (result[field]) values.push(confidenceNumber(confidence));
  }
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
}

function confidenceNumber(value: ConfidenceLevel) {
  if (value === "high") return 0.95;
  if (value === "medium") return 0.65;
  return 0.25;
}

function normalizeConfidence(value: unknown): ConfidenceLevel {
  if (value === "high" || value === "medium" || value === "low") return value;
  if (typeof value === "number") return value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low";
  return "low";
}

export function normalizeDocumentType(value: unknown): "coi" | "license" | "w9" | "unknown" {
  const normalized = typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
  if (["coi", "certificateofinsurance", "insurancecertificate", "acord25"].includes(normalized)) return "coi";
  if (["license", "licence", "tradelicense", "businesslicense", "contractorlicense"].includes(normalized)) return "license";
  if (["w9", "irsw9", "formw9"].includes(normalized)) return "w9";
  return "unknown";
}

function nullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && !/^(null|unknown|n\/?a|not found)$/i.test(trimmed) ? trimmed : null;
}

function parseIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getProviderError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) return null;
  const metadata = isRecord(payload.error.metadata) ? payload.error.metadata : null;
  return nullableText(metadata?.raw) ?? nullableText(payload.error.message);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
