import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

loadEnvFile();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase URL and service role key are required.");

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const client = createClient(url!, serviceRoleKey!, { auth: { persistSession: false } });
  const bucket = "documents";
  const folder = `pipeline-diagnostics/${new Date().toISOString().slice(0, 10)}`;
  const fileName = `${randomUUID()}.png`;
  const path = `${folder}/${fileName}`;
  const expected = readFileSync("assets/icon.png");

  let uploaded = false;
  try {
    const upload = await client.storage.from(bucket).upload(path, expected, {
      contentType: "image/png",
      upsert: false
    });
    if (upload.error) throw new Error(`Upload failed: ${upload.error.message}`);
    uploaded = true;

    const listing = await client.storage.from(bucket).list(folder, { search: fileName });
    if (listing.error) throw new Error(`List verification failed: ${listing.error.message}`);
    const listed = listing.data.find((entry) => entry.name === fileName);
    if (!listed) throw new Error("Uploaded object was not returned by storage listing.");

    const download = await client.storage.from(bucket).download(path);
    if (download.error) throw new Error(`Download verification failed: ${download.error.message}`);
    const actual = Buffer.from(await download.data.arrayBuffer());
    if (!actual.equals(expected)) throw new Error(`Downloaded bytes differ: expected ${expected.byteLength}, received ${actual.byteLength}.`);

    console.log(JSON.stringify({
      bucket,
      uploadAccepted: true,
      listReadBack: true,
      byteForByteDownloadMatch: true,
      bytes: actual.byteLength
    }, null, 2));
  } finally {
    if (uploaded) {
      const cleanup = await client.storage.from(bucket).remove([path]);
      if (cleanup.error) console.error(`Diagnostic cleanup failed: ${cleanup.error.message}`);
    }
  }
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
