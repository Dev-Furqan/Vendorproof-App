import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import type { ExtractionInput } from "../lib/ai/extraction";
import type { PreprocessingMetadata } from "../lib/documents/preprocess";

loadEnvFile();

const port = Number(process.env.API_PORT ?? 3000);
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase URL and anon key are required by the extraction API.");
if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required by the extraction API.");

const server = createServer(async (request, response) => {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") return send(response, 204, null);
  if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true });
  if (request.method !== "POST" || request.url !== "/api/mobile/extract-document") {
    return send(response, 404, { error: "Not found." });
  }

  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) return send(response, 401, { error: "A signed-in VendorProof session is required." });
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.getUser(accessToken);
    if (error || !data.user) return send(response, 401, { error: "Your session expired. Sign in and try again." });

    const body = await readJsonBody(request, 28 * 1024 * 1024);
    const input = validateInput(body);
    const { extractDocumentFieldsDirect } = await import("../lib/ai/extraction");
    const requestedModel = typeof body.model === "string" ? body.model : undefined;
    const result = await extractDocumentFieldsDirect(input, process.env.OPENROUTER_MODEL ?? requestedModel);
    return send(response, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document extraction failed.";
    const status = /too large/i.test(message) ? 413 : /invalid|required|unsupported/i.test(message) ? 400 : 502;
    return send(response, status, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`VendorProof extraction API listening on http://0.0.0.0:${port}`);
});

function validateInput(body: Record<string, unknown>): ExtractionInput {
  const fileBase64 = typeof body.fileBase64 === "string" ? body.fileBase64 : typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.toLowerCase() : "image/jpeg";
  if (!fileBase64) throw new Error("A base64 document file is required.");
  if (!new Set(["image/jpeg", "image/png", "application/pdf"]).has(mimeType)) throw new Error(`Unsupported document MIME type: ${mimeType}`);
  return {
    fileBase64,
    mimeType,
    fileName: typeof body.fileName === "string" && body.fileName ? body.fileName : mimeType === "application/pdf" ? "vendor-document.pdf" : "vendor-document.jpg",
    selectedDocumentType: typeof body.selectedDocumentType === "string" ? body.selectedDocumentType : "unknown",
    preprocessing: body.preprocessing && typeof body.preprocessing === "object" ? (body.preprocessing as PreprocessingMetadata) : null
  };
}

function readJsonBody(request: IncomingMessage, maximumBytes: number) {
  return new Promise<Record<string, any>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) {
        reject(new Error("Document request is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    request.on("error", reject);
  });
}

function getBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("access-control-allow-origin", process.env.VENDORPROOF_ALLOWED_ORIGIN ?? "*");
  response.setHeader("access-control-allow-headers", "authorization, content-type");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
}

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  if (payload === null) return response.end();
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
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
