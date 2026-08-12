import type { RawRow } from "@/types/lead";
import type { ColumnMapping } from "@/types/column";

/**
 * Deterministic cleaning and normalization
 * Does not use AI - purely deterministic operations
 */

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str || str === "null" || str === "undefined" || str === "N/A" || str === "-") return null;
  return str;
}

function cleanEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  // Basic validation: must have @ and a dot
  if (trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return trimmed;
  }
  return null; // Invalid, preserve original
}

function cleanPhone(value: string): string | null {
  const trimmed = value.trim();
  // Remove common formatting but preserve the number
  const cleaned = trimmed.replace(/[\s().-]/g, "");
  // Basic validation: at least some digits
  if (cleaned.match(/\d{7,}/)) {
    return cleaned;
  }
  return trimmed; // If can't parse, keep original
}

function cleanNumeric(value: string): string | null {
  const trimmed = value.trim();
  // Remove commas and common suffixes
  const cleaned = trimmed.replace(/[,\s]/g, "").replace(/\s*(employees?|items?|units?|ea)$/i, "");
  // Try to parse as number
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return String(num);
  }
  return trimmed; // Keep original if can't parse
}

export function cleanDeterministic(
  rows: RawRow[],
  mappings: ColumnMapping[],
): {
  cleaned: RawRow[];
  stats: {
    trimmed: number;
    emailsCleaned: number;
    phonesCleaned: number;
    numericsCleaned: number;
  };
} {
  const stats = {
    trimmed: 0,
    emailsCleaned: 0,
    phonesCleaned: 0,
    numericsCleaned: 0,
  };

  const cleaned = rows.map((row) => {
    const result: RawRow = {};

    // Map original columns through cleaning functions
    for (const mapping of mappings) {
      const originalValue = row[mapping.originalColumn];
      const stringValue = safeString(originalValue);

      if (!stringValue) {
        result[mapping.originalColumn] = null;
        continue;
      }

      let cleanedValue: string | null = stringValue;

      // Apply field-specific cleaning
      if (mapping.normalizedField === "email") {
        const emailCleaned = cleanEmail(stringValue);
        if (emailCleaned !== stringValue) {
          stats.emailsCleaned++;
        }
        cleanedValue = emailCleaned;
      } else if (mapping.normalizedField === "phone") {
        const phoneCleaned = cleanPhone(stringValue);
        if (phoneCleaned !== stringValue) {
          stats.phonesCleaned++;
        }
        cleanedValue = phoneCleaned;
      } else if (mapping.normalizedField === "employeeCount" || mapping.normalizedField === "budget") {
        const numericCleaned = cleanNumeric(stringValue);
        if (numericCleaned !== stringValue) {
          stats.numericsCleaned++;
        }
        cleanedValue = numericCleaned;
      } else {
        // General string cleaning: trim
        if (cleanedValue !== stringValue.trim()) {
          stats.trimmed++;
        }
        cleanedValue = stringValue.trim();
      }

      result[mapping.originalColumn] = cleanedValue;
    }

    return result;
  });

  return { cleaned, stats };
}
