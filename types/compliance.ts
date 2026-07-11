export type ComplianceStatus = "compliant" | "expiring" | "missing" | "under_review" | "deficient" | "never_responded";

export type PropertyRecord = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  unit_count: number | null;
  property_type: string | null;
  created_at: string | null;
};

export type VendorRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  trade: string | null;
  category: string | null;
  status: string | null;
  default_requirement_template_id: string | null;
  created_at: string | null;
};

export type DocumentVersionRecord = {
  id: string;
  organization_id: string;
  document_id: string;
  version_number: number;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string | null;
  signedUrl?: string | null;
};

export type DocumentReviewRecord = {
  id: string;
  document_id: string;
  document_version_id: string;
  reviewer_id: string | null;
  status: string;
  notes: string | null;
  reviewed_at: string | null;
};

export type DocumentRecord = {
  id: string;
  organization_id: string;
  vendor_id: string;
  property_id: string | null;
  vendor_requirement_id: string | null;
  document_type: string;
  status: string;
  business_name: string | null;
  policy_number: string | null;
  issuing_authority: string | null;
  issued_at: string | null;
  expires_at: string | null;
  ai_extraction_status: string | null;
  ai_extraction_model: string | null;
  ai_extraction_raw: unknown | null;
  ai_extraction_confidence: number | null;
  ai_extraction_flags: string[] | null;
  ai_extraction_usage: unknown | null;
  ai_extraction_error: string | null;
  ai_extraction_completed_at: string | null;
  ai_extraction_confirmed_at: string | null;
  ai_extraction_confirmed_by: string | null;
  ai_extraction_corrected_fields: unknown | null;
  ai_extracted_document_type: string | null;
  ai_extracted_business_name: string | null;
  ai_extracted_policy_number: string | null;
  ai_extracted_effective_date: string | null;
  ai_extracted_expiration_date: string | null;
  ai_extracted_issuing_authority: string | null;
  created_at: string | null;
  updated_at: string | null;
  latestVersion?: DocumentVersionRecord | null;
  latestReview?: DocumentReviewRecord | null;
};

export type VendorRequirementRecord = {
  id: string;
  organization_id: string;
  vendor_id: string;
  property_id: string | null;
  requirement_template_id: string | null;
  name: string;
  document_type: string;
  required: boolean;
  expires_required: boolean;
  expiration_rule: string | null;
  status: string;
  due_date: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  document?: DocumentRecord | null;
};

export type ComplianceVendorRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string | null;
  propertyId: string | null;
  propertyName: string;
  total: number;
  compliant: number;
  expiring: number;
  expired: number;
  missing: number;
  underReview: number;
  deficient: number;
  status: ComplianceStatus;
  lastUploadAt: string | null;
};

export type CompliancePropertyRow = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  vendors: number;
  total: number;
  compliant: number;
  expiring: number;
  expired: number;
  missing: number;
  underReview: number;
  deficient: number;
  status: ComplianceStatus;
};

export type ComplianceData = {
  organization: { id: string; name: string | null; role: string | null } | null;
  properties: PropertyRecord[];
  vendors: VendorRecord[];
  requirements: VendorRequirementRecord[];
  vendorRows: ComplianceVendorRow[];
  propertyRows: CompliancePropertyRow[];
};

export type DashboardStat = {
  label: string;
  value: number;
  status: ComplianceStatus;
  helper?: string;
};

export type AttentionItem = {
  id: string;
  vendor: string;
  property: string;
  requirement: string;
  dueLabel: string;
  status: ComplianceStatus;
  documentId?: string;
};

export type VendorSummary = {
  id: string;
  name: string;
  trade: string;
  propertyCount: number;
  status: ComplianceStatus;
  expiresAt?: string;
  documentId?: string;
};

export type PropertySummary = {
  id: string;
  name: string;
  address: string;
  compliant: number;
  total: number;
  status: ComplianceStatus;
};
