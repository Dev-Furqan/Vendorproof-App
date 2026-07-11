import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase, realtimeTables } from "@/lib/supabase/client";
import {
  documentSelectBase,
  documentSelectWithAi,
  isMissingColumnError,
  requirementSelectBase,
  requirementSelectWithRules,
  type SchemaCompatResult,
  withDocumentDefaults,
  withRequirementDefaults
} from "@/lib/compliance/schema";
import { attachDocumentsToRequirements, buildPropertyComplianceRows, buildVendorComplianceRows } from "@/lib/compliance/status";
import type {
  ComplianceData,
  DocumentRecord,
  DocumentReviewRecord,
  DocumentVersionRecord,
  PropertyRecord,
  VendorRecord,
  VendorRequirementRecord
} from "@/types/compliance";

const emptyData: ComplianceData = {
  organization: null,
  properties: [],
  vendors: [],
  requirements: [],
  vendorRows: [],
  propertyRows: []
};

let realtimeSubscriptionId = 0;

export async function getCurrentWorkspace() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    const message = userError.message ?? "";
    if (/auth session missing/i.test(message)) return { user: null, organization: null };
    throw new Error(message);
  }
  if (!user) return { user: null, organization: null };

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership?.organization_id) return { user, organization: null };

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (orgError) throw new Error(orgError.message);

  return {
    user,
    organization: {
      id: String(membership.organization_id),
      name: typeof organization?.name === "string" ? organization.name : null,
      role: typeof membership.role === "string" ? membership.role : null
    }
  };
}

export async function loadComplianceData(): Promise<ComplianceData> {
  const { organization } = await getCurrentWorkspace();
  if (!organization) return emptyData;

  const [propertiesResult, vendorsResult, initialRequirementsResult, initialDocumentsResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, address_line1, city, state, postal_code, unit_count, property_type, created_at")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
    supabase
      .from("vendors")
      .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
    supabase.from("vendor_requirements").select(requirementSelectWithRules).eq("organization_id", organization.id),
    supabase.from("documents").select(documentSelectWithAi).eq("organization_id", organization.id)
  ]);

  let requirementsResult = initialRequirementsResult as SchemaCompatResult;
  let documentsResult = initialDocumentsResult as SchemaCompatResult;

  if (isMissingColumnError(requirementsResult.error)) {
    requirementsResult = (await supabase.from("vendor_requirements").select(requirementSelectBase).eq("organization_id", organization.id)) as SchemaCompatResult;
  }

  if (isMissingColumnError(documentsResult.error)) {
    documentsResult = (await supabase.from("documents").select(documentSelectBase).eq("organization_id", organization.id)) as SchemaCompatResult;
  }

  const baseError = propertiesResult.error ?? vendorsResult.error ?? requirementsResult.error ?? documentsResult.error;
  if (baseError) throw new Error(baseError.message);

  const documents = ((documentsResult.data ?? []) as DocumentRecord[]).map(withDocumentDefaults);
  const documentIds = documents.map((document) => document.id);

  const [versionsResult, reviewsResult] =
    documentIds.length > 0
      ? await Promise.all([
          supabase
            .from("document_versions")
            .select("id, organization_id, document_id, version_number, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
            .eq("organization_id", organization.id)
            .in("document_id", documentIds),
          supabase
            .from("document_reviews")
            .select("id, document_id, document_version_id, reviewer_id, status, notes, reviewed_at")
            .eq("organization_id", organization.id)
            .in("document_id", documentIds)
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  const documentError = versionsResult.error ?? reviewsResult.error;
  if (documentError) throw new Error(documentError.message);

  const requirements = attachDocumentsToRequirements({
    requirements: ((requirementsResult.data ?? []) as VendorRequirementRecord[]).map(withRequirementDefaults),
    documents,
    versions: (versionsResult.data ?? []) as DocumentVersionRecord[],
    reviews: (reviewsResult.data ?? []) as DocumentReviewRecord[]
  });
  const properties = (propertiesResult.data ?? []) as PropertyRecord[];
  const vendors = (vendorsResult.data ?? []) as VendorRecord[];
  const vendorRows = buildVendorComplianceRows({ vendors, properties, requirements });
  const propertyRows = buildPropertyComplianceRows({ vendorRows, properties });

  return { organization, properties, vendors, requirements, vendorRows, propertyRows };
}

export function useComplianceData() {
  const [data, setData] = useState<ComplianceData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setData(await loadComplianceData());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load compliance data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data.organization?.id) return;
    const subscriptionId = ++realtimeSubscriptionId;
    const channel = supabase.channel(`mobile-compliance-${data.organization.id}-${subscriptionId}`);
    realtimeTables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `organization_id=eq.${data.organization?.id}` },
        () => load(true)
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.organization?.id, load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return useMemo(() => ({ data, loading, refreshing, error, refresh, reload: load }), [data, loading, refreshing, error, refresh, load]);
}
