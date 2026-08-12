import {
  downloadCsv,
  rowsToCsv,
  todayStamp,
} from "@/lib/export/csv";
import { NORMALIZED_PREVIEW_COLUMNS } from "@/lib/export/normalizedColumns";
import type { NormalizedLead } from "@/types/lead";
import type { RankedLead } from "@/types/qualification";

/** User-facing normalized export mirrors the preview column set. */
export const NORMALIZED_EXPORT_COLUMNS = NORMALIZED_PREVIEW_COLUMNS;

export const RANKED_EXPORT_COLUMNS = [
  "Rank",
  "Name",
  "Email",
  "Company",
  "Job Title",
  "Score",
  "Classification",
  "Budget Fit",
  "Intent",
  "Company Fit",
  "Buyer Fit",
  "Source",
  "Recency",
] as const;

export function exportNormalizedLeadsCsv(
  leads: NormalizedLead[],
  baseFileName?: string,
) {
  const headers = [...NORMALIZED_EXPORT_COLUMNS];
  const rows = leads.map((lead) => {
    const row: Record<string, unknown> = {};
    for (const col of headers) {
      const value = lead[col as keyof NormalizedLead];
      row[col] = value === null || value === undefined ? "" : value;
    }
    return row;
  });

  const stem = (baseFileName || "leads").replace(/\.csv$/i, "");
  downloadCsv(`${stem}-normalized.csv`, rowsToCsv(headers, rows));
}

/**
 * Export current RankedLead[] in display order.
 * Always includes full score breakdown. Does not recalculate or call AI.
 */
export function exportRankedLeadsCsv(rankedLeads: RankedLead[]) {
  const headers = [...RANKED_EXPORT_COLUMNS];
  const rows = rankedLeads.map((ranked) => ({
    Rank: ranked.rank,
    Name: ranked.lead.name ?? "",
    Email: ranked.lead.email ?? "",
    Company: ranked.lead.company ?? "",
    "Job Title": ranked.lead.jobTitle ?? "",
    Score: ranked.score.total,
    Classification: ranked.score.classification,
    "Budget Fit": ranked.score.components.budgetFit,
    Intent: ranked.score.components.intent,
    "Company Fit": ranked.score.components.companyFit,
    "Buyer Fit": ranked.score.components.buyerFit,
    Source: ranked.score.components.source,
    Recency: ranked.score.components.recency,
  }));

  downloadCsv(
    `ranked-leads-${todayStamp()}.csv`,
    rowsToCsv(headers, rows),
  );
}
