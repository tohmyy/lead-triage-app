import type { NormalizedLead } from "@/types/lead";

/**
 * Explicit user-facing normalized columns.
 * AI output must never add columns beyond this list.
 * Industry is intentionally excluded from preview/export (kept on lead objects internally).
 */
export const NORMALIZED_PREVIEW_COLUMNS = [
  "leadId",
  "createdAt",
  "name",
  "email",
  "phone",
  "company",
  "employeeCount",
  "website",
  "jobTitle",
  "location",
  "source",
  "budget",
  "productInterest",
  "notes",
] as const satisfies ReadonlyArray<keyof NormalizedLead>;

export type NormalizedPreviewColumn =
  (typeof NORMALIZED_PREVIEW_COLUMNS)[number];
