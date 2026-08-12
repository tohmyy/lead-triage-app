import type { RawRow } from "@/types/lead";
import type { ColumnMapping } from "@/types/column";

/**
 * Duplicate detection
 * Uses multiple strategies to identify potential duplicates
 */

export type DuplicateGroup = {
  strategy: "leadId" | "email" | "name_company";
  key: string;
  indices: number[]; // Row indices that are duplicates
};

function normalizeForComparison(value: unknown): string {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

export function detectDuplicates(
  rows: RawRow[],
  mappings: ColumnMapping[],
): {
  groups: DuplicateGroup[];
  totalDuplicateRecords: number;
} {
  const groups: DuplicateGroup[] = [];
  const seen = new Map<string, number[]>();

  // Strategy 1: leadId
  const leadIdMapping = mappings.find((m) => m.normalizedField === "leadId");
  if (leadIdMapping) {
    rows.forEach((row, idx) => {
      const value = normalizeForComparison(row[leadIdMapping.originalColumn]);
      if (value) {
        const key = `leadId:${value}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(idx);
      }
    });
  }

  // Strategy 2: email
  const emailMapping = mappings.find((m) => m.normalizedField === "email");
  if (emailMapping) {
    rows.forEach((row, idx) => {
      const value = normalizeForComparison(row[emailMapping.originalColumn]);
      if (value && value.includes("@")) {
        const key = `email:${value}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(idx);
      }
    });
  }

  // Strategy 3: name + company combination
  const nameMapping = mappings.find((m) => m.normalizedField === "name");
  const companyMapping = mappings.find((m) => m.normalizedField === "company");
  if (nameMapping && companyMapping) {
    rows.forEach((row, idx) => {
      const name = normalizeForComparison(row[nameMapping.originalColumn]);
      const company = normalizeForComparison(row[companyMapping.originalColumn]);
      if (name && company) {
        const key = `name_company:${name}||${company}`;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(idx);
      }
    });
  }

  // Convert to duplicate groups (only those with 2+ occurrences)
  let totalDuplicateRecords = 0;
  for (const [key, indices] of seen.entries()) {
    if (indices.length > 1) {
      const [strategy, ...rest] = key.split(":");
      groups.push({
        strategy: strategy as any,
        key: rest.join(":"),
        indices,
      });
      totalDuplicateRecords += indices.length - 1; // Count duplicates (not the original)
    }
  }

  return { groups, totalDuplicateRecords };
}
