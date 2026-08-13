import type { NormalizedLead } from "@/types/lead";

/**
 * Deterministic deduplication + Lead ID conflict detection.
 * Runs AFTER deterministic normalization and BEFORE AI.
 * Never invents Lead IDs or merges conflicting records.
 */

export type DuplicateStatus = "unique" | "exact_duplicate" | "id_conflict";

export type DeduplicatedLeadRecord = {
  lead: NormalizedLead;
  sourceRowIndex: number;
  fingerprint: string;
  status: DuplicateStatus;
  /** For exact_duplicate: source row index of the retained copy */
  duplicateOfSourceRow?: number;
};

export type DeduplicateLeadsResult = {
  /** Downstream set: unique + id_conflict only (exact duplicates excluded) */
  leads: NormalizedLead[];
  records: DeduplicatedLeadRecord[];
  sourceRowCount: number;
  retainedCount: number;
  exactDuplicatesRemoved: number;
  idConflictRecordCount: number;
  idConflictLeadIds: string[];
};

/** Canonical fields used for exact-duplicate fingerprinting */
const FINGERPRINT_FIELDS: Array<keyof NormalizedLead> = [
  "leadId",
  "createdAt",
  "name",
  "email",
  "phone",
  "company",
  "employeeCount",
  "website",
  "jobTitle",
  "industry",
  "location",
  "source",
  "budget",
  "productInterest",
  "notes",
];

function fingerprintValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

/**
 * Stable fingerprint of normalized lead content.
 * Same normalized data → same fingerprint.
 */
export function leadFingerprint(lead: NormalizedLead): string {
  return FINGERPRINT_FIELDS.map((field) => fingerprintValue(lead[field])).join(
    "\u0001",
  );
}

function hasLeadId(lead: NormalizedLead): lead is NormalizedLead & {
  leadId: string;
} {
  return typeof lead.leadId === "string" && lead.leadId.trim().length > 0;
}

/**
 * Deduplicate exact normalized rows and flag Lead ID conflicts.
 *
 * - exact_duplicate: identical fingerprint → keep first, exclude rest from AI/rank/export
 * - id_conflict: same leadId, different fingerprints → keep all, flag (do not merge)
 * - missing leadIds are never treated as ID duplicates of each other
 */
export function deduplicateLeads(
  leads: NormalizedLead[],
): DeduplicateLeadsResult {
  const records: DeduplicatedLeadRecord[] = leads.map((lead, sourceRowIndex) => ({
    lead: { ...lead },
    sourceRowIndex,
    fingerprint: leadFingerprint(lead),
    status: "unique" as DuplicateStatus,
  }));

  // Pass 1: exact duplicates by fingerprint
  const firstByFingerprint = new Map<string, number>();
  for (const record of records) {
    const existing = firstByFingerprint.get(record.fingerprint);
    if (existing === undefined) {
      firstByFingerprint.set(record.fingerprint, record.sourceRowIndex);
      continue;
    }
    record.status = "exact_duplicate";
    record.duplicateOfSourceRow = existing;
  }

  // Pass 2: Lead ID conflicts among retained (non-exact-duplicate) rows
  const retainedByLeadId = new Map<string, DeduplicatedLeadRecord[]>();
  for (const record of records) {
    if (record.status === "exact_duplicate") continue;
    if (!hasLeadId(record.lead)) continue;
    const key = record.lead.leadId.trim();
    const list = retainedByLeadId.get(key) ?? [];
    list.push(record);
    retainedByLeadId.set(key, list);
  }

  const idConflictLeadIds: string[] = [];
  for (const [leadId, group] of retainedByLeadId.entries()) {
    if (group.length < 2) continue;
    // Different fingerprints under same ID (exact dupes already removed)
    const fingerprints = new Set(group.map((r) => r.fingerprint));
    if (fingerprints.size < 2) continue;

    idConflictLeadIds.push(leadId);
    for (const record of group) {
      record.status = "id_conflict";
      // Keep business leadId; ensure unique internal id for AI association
      record.lead = {
        ...record.lead,
        leadId,
        id: `${leadId}__row_${record.sourceRowIndex}`,
      };
    }
  }

  const retainedRecords = records.filter((r) => r.status !== "exact_duplicate");
  const exactDuplicatesRemoved = records.length - retainedRecords.length;
  const idConflictRecordCount = retainedRecords.filter(
    (r) => r.status === "id_conflict",
  ).length;

  return {
    leads: retainedRecords.map((r) => r.lead),
    records,
    sourceRowCount: leads.length,
    retainedCount: retainedRecords.length,
    exactDuplicatesRemoved,
    idConflictRecordCount,
    idConflictLeadIds,
  };
}
