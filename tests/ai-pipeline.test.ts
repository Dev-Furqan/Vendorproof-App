import assert from "node:assert/strict";
import test from "node:test";

import { buildCorrectionRows } from "@/lib/ai/corrections";
import { extractionResultSchema, parseExtractionContent, validateExtraction } from "@/lib/ai/extraction";
import { detectDocumentCrop } from "@/lib/documents/image-processing";
import type { DocumentRecord } from "@/types/compliance";

const completeCoi = {
  documentType: "coi",
  documentTypeConfidence: "high",
  businessName: "Apex Fire Protection LLC",
  policyOrLicenseNumber: "GL-204881",
  effectiveDate: "2026-01-01",
  expirationDate: "2026-06-01",
  issuingCarrierOrAuthority: "Hartford",
  fieldConfidence: {
    businessName: "high",
    policyOrLicenseNumber: "high",
    effectiveDate: "high",
    expirationDate: "high",
    issuingCarrierOrAuthority: "high"
  },
  coverageLines: [
    {
      coverageType: "Commercial General Liability",
      policyNumber: "GL-204881",
      effectiveDate: "2026-01-01",
      expirationDate: "2027-01-01",
      carrier: "Hartford",
      confidence: "high"
    },
    {
      coverageType: "Automobile Liability",
      policyNumber: "BA-88310",
      effectiveDate: "2025-06-01",
      expirationDate: "2026-06-01",
      carrier: "Travelers",
      confidence: "high"
    }
  ],
  flags: []
} as const;

test("parses fenced JSON into the normalized extraction shape", () => {
  const result = parseExtractionContent(`\n\`\`\`json\n${JSON.stringify(completeCoi)}\n\`\`\``);
  assert.equal(result.documentType, "coi");
  assert.equal(result.coverageLines.length, 2);
  assert.equal(result.expirationDate, "2026-06-01");
});

test("parses JSON surrounded by provider prose without swallowing later braces", () => {
  const result = parseExtractionContent(`Extraction follows:\n${JSON.stringify(completeCoi)}\nConfidence notes: {not JSON}`);
  assert.equal(result.documentType, "coi");
  assert.equal(result.businessName, "Apex Fire Protection LLC");
});

test("malformed model output becomes a manual-review result instead of throwing", () => {
  const result = parseExtractionContent("I could not read this page");
  assert.equal(result.documentType, "unknown");
  assert.deepEqual(result.flags, ["malformed_ai_json"]);
});

test("schema-invalid model JSON is rejected before any field is trusted", () => {
  const result = parseExtractionContent(JSON.stringify({ documentType: "coi", businessName: "Plausible but incomplete" }));
  assert.equal(result.documentType, "unknown");
  assert.deepEqual(result.flags, ["invalid_ai_schema"]);
});

test("validation catches impossible, stale, distant, missing, and mismatched values", () => {
  const impossible = parseExtractionContent(
    JSON.stringify({
      ...completeCoi,
      documentType: "license",
      businessName: null,
      effectiveDate: "2033-01-01",
      expirationDate: "2032-08-01",
      coverageLines: []
    })
  );
  const warnings = validateExtraction(impossible, "coi", new Date("2026-07-15T00:00:00Z"));
  assert(warnings.some((warning) => warning.startsWith("document_type_mismatch")));
  assert(warnings.includes("missing_required_field:businessName"));
  assert(warnings.includes("expiration_before_effective_date"));
  assert(warnings.includes("expiration_date_more_than_5_years_ahead"));

  const expired = parseExtractionContent(JSON.stringify({ ...completeCoi, expirationDate: "2026-01-01", coverageLines: [] }));
  assert(validateExtraction(expired, "coi", new Date("2026-07-15T00:00:00Z")).includes("expiration_date_in_past"));
});

test("COI validation requires the earliest coverage expiration as the primary date", () => {
  const result = parseExtractionContent(JSON.stringify({ ...completeCoi, expirationDate: "2027-01-01" }));
  assert(
    validateExtraction(result, "coi", new Date("2025-01-01T00:00:00Z")).includes(
      "coi_primary_expiration_is_not_earliest_coverage_expiration"
    )
  );
});

test("correction rows preserve the original AI value and human replacement", () => {
  const extraction = extractionResultSchema.parse({
    ...completeCoi,
    confidence: 0.95,
    validationWarnings: [],
    reviewStatus: "ready_for_review",
    selectedDocumentType: "coi",
    model: "test-model",
    usage: null,
    preprocessing: { outputWidth: 2000, outputHeight: 1500 }
  });
  const document = {
    id: "document-id",
    document_type: "coi",
    ai_extraction_raw: extraction,
    latestVersion: { id: "version-id" }
  } as DocumentRecord;
  const rows = buildCorrectionRows({
    document,
    organizationId: "organization-id",
    reviewerId: "reviewer-id",
    fields: {
      documentType: "coi",
      businessName: "Apex Fire Protection, LLC",
      policyNumber: "GL-204881",
      effectiveDate: "2026-01-01",
      expirationDate: "2026-06-01",
      carrier: "The Hartford"
    }
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => [row.field_name, row.ai_value, row.corrected_value]),
    [
      ["business_name", "Apex Fire Protection LLC", "Apex Fire Protection, LLC"],
      ["issuing_carrier_or_authority", "Hartford", "The Hartford"]
    ]
  );
});

test("edge detector finds a document rectangle against excess background", () => {
  const width = 800;
  const height = 600;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = x >= 100 && x < 700 && y >= 60 && y < 540;
      const shade = inside ? 238 : 32;
      const index = (y * width + x) * 4;
      data[index] = shade;
      data[index + 1] = shade;
      data[index + 2] = shade;
      data[index + 3] = 255;
    }
  }
  const crop = detectDocumentCrop(data, width, height);
  assert(crop);
  assert(Math.abs(crop.x - 100) < 25);
  assert(Math.abs(crop.y - 60) < 25);
  assert(Math.abs(crop.width - 600) < 50);
  assert(Math.abs(crop.height - 480) < 50);
});
