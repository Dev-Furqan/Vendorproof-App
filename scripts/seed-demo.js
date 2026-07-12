const fs = require("fs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env or your shell before running npm run seed:demo.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const DEMO_EMAIL = "demo@vendorproof.io";
const DEMO_PASSWORD = "VendorProofDemo!2026";
const now = new Date();
const orgId = crypto.randomUUID();
const templateIds = {
  coi: crypto.randomUUID(),
  license: crypto.randomUUID(),
  w9: crypto.randomUUID()
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  console.log("Resetting VendorProof demo database...");
  await deleteTableRows(["document_reviews", "document_versions", "documents", "vendor_requirements", "vendors", "properties", "requirement_templates", "memberships", "users", "organizations"]);
  await deleteAuthUsers();

  const { data: authUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Maya Thompson" }
  });
  if (createUserError) throw createUserError;
  const userId = authUser.user.id;

  await optionalUpsert("users", {
    id: userId,
    email: DEMO_EMAIL,
    full_name: "Maya Thompson",
    avatar_url: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  await insert("organizations", {
    id: orgId,
    name: "Northstar Property Group",
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  await insert("memberships", {
    id: crypto.randomUUID(),
    organization_id: orgId,
    user_id: userId,
    role: "admin",
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  });

  await optionalInsert("requirement_templates", [
    template("coi", "Certificate of Insurance", "coi"),
    template("license", "Trade License", "license"),
    template("w9", "W-9", "w9")
  ]);

  const properties = [
    property("The Meridian Apartments", "1840 Elm Street", "Dallas", "TX", "75201", 186, "residential"),
    property("Harbor Point Retail Plaza", "722 Lakeview Parkway", "Plano", "TX", "75024", 24, "commercial"),
    property("Cedar Ridge Townhomes", "3159 Cedar Springs Road", "Fort Worth", "TX", "76107", 64, "residential")
  ];
  await insert("properties", properties);

  const vendors = [
    vendor("Greenline Landscape Co.", "landscaping", "Landscape maintenance", properties[0].id, "approved"),
    vendor("Apex Air & Mechanical", "HVAC", "HVAC service", properties[0].id, "expiring"),
    vendor("ClearFlow Plumbing", "plumbing", "Plumbing", properties[0].id, "missing"),
    vendor("BrightSweep Janitorial", "cleaning", "Cleaning", properties[1].id, "approved"),
    vendor("Precision Paintworks", "painting", "Painting", properties[1].id, "rejected"),
    vendor("Metro Fire Protection", "fire safety", "Fire systems", properties[1].id, "approved"),
    vendor("Elevate Elevator Services", "elevator", "Elevator maintenance", properties[2].id, "expiring7"),
    vendor("SecureGate Access", "security", "Access control", properties[2].id, "under_review"),
    vendor("BluePeak Roofing", "roofing", "Roofing", properties[2].id, "missing"),
    vendor("EcoBright Window Cleaning", "cleaning", "Window cleaning", properties[1].id, "approved")
  ];
  await insert("vendors", vendors.map(({ requirementStatus, propertyId, ...row }) => row));

  const requirements = vendors.map((item, index) => requirement(item, index));
  await insert("vendor_requirements", requirements);

  const documentRows = [];
  const versionRows = [];
  for (const req of requirements) {
    if (req.status === "missing") continue;
    const doc = documentForRequirement(req);
    documentRows.push(doc);
    versionRows.push({
      id: crypto.randomUUID(),
      organization_id: orgId,
      document_id: doc.id,
      version_number: 1,
      storage_path: `${orgId}/${doc.vendor_id}/${doc.id}/sample-${doc.document_type}.txt`,
      file_name: `sample-${doc.document_type}.txt`,
      mime_type: "text/plain",
      size_bytes: 96,
      uploaded_by: userId,
      created_at: daysFromNow(-10).toISOString()
    });
  }
  await insert("documents", documentRows);
  await insert("document_versions", versionRows);

  console.log("Demo reset complete.");
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
}

function loadEnv() {
  const entries = {};
  if (fs.existsSync(".env")) {
    for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index > -1) entries[line.slice(0, index)] = line.slice(index + 1);
    }
  }
  return { ...entries, ...process.env };
}

async function deleteTableRows(tables) {
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error && !isMissingTable(error)) throw error;
  }
}

async function deleteAuthUsers() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  for (const user of data.users) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
  }
}

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function optionalInsert(table, rows) {
  const { error } = await supabase.from(table).insert(rows);
  if (error && !isMissingTable(error) && !isMissingColumn(error)) throw new Error(`${table}: ${error.message}`);
}

