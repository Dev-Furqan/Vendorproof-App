import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode, encode } from "jpeg-js";

import { detectDocumentCrop } from "@/lib/documents/image-processing";

// The live benchmark stayed field-perfect at 1400px; 1600px keeps headroom for angled phone captures.
export const OCR_MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 90;

export type PreprocessingMetadata = {
  processor: "vendorproof_mobile_v1" | "openrouter_mistral_ocr";
  orientationNormalized: boolean;
  edgeCropApplied: boolean;
  contrastNormalized: boolean;
  inputWidth: number | null;
  inputHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  inputBytes: number | null;
  outputBytes: number | null;
  crop: { x: number; y: number; width: number; height: number } | null;
};

export type DocumentSource = {
  uri: string;
  mimeType: string;
  fileName: string;
  width?: number | null;
  height?: number | null;
  base64?: string | null;
};

export type PreprocessedDocument = DocumentSource & {
  base64: string | null;
  preprocessing: PreprocessingMetadata;
};

export async function preprocessDocument(source: DocumentSource): Promise<PreprocessedDocument> {
  if (source.mimeType === "application/pdf") {
    return {
      ...source,
      base64: source.base64 ?? null,
      preprocessing: {
        processor: "openrouter_mistral_ocr",
        orientationNormalized: false,
        edgeCropApplied: false,
        contrastNormalized: false,
        inputWidth: null,
        inputHeight: null,
        outputWidth: null,
        outputHeight: null,
        inputBytes: null,
        outputBytes: null,
        crop: null
      }
    };
  }

  const inputWidth = positiveDimension(source.width);
  const inputHeight = positiveDimension(source.height);
  const resize = getResizeAction(inputWidth, inputHeight);
  let normalized = await manipulateAsync(source.uri, resize ? [{ resize }] : [], {
    base64: true,
    compress: 0.96,
    format: SaveFormat.JPEG
  });

  if (Math.max(normalized.width, normalized.height) > OCR_MAX_LONG_EDGE) {
    const secondResize = getResizeAction(normalized.width, normalized.height);
    normalized = await manipulateAsync(normalized.uri, secondResize ? [{ resize: secondResize }] : [], {
      base64: true,
      compress: 0.96,
      format: SaveFormat.JPEG
    });
  }

  if (!normalized.base64) throw new Error("Image preprocessing did not return usable image data.");

  const normalizedBytes = base64ToBytes(normalized.base64);
  const decoded = decode(normalizedBytes, {
    useTArray: true,
    formatAsRGBA: true,
    tolerantDecoding: true,
    maxResolutionInMP: 12,
    maxMemoryUsageInMB: 160
  });
  const detectedCrop = detectDocumentCrop(decoded.data, decoded.width, decoded.height);
  const cropped = detectedCrop ? cropRgba(decoded.data, decoded.width, detectedCrop) : { data: decoded.data, width: decoded.width, height: decoded.height };
  const contrastNormalized = normalizeContrast(cropped.data);
  const encoded = encode({ data: cropped.data, width: cropped.width, height: cropped.height }, JPEG_QUALITY);
  const base64 = bytesToBase64(encoded.data);

  return {
    uri: `data:image/jpeg;base64,${base64}`,
    mimeType: "image/jpeg",
    fileName: replaceExtension(source.fileName, "jpg"),
    width: cropped.width,
    height: cropped.height,
    base64,
    preprocessing: {
      processor: "vendorproof_mobile_v1",
      orientationNormalized: true,
      edgeCropApplied: Boolean(detectedCrop),
      contrastNormalized,
      inputWidth,
      inputHeight,
      outputWidth: cropped.width,
      outputHeight: cropped.height,
      inputBytes: normalizedBytes.byteLength,
      outputBytes: encoded.data.byteLength,
      crop: detectedCrop
    }
  };
}

function getResizeAction(width: number | null, height: number | null) {
  if (!width || !height || Math.max(width, height) <= OCR_MAX_LONG_EDGE) return null;
  return width >= height ? { width: OCR_MAX_LONG_EDGE } : { height: OCR_MAX_LONG_EDGE };
}

function positiveDimension(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function cropRgba(data: Uint8Array, sourceWidth: number, crop: { x: number; y: number; width: number; height: number }) {
  const output = new Uint8Array(crop.width * crop.height * 4);
  const rowLength = crop.width * 4;
  for (let y = 0; y < crop.height; y += 1) {
    const sourceStart = ((crop.y + y) * sourceWidth + crop.x) * 4;
    output.set(data.subarray(sourceStart, sourceStart + rowLength), y * rowLength);
  }
  return { data: output, width: crop.width, height: crop.height };
}

function normalizeContrast(data: Uint8Array) {
  const histogram = new Uint32Array(256);
  let samples = 0;
  for (let index = 0; index < data.length; index += 16) {
    histogram[luminance(data[index], data[index + 1], data[index + 2])] += 1;
    samples += 1;
  }
  const low = percentile(histogram, samples, 0.015);
  const high = percentile(histogram, samples, 0.985);
  if (high - low >= 220 && low <= 22 && high >= 238) return false;

  const scale = clampNumber(238 / Math.max(80, high - low), 0.88, 1.55);
  const offset = 9 - low * scale;
  for (let index = 0; index < data.length; index += 4) {
    const before = luminance(data[index], data[index + 1], data[index + 2]);
    const after = clamp(Math.round(before * scale + offset), 0, 255);
    const delta = after - before;
    data[index] = clamp(data[index] + delta, 0, 255);
    data[index + 1] = clamp(data[index + 1] + delta, 0, 255);
    data[index + 2] = clamp(data[index + 2] + delta, 0, 255);
  }
  return true;
}

function percentile(histogram: Uint32Array, count: number, ratio: number) {
  const target = count * ratio;
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen >= target) return value;
  }
  return 255;
}

function luminance(red: number, green: number, blue: number) {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
}

export function base64ToBytes(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

function replaceExtension(fileName: string, extension: string) {
  return /\.[^.]+$/.test(fileName) ? fileName.replace(/\.[^.]+$/, `.${extension}`) : `${fileName}.${extension}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampNumber(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
