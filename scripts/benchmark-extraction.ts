import { existsSync, readFileSync } from "node:fs";

import sharp from "sharp";

loadEnvFile();

type ExpectedValue = string | null | string[];
type BenchmarkFixture = {
  id: string;
  url: string;
  selectedDocumentType: string;
  expected: Record<string, ExpectedValue>;
};

const fixtures: BenchmarkFixture[] = [
  {
    id: "coi_completed",
    url: "https://stinstafill.blob.core.windows.net/static/examples/acord-25-201603-certificate-of-liability-insurance-acord-25-construction-contractor-p1.png",
    selectedDocumentType: "coi",
    expected: {
      documentType: "coi",
      businessName: "Summit Construction Inc.",
      policyOrLicenseNumber: "CGL-987654321",
      effectiveDate: "2026-01-01",
      expirationDate: "2027-01-01",
      issuingCarrierOrAuthority: ["Apex National Insurance Co.", "Apex National Insurance Co"]
    }
  },
  {
    id: "license_real_card",
    url: "https://images.squarespace-cdn.com/content/v1/629034956b1b2a69fc8c3fff/1666319442015-WW2C6NIVDASX2EHYK2RL/contractors+Licence.jpg?format=2500w",
    selectedDocumentType: "license",
    expected: {
      documentType: "license",
      businessName: "Verde Valley Handyman LLC",
      policyOrLicenseNumber: ["ROC 333112", "333112"],
      effectiveDate: null,
      expirationDate: "2023-04-30",
      issuingCarrierOrAuthority: ["Arizona Registrar of Contractors", "State of Arizona Registrar of Contractors"]
    }
  },
  {
    id: "w9_completed",
    url: "https://stinstafill.blob.core.windows.net/static/w9-2024-single-member-llc.png",
    selectedDocumentType: "w9",
    expected: {
      documentType: "w9",
      businessName: "John Doe",
      policyOrLicenseNumber: null,
      effectiveDate: null,
      expirationDate: null,
      issuingCarrierOrAuthority: null
    }
  }
];

const models = (process.env.BENCHMARK_MODELS ?? "google/gemini-3.5-flash,anthropic/claude-sonnet-4.6")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const downloaded = new Map<string, Buffer>();
const rawDiagnostics: Array<Record<string, unknown>> = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
const { extractDocumentFieldsDirect } = await import("../lib/ai/extraction");

const modelRows: Array<Record<string, any>> = [];
for (const model of models) {
  for (const fixture of fixtures) {
    const source = await download(fixture.url);
    const prepared = await prepareImage(source, 2000, false);
    const startedAt = Date.now();
    try {
      const result = await extractDocumentFieldsDirect(
        {
          fileBase64: prepared.buffer.toString("base64"),
          mimeType: "image/jpeg",
          fileName: `${fixture.id}.jpg`,
          selectedDocumentType: fixture.selectedDocumentType,
          preprocessing: metadata(prepared, source.byteLength)
        },
        model,
        {
          onDiagnostic: (diagnostic) => {
            if (model === models[0]) rawDiagnostics.push({ fixture: fixture.id, ...diagnostic });
          }
        }
      );
      modelRows.push({
        model,
        fixture: fixture.id,
        accuracy: score(result, fixture.expected),
        result: coreFields(result),
        coverageLines: result.coverageLines.length,
        warnings: result.validationWarnings,
        elapsedMs: Date.now() - startedAt,
        usage: result.usage
      });
    } catch (error) {
      modelRows.push({ model, fixture: fixture.id, accuracy: 0, error: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - startedAt });
    }
  }
}

const summaries = models.map((model) => {
  const rows = modelRows.filter((row) => row.model === model);
  return {
    model,
    averageAccuracy: round(rows.reduce((sum, row) => sum + row.accuracy, 0) / Math.max(1, rows.length)),
    successfulDocuments: rows.filter((row) => !row.error).length,
    elapsedMs: rows.reduce((sum, row) => sum + row.elapsedMs, 0)
  };
});
const winner = [...summaries].sort((a, b) => b.averageAccuracy - a.averageAccuracy || a.elapsedMs - b.elapsedMs)[0]?.model ?? models[0];

