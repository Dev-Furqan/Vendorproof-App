import { daysUntil, getRequirementStatus } from "@/lib/compliance/status";
import type {
  AttentionItem,
  ComplianceData,
  ComplianceStatus,
  DashboardStat,
  PropertySummary,
  VendorSummary
} from "@/types/compliance";

export function toDashboardStats(data: ComplianceData): DashboardStat[] {
  const summary = data.requirements.reduce(
    (current, requirement) => {
      const status = getRequirementStatus(requirement);
      if (status === "compliant") current.compliant += 1;
      if (status === "expiring") current.expiring += 1;
      if (status === "missing" || status === "never_responded" || status === "deficient") current.missing += 1;
      return current;
    },
    { compliant: 0, expiring: 0, missing: 0 }
  );

  return [
    { label: "Compliant", value: summary.compliant, status: "compliant", helper: "Ready for work" },
    { label: "Expiring", value: summary.expiring, status: "expiring", helper: "Next 30 days" },
    { label: "Missing", value: summary.missing, status: "missing", helper: "Needs follow-up" }
  ];
}

export function toAttentionItems(data: ComplianceData): AttentionItem[] {
  const vendors = new Map(data.vendors.map((vendor) => [vendor.id, vendor]));
  const properties = new Map(data.properties.map((property) => [property.id, property]));

  return data.requirements
    .map((requirement) => {
      const status = getRequirementStatus(requirement);
      const documentId = requirement.document?.id;
      const days = daysUntil(requirement.document?.expires_at ?? requirement.expires_at ?? requirement.due_date);
      return {
        id: requirement.id,
        vendor: vendors.get(requirement.vendor_id)?.name ?? "Unknown vendor",
        property: requirement.property_id ? properties.get(requirement.property_id)?.name ?? "Unknown property" : "Unassigned",
        requirement: requirement.name || requirement.document_type,
        dueLabel: dueLabel(status, days),
        status,
        documentId
      };
    })
    .filter((item) => item.status !== "compliant")
    .sort((a, b) => statusRank(a.status) - statusRank(b.status))
    .slice(0, 8);
}

export function toPropertySummaries(data: ComplianceData): PropertySummary[] {
  return data.propertyRows.map((row) => {
    const property = row.propertyId ? data.properties.find((item) => item.id === row.propertyId) : null;
    const address = [property?.address_line1, property?.city, property?.state].filter(Boolean).join(", ");
    return {
      id: row.id,
      name: row.propertyName,
      address: address || `${row.vendors} vendors`,
      compliant: row.compliant,
      total: row.total,
      status: row.status
    };
  });
}

export function toVendorSummaries(data: ComplianceData): VendorSummary[] {
  return data.vendorRows.map((row) => {
    const vendor = data.vendors.find((item) => item.id === row.vendorId);
    const requirement = data.requirements.find((item) => item.vendor_id === row.vendorId && getRequirementStatus(item) !== "compliant");
    return {
      id: row.vendorId,
      name: row.vendorName,
      trade: vendor?.category ?? vendor?.trade ?? row.propertyName,
      propertyCount: row.propertyId ? 1 : 0,
      status: row.status,
      expiresAt: requirement?.document?.expires_at ?? requirement?.expires_at ?? undefined,
      documentId: requirement?.document?.id
    };
  });
}

function dueLabel(status: ComplianceStatus, days: number | null) {
  if (status === "missing" || status === "never_responded") return "Missing";
  if (status === "deficient") return "Deficient";
  if (status === "under_review") return "Under review";
  if (status === "expiring" && days !== null) return days <= 0 ? "Expired" : `Expiring in ${days} days`;
  return "Needs review";
}

function statusRank(status: ComplianceStatus) {
  const order: Record<ComplianceStatus, number> = {
    missing: 0,
    deficient: 1,
    expiring: 2,
    under_review: 3,
    never_responded: 4,
    compliant: 5
  };
  return order[status];
}
