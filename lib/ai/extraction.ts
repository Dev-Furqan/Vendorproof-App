import { z } from "zod";

export const extractionResultSchema = z.object({
  documentType: z.string().nullable(),
  businessName: z.string().nullable(),
  policyOrLicenseNumber: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  expirationDate: z.string().nullable(),
  issuingCarrierOrAuthority: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  flags: z.array(z.string()).default([])
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export async function extractDocumentFieldsFromImage(imageBase64: string, model = "openai/gpt-4.1-mini", accessToken?: string) {
  const apiResult = await extractViaVendorProofApi(imageBase64, model, accessToken);
  if (apiResult) return apiResult;

  const apiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return extractionResultSchema.parse({
      documentType: null,
      businessName: null,
      policyOrLicenseNumber: null,
      effectiveDate: null,
      expirationDate: null,
      issuingCarrierOrAuthority: null,
      confidence: null,
      flags: ["openrouter_api_key_missing", "needs_manual_review"]
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vendorproof.app",
      "X-Title": "VendorProof Mobile"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Extract vendor compliance document fields. Return strict JSON only with documentType, businessName, policyOrLicenseNumber, effectiveDate, expirationDate, issuingCarrierOrAuthority, confidence, and flags. Never approve a document."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract fields from this compliance document image. Mark uncertain values in flags." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter extraction failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  return parseExtractionContent(content);
}

async function extractViaVendorProofApi(imageBase64: string, model: string, accessToken?: string) {
  const apiUrl = process.env.EXPO_PUBLIC_VENDORPROOF_API_URL?.replace(/\/$/, "");
  if (!apiUrl || !accessToken) return null;

  try {
    const response = await fetch(`${apiUrl}/api/mobile/extract-document`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ imageBase64, model })
    });

    if (response.status === 404) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof payload.error === "string" ? payload.error : `OpenRouter extraction failed: ${response.status}`);
    }

    return extractionResultSchema.parse(payload);
  } catch (error) {
    if (error instanceof TypeError) return null;
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
  if (direct) return extractionResultSchema.parse(direct);

  const objectMatch = stripped.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const matched = safeJsonParse(objectMatch[0]);
    if (matched) return extractionResultSchema.parse(matched);
  }

  return extractionResultSchema.parse({
    documentType: null,
    businessName: null,
    policyOrLicenseNumber: null,
    effectiveDate: null,
    expirationDate: null,
    issuingCarrierOrAuthority: null,
    confidence: null,
    flags: ["malformed_ai_json", "needs_manual_review"]
  });
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
