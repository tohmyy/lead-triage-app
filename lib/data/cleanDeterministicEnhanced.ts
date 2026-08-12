import sourceMappingConfig from "@/lib/config/sourceMapping.json";
import type { NormalizedLead, RawRow } from "@/types/lead";
import type { ColumnMapping } from "@/types/column";

/**
 * Enhanced deterministic cleaning
 * Handles: leadId, email, phone, name, website, budget, employee count,
 * dates, and source normalization.
 * Does NOT use AI — purely deterministic operations.
 * Must run before any AI semantic normalization or signal extraction.
 */

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === "null" || str === "undefined" || str === "N/A" || str === "-") {
    return null;
  }
  return str;
}

function cleanEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return trimmed;
  }
  // Invalid format — keep trimmed lowercase original (do not invent)
  return trimmed || null;
}

function cleanPhone(value: string): string | null {
  const trimmed = value.trim();
  const cleaned = trimmed.replace(/[\s().-]/g, "");
  if (cleaned.match(/\d{7,}/)) {
    return cleaned;
  }
  return trimmed;
}

function cleanWebsite(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const withoutProtocol = trimmed
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/$/, "");
  if (withoutProtocol.includes(".")) {
    return withoutProtocol;
  }
  return trimmed;
}

/**
 * Normalize employee count — preserves ranges and approximate values.
 * Examples: "10" → "10", "10-50" → "10-50", "1,000 employees" → "1000", "50+" → "50+"
 */