async function optionalUpsert(table, row) {
  const { error } = await supabase.from(table).upsert(row);
  if (error && !isMissingTable(error) && !isMissingColumn(error)) throw new Error(`${table}: ${error.message}`);
}

function isMissingTable(error) {
  return error.code === "42P01" || /could not find the table|does not exist/i.test(error.message);
}

function isMissingColumn(error) {
  return error.code === "42703" || error.code === "PGRST204" || /column|schema cache/i.test(error.message);
}

function template(key, name, documentType) {
  return {
    id: templateIds[key],
    organization_id: orgId,
    name,
    document_type: documentType,
    description: `Required ${name} for active vendors.`,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function property(name, address, city, state, postalCode, unitCount, propertyType) {
  return {
    id: crypto.randomUUID(),
    organization_id: orgId,
    name,
    address_line1: address,
    city,
    state,
    postal_code: postalCode,
    unit_count: unitCount,
    property_type: propertyType,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function vendor(name, category, trade, propertyId, requirementStatus) {
  return {
    id: crypto.randomUUID(),
    organization_id: orgId,
    name,
    email: contactEmail(name),
    phone: "(214) 555-" + String(Math.floor(1000 + Math.random() * 8999)),
    trade,
    category,
    status: "active",
    default_requirement_template_id: templateIds.coi,
    propertyId,
    requirementStatus,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function requirement(item, index) {
  const documentType = index % 5 === 2 ? "license" : index % 4 === 3 ? "w9" : "coi";
  const templateId = documentType === "license" ? templateIds.license : documentType === "w9" ? templateIds.w9 : templateIds.coi;
  const missing = item.requirementStatus === "missing";
  return {
    id: crypto.randomUUID(),
    organization_id: orgId,
    vendor_id: item.id,
    property_id: item.propertyId,
    requirement_template_id: templateId,
    name: documentType === "coi" ? "Certificate of Insurance" : documentType === "license" ? "Trade License" : "W-9",
    document_type: documentType,
    required: true,
    expires_required: documentType !== "w9",
    expiration_rule: documentType === "w9" ? "none" : "annual",
    status: missing ? "missing" : item.requirementStatus === "under_review" ? "pending_review" : "compliant",
    due_date: daysFromNow(missing ? 7 : 30).toISOString().slice(0, 10),
    expires_at: expirationFor(item.requirementStatus),
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

function documentForRequirement(req) {
  const status = req.status === "pending_review" ? "pending_review" : req.status === "missing" ? "rejected" : "approved";
  return {
    id: crypto.randomUUID(),
    organization_id: orgId,
    vendor_id: req.vendor_id,
    property_id: req.property_id,
    vendor_requirement_id: req.id,
    document_type: req.document_type,
    status,
    business_name: "Northstar Property Group",
    policy_number: `VP-${Math.floor(100000 + Math.random() * 899999)}`,
    issuing_authority: req.document_type === "license" ? "Texas Department of Licensing" : "Hartford Specialty Insurance",
    issued_at: daysFromNow(-120).toISOString().slice(0, 10),
    expires_at: req.expires_at,
    ai_extraction_status: "completed",
    ai_extraction_model: "openai/gpt-4.1-mini",
    ai_extraction_raw: {},
    ai_extraction_confidence: 0.86,
    ai_extraction_flags: [],
    ai_extraction_error: null,
    ai_extraction_completed_at: daysFromNow(-9).toISOString(),
    ai_extracted_document_type: req.document_type,
    ai_extracted_business_name: "Northstar Property Group",
    ai_extracted_policy_number: `VP-${Math.floor(100000 + Math.random() * 899999)}`,
    ai_extracted_effective_date: daysFromNow(-120).toISOString().slice(0, 10),
    ai_extracted_expiration_date: req.expires_at,
    ai_extracted_issuing_authority: req.document_type === "license" ? "Texas Department of Licensing" : "Hartford Specialty Insurance",
    created_at: daysFromNow(-10).toISOString(),
    updated_at: daysFromNow(-9).toISOString()
  };
}

function expirationFor(status) {
  if (status === "expiring7") return daysFromNow(6).toISOString().slice(0, 10);
  if (status === "expiring") return daysFromNow(24).toISOString().slice(0, 10);
  if (status === "missing") return null;
  return daysFromNow(210).toISOString().slice(0, 10);
}

function daysFromNow(days) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date;
}

function contactEmail(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "")}@example.com`;
}
