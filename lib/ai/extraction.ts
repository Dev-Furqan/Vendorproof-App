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

export async function extractDocumentFieldsFromImage(imageBase64: string, model = "openai/gpt-4.1-mini") {
  const apiKey = process.env.OPENROUTER_API_KEY;

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
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter extraction failed: ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "{}";
  return extractionResultSchema.parse(JSON.parse(content));
}