function normalizeEmployeeCount(value: string): string | null {
  const trimmed = value.trim();

  const rangeMatch = trimmed.match(/^(\d+)\s*[-–to]+\s*(\d+)(\+)?$/i);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}${rangeMatch[3] ? "+" : ""}`;
  }

  if (trimmed.match(/^(\d+)\+$/)) {
    return trimmed;
  }

  // Strip thousand separators / "employees" suffixes without inventing ranges
  const withoutSuffix = trimmed.replace(
    /\s*(employees?|headcount|staff|team|people|count)\s*$/i,
    "",
  );
  const cleaned = withoutSuffix.replace(/,/g, "").trim();

  const num = parseFloat(cleaned);
  if (!isNaN(num) && num > 0) {
    return String(Math.floor(num));
  }

  return trimmed;
}

/**
 * Normalize date into YYYY-MM-DD when parseable.
 */
function normalizeDate(value: string): string | null {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();

  if (trimmed.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?Z?$/)) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const parsed = new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    );
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return trimmed;
}

/**
 * Normalize budget — strip currency symbols/codes and unambiguous k-suffixes.
 * Does not invent a value when ambiguous.
 */
function normalizeBudget(value: string): string | null {
  const trimmed = value.trim();

  let cleaned = trimmed
    .replace(/^[\$£€¥₹]+\s*/, "")
    .replace(/\s*(usd|gbp|eur|cad|aud)\s*$/i, "")
    .replace(/,/g, "")
    .trim();

  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/i);
  if (kMatch) {
    return String(Math.floor(parseFloat(kMatch[1]) * 1000));
  }

  const num = parseFloat(cleaned);
  if (!isNaN(num) && num >= 0 && /^-?\d+(\.\d+)?$/.test(cleaned)) {
    return String(Math.floor(num));
  }

  return trimmed;
}

function cleanName(value: string): string | null {
  return value.trim().replace(/\s+/g, " ") || null;
}

/**
 * Lead ID — identifier only. Trim whitespace; never invent or semantically rewrite.
 */
function normalizeLeadId(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function loadSourceMappings(): Record<string, string> {
  return sourceMappingConfig.mappings as Record<string, string>;
}

function normalizeSource(
  value: string,
): { original: string; normalized: string } | null {
  if (!value) return null;

  const trimmed = value.trim().toLowerCase();
  const mappings = loadSourceMappings();

  if (mappings[trimmed]) {
    return { original: value, normalized: mappings[trimmed] };
  }

  for (const [key, normalized] of Object.entries(mappings)) {
    if (trimmed.includes(key) || key.includes(trimmed)) {
      return { original: value, normalized };
    }
  }

  return { original: value, normalized: "other" };
}

export type DeterministicCleaningResult = {
  leads: NormalizedLead[];
  summary: {
    rowsProcessed: number;
    emailsCleaned: number;
    phonesCleaned: number;
    websitesCleaned: number;
    budgetsCleaned: number;
    datesCleaned: number;
    employeeCountsCleaned: number;
    sourcesCleaned: number;
    namesToCleaned: number;
    leadIdsCleaned: number;
  };
};

/**
 * Apply deterministic cleaning to raw rows.
 * Returns NormalizedLead objects with only canonical fields populated.
 * Does not use AI.
 */
export function cleanDeterministicEnhanced(
  rows: RawRow[],
  mappings: ColumnMapping[],
): DeterministicCleaningResult {
  const stats = {
    rowsProcessed: 0,
    emailsCleaned: 0,
    phonesCleaned: 0,
    websitesCleaned: 0,
    budgetsCleaned: 0,
    datesCleaned: 0,
    employeeCountsCleaned: 0,
    sourcesCleaned: 0,
    namesToCleaned: 0,
    leadIdsCleaned: 0,
  };

  const leads: NormalizedLead[] = rows.map((row, idx) => {
    // Existing missing-ID fallback: row index string (preserved when CSV leadId absent)
    const lead: NormalizedLead = {
      id: String(idx),
      leadId: null,
    };

    stats.rowsProcessed++;

    for (const mapping of mappings) {
      const originalValue = row[mapping.originalColumn];
      const stringValue = safeString(originalValue);

      if (!stringValue) {
        continue;
      }

      const field = mapping.normalizedField;

      if (field === "leadId") {
        const cleaned = normalizeLeadId(stringValue);
        if (cleaned) {
          lead.leadId = cleaned;
          // Prefer CSV lead ID as the stable identity (never AI-generated)
          lead.id = cleaned;
          stats.leadIdsCleaned++;
        }
      } else if (field === "email") {
        const cleaned = cleanEmail(stringValue);
        if (cleaned) {
          lead.email = cleaned;
          stats.emailsCleaned++;
        }
      } else if (field === "phone") {
        const cleaned = cleanPhone(stringValue);
        if (cleaned) {
          lead.phone = cleaned;
          stats.phonesCleaned++;
        }
      } else if (field === "website") {
        const cleaned = cleanWebsite(stringValue);
        if (cleaned) {
          lead.website = cleaned;
          stats.websitesCleaned++;
        }
      } else if (field === "budget") {
        const cleaned = normalizeBudget(stringValue);
        if (cleaned) {
          lead.budget = cleaned;
          stats.budgetsCleaned++;
        }
      } else if (field === "createdAt") {
        const cleaned = normalizeDate(stringValue);
        if (cleaned) {
          lead.createdAt = cleaned;
          stats.datesCleaned++;
        }
      } else if (field === "employeeCount") {
        const cleaned = normalizeEmployeeCount(stringValue);
        if (cleaned) {
          lead.employeeCount = cleaned;
          stats.employeeCountsCleaned++;
        }
      } else if (field === "source") {
        const normalized = normalizeSource(stringValue);
        if (normalized) {
          lead.source = normalized.normalized;
          stats.sourcesCleaned++;
        }
      } else if (field === "name") {
        const cleaned = cleanName(stringValue);
        if (cleaned) {
          lead.name = cleaned;
          stats.namesToCleaned++;
        }
      } else if (field === "ignore" || field === "other") {
        continue;
      } else {
        // Semantic fields (jobTitle, industry, notes, …) — trim only; AI may refine later
        (lead as Record<string, unknown>)[field] = stringValue;
      }
    }

    return lead;
  });

  return { leads, summary: stats };
}