const resolutionRows: Array<Record<string, any>> = [];
const resolutionEdges = process.env.BENCHMARK_SKIP_RESOLUTION === "true" ? [] : [900, 1400, 2000];
for (const longEdge of resolutionEdges) {
  for (const fixture of fixtures.filter((item) => item.id !== "w9_completed")) {
    const source = await download(fixture.url);
    const prepared = await prepareImage(source, longEdge, true);
    const startedAt = Date.now();
    try {
      const result = await extractDocumentFieldsDirect(
        {
          fileBase64: prepared.buffer.toString("base64"),
          mimeType: "image/jpeg",
          fileName: `${fixture.id}-${longEdge}.jpg`,
          selectedDocumentType: fixture.selectedDocumentType,
          preprocessing: metadata(prepared, source.byteLength)
        },
        winner
      );
      resolutionRows.push({
        longEdge,
        fixture: fixture.id,
        accuracy: score(result, fixture.expected),
        bytes: prepared.buffer.byteLength,
        elapsedMs: Date.now() - startedAt,
        result: coreFields(result),
        usage: result.usage
      });
    } catch (error) {
      resolutionRows.push({ longEdge, fixture: fixture.id, accuracy: 0, bytes: prepared.buffer.byteLength, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

const resolutionSummaries = resolutionEdges.map((longEdge) => {
  const rows = resolutionRows.filter((row) => row.longEdge === longEdge);
  return {
    longEdge,
    averageAccuracy: round(rows.reduce((sum, row) => sum + row.accuracy, 0) / Math.max(1, rows.length)),
    averageBytes: Math.round(rows.reduce((sum, row) => sum + row.bytes, 0) / Math.max(1, rows.length)),
    elapsedMs: rows.reduce((sum, row) => sum + (row.elapsedMs ?? 0), 0)
  };
});

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), fixtures: fixtures.map(({ id, url }) => ({ id, source: url })), rawDiagnostics, modelRows, summaries, winner, resolutionRows, resolutionSummaries }, null, 2));
}

async function download(url: string) {
  const cached = downloaded.get(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fixture download failed (${response.status}): ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  downloaded.set(url, buffer);
  return buffer;
}

async function prepareImage(source: Buffer, longEdge: number, allowEnlargement: boolean) {
  const pipeline = sharp(source).rotate().resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: !allowEnlargement }).normalize();
  const { data, info } = await pipeline.jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

function metadata(prepared: { width: number; height: number; buffer: Buffer }, inputBytes: number) {
  return {
    processor: "vendorproof_mobile_v1" as const,
    orientationNormalized: true,
    edgeCropApplied: false,
    contrastNormalized: true,
    inputWidth: null,
    inputHeight: null,
    outputWidth: prepared.width,
    outputHeight: prepared.height,
    inputBytes,
    outputBytes: prepared.buffer.byteLength,
    crop: null
  };
}

function score(result: Record<string, any>, expected: Record<string, ExpectedValue>) {
  const entries = Object.entries(expected);
  const correct = entries.filter(([field, value]) => matches(result[field], value)).length;
  return round((correct / entries.length) * 100);
}

function matches(actual: unknown, expected: ExpectedValue) {
  const choices = Array.isArray(expected) ? expected : [expected];
  return choices.some((choice) => normalize(actual) === normalize(choice));
}

function normalize(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function coreFields(result: Record<string, any>) {
  return {
    documentType: result.documentType,
    businessName: result.businessName,
    policyOrLicenseNumber: result.policyOrLicenseNumber,
    effectiveDate: result.effectiveDate,
    expirationDate: result.expirationDate,
    issuingCarrierOrAuthority: result.issuingCarrierOrAuthority
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function loadEnvFile() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] === undefined) process.env[key] = line.slice(separator + 1).trim();
  }
}
