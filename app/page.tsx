"use client";

import { ArrowRight, CheckCircle2, Loader, Sparkles } from "lucide-react";
import { useState } from "react";

import { ColumnMappingReview } from "@/components/column-mapping-review";
import { DataTable } from "@/components/data-table";
import { ExportActions } from "@/components/export-actions";
import { FileUploader } from "@/components/file-uploader";
import {
  ProcessingProgress,
  type WorkProgress,
} from "@/components/processing-progress";
import { RankedLeadsTable } from "@/components/ranked-leads-table";
import { Button } from "@/components/ui/button";
import { profileColumns } from "@/lib/data/profileColumns";
import { cleanDeterministicEnhanced } from "@/lib/data/cleanDeterministicEnhanced";
import { detectDuplicates } from "@/lib/data/detectDuplicates";
import {
  exportNormalizedLeadsCsv,
  exportRankedLeadsCsv,
} from "@/lib/export/leadsCsv";
import { NORMALIZED_PREVIEW_COLUMNS } from "@/lib/export/normalizedColumns";
import { rankLeads } from "@/lib/qualification/rankLeads";
import type { ColumnMapping } from "@/types/column";
import type { NormalizedLead, RawRow } from "@/types/lead";
import type { LeadAISignals, RankedLead } from "@/types/qualification";
import Papa from "papaparse";

type ProcessingStage =
  | "upload"
  | "profiling"
  | "mapping_ai"
  | "mapping_review"
  | "deterministic_cleaning"
  | "semantic_normalization"
  | "complete"
  | "analyzing"
  | "scoring"
  | "ranking";

const SEMANTIC_BATCH_SIZE = 20;
const ANALYZE_BATCH_SIZE = 10;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export default function Home() {
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [stage, setStage] = useState<ProcessingStage>("upload");
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [normalizedLeads, setNormalizedLeads] = useState<NormalizedLead[]>([]);
  const [rankedLeads, setRankedLeads] = useState<RankedLead[]>([]);
  const [aiSignalsByLeadId, setAiSignalsByLeadId] = useState<
    Map<string, LeadAISignals>
  >(() => new Map());
  const [failedAnalysisIds, setFailedAnalysisIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<WorkProgress | null>(null);
  const [cleaningSummary, setCleaningSummary] = useState<{
    rowsProcessed: number;
    emailsCleaned: number;
    phonesCleaned: number;
    websitesCleaned: number;
    budgetsCleaned: number;
    datesCleaned: number;
    employeeCountsCleaned: number;
    sourcesCleaned: number;
    duplicatesDetected: number;
    semanticsNormalized: number;
  } | null>(null);

  const handleFileSelected = async (file: File) => {
    setError(null);
    setProgress({
      label: "Reading file...",
      detail: "Parse",
      current: 0,
      total: 1,
    });
    setStage("profiling");

    try {
      const text = await file.text();
      Papa.parse(text, {
        complete: async (results: { data: any[] }) => {
          const rows = results.data
            .filter((row) =>
              Array.isArray(row)
                ? row.some((v) => v)
                : Object.values(row).some((v) => v),
            )
            .map((row) => {
              if (Array.isArray(row)) {
                return {};
              }
              return row as RawRow;
            });

          if (!rows.length) {
            setError("CSV appears to be empty");
            setProgress(null);
            setStage("upload");
            return;
          }

          const headers = Object.keys(rows[0]);
          if (!headers.length) {
            setError("Unable to detect columns in CSV");
            setProgress(null);
            setStage("upload");
            return;
          }

          setFileName(file.name);
          setRawRows(rows);
          setAiSignalsByLeadId(new Map());
          setFailedAnalysisIds([]);
          setRankedLeads([]);

          setProgress({
            label: "Mapping columns...",
            detail: "Column mapping",
            current: 0,
            total: 1,
          });
          setStage("mapping_ai");
          await performAIColumnMapping(rows);
        },
        header: true,
        skipEmptyLines: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error parsing CSV";
      setError(msg);
      setProgress(null);
      setStage("upload");
    }
  };

  const performAIColumnMapping = async (rows: RawRow[]) => {
    try {
      const profiles = profileColumns(rows);
      const columnData = profiles.map((p) => ({
        name: p.originalName,
        samples: p.sampleValues,
      }));

      const response = await fetch("/api/ai/map-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: columnData }),
      });

      if (!response.ok) {
        throw new Error("Failed to map columns with AI");
      }

      const result = await response.json();
      setColumnMappings(result.mappings);
      setProgress(null);
      setStage("mapping_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error mapping columns");
      setProgress(null);
      setStage("upload");
    }
  };

  const handleMappingsConfirmed = async (mappings: ColumnMapping[]) => {
    setColumnMappings(mappings);
    setStage("deterministic_cleaning");
    setProgress({
      label: "Cleaning structured fields...",
      detail: "Deterministic normalization",
      current: 0,
      total: 1,
    });

    try {
      if (!rawRows) throw new Error("No data to clean");

      const { leads: deterministicCleaned, summary: cleanStats } =
        cleanDeterministicEnhanced(rawRows, mappings);

      const { totalDuplicateRecords } = detectDuplicates(rawRows, mappings);

      setProgress({
        label: "Cleaning structured fields...",
        detail: "Deterministic normalization",
        current: 1,
        total: 1,
      });

      setStage("semantic_normalization");

      await performSemanticNormalization(
        deterministicCleaned,
        cleanStats,
        totalDuplicateRecords,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error during cleaning");
      setProgress(null);
      setStage("upload");
    }
  };

  const performSemanticNormalization = async (
    deterministicLeads: NormalizedLead[],
    cleanStats: any,
    duplicates: number,
  ) => {
    const batches = chunkArray(deterministicLeads, SEMANTIC_BATCH_SIZE);
    const totalBatches = Math.max(batches.length, 1);
    let completedBatches = 0;
    let failedBatches = 0;
    const allResults: any[] = [];

    setProgress({
      label: "Analyzing leads with AI...",
      detail: `AI semantic normalization · 0 / ${totalBatches} batches`,
      current: 0,
      total: totalBatches,
      failed: 0,
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const leadsForNorm = batch.map((lead) => ({
          id: lead.id,
          jobTitle: lead.jobTitle || "",
          industry: lead.industry || "",
          location: lead.location || "",
          productInterest: lead.productInterest || "",
          notes: lead.notes || "",
        }));

        try {
          const normResponse = await fetch("/api/ai/normalize-leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // One client-driven batch per request so progress reflects real work
            body: JSON.stringify({
              leads: leadsForNorm,
              batchSize: leadsForNorm.length,
            }),
          });

          if (!normResponse.ok) {
            throw new Error("Failed to normalize leads");
          }

          const normResult = await normResponse.json();
          allResults.push(...(normResult.results || []));
          completedBatches += 1;
        } catch (batchError) {
          console.error(`Semantic batch ${i + 1} failed:`, batchError);
          failedBatches += 1;
          // Do not increment completedBatches — failed work is not success progress
        }

        setProgress({
          label: "Analyzing leads with AI...",
          detail: `AI semantic normalization · ${completedBatches} / ${totalBatches} batches`,
          current: completedBatches,
          total: totalBatches,
          failed: failedBatches,
        });
      }

      const merged: NormalizedLead[] = deterministicLeads.map((lead) => {
        const semanticNorm = allResults.find((r: any) => r.leadId === lead.id);

        // Explicit field allowlist — AI never adds preview columns
        if (semanticNorm?.normalized) {
          const next: NormalizedLead = { ...lead };
          if (semanticNorm.normalized.jobTitle)
            next.jobTitle = semanticNorm.normalized.jobTitle;
          if (semanticNorm.normalized.industry)
            next.industry = semanticNorm.normalized.industry;
          if (semanticNorm.normalized.location)
            next.location = semanticNorm.normalized.location;
          if (semanticNorm.normalized.productInterest)
            next.productInterest = semanticNorm.normalized.productInterest;
          return next;
        }

        return lead;
      });

      setNormalizedLeads(merged);
      setCleaningSummary({
        rowsProcessed: cleanStats.rowsProcessed,
        emailsCleaned: cleanStats.emailsCleaned,
        phonesCleaned: cleanStats.phonesCleaned,
        websitesCleaned: cleanStats.websitesCleaned,
        budgetsCleaned: cleanStats.budgetsCleaned,
        datesCleaned: cleanStats.datesCleaned,
        employeeCountsCleaned: cleanStats.employeeCountsCleaned,
        sourcesCleaned: cleanStats.sourcesCleaned,
        duplicatesDetected: duplicates,
        semanticsNormalized: allResults.length,
      });

      setProgress(null);
      setStage("complete");
    } catch (err) {
      console.error("Normalization error:", err);
      setError(err instanceof Error ? err.message : "Error normalizing leads");
      setProgress(null);
      setStage("mapping_review");
    }
  };

  const applyRanking = (
    leads: NormalizedLead[],
    signalsMap: Map<string, LeadAISignals>,
    failedIds: string[],
  ) => {
    setStage("scoring");
    setProgress({
      label: "Calculating lead scores...",
      detail: "Deterministic qualification",
      current: 0,
      total: 1,
    });

    const ranked = rankLeads(leads, { signalsByLeadId: signalsMap });

    setProgress({
      label: "Complete",
      detail: "Ranked leads ready",
      current: 1,
      total: 1,
    });

    setRankedLeads(ranked);
    setFailedAnalysisIds(failedIds);
    setProgress(null);
    setStage("ranking");
  };

  const analyzeAndRank = async (
    leads: NormalizedLead[],
    existingSignals: Map<string, LeadAISignals>,
    leadIdsToAnalyze: string[],
    previousFailed: string[] = [],
  ) => {
    setStage("analyzing");
    setError(null);

    const nextSignals = new Map(existingSignals);
    let nextFailed = previousFailed.filter(
      (id) => !leadIdsToAnalyze.includes(id),
    );

    // Preserve successful progress: already-analyzed leads count toward total
    const alreadyCompleted = leads.filter((l) =>
      nextSignals.has(l.id),
    ).length;
    const batches = chunkArray(
      leads.filter((lead) => leadIdsToAnalyze.includes(lead.id)),
      ANALYZE_BATCH_SIZE,
    );
    const totalBatches = batches.length;
    // Progress units = leads, so retries continue from alreadyCompleted
    const totalLeads = leads.length;
    let completedLeads = alreadyCompleted;
    let failedBatchCount = 0;

    setProgress({
      label: "Analyzing leads with AI...",
      detail: `AI signal extraction · ${completedLeads} / ${totalLeads} leads`,
      current: completedLeads,
      total: totalLeads,
      failed: 0,
    });

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const leadsForAnalysis = batch.map((lead) => ({
          id: lead.id,
          jobTitle: lead.jobTitle || null,
          notes: lead.notes || null,
        }));

        try {
          const response = await fetch("/api/ai/analyze-leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leads: leadsForAnalysis,
              batchSize: leadsForAnalysis.length,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to analyze leads for qualification");
          }

          const result = await response.json();
          const apiFailed: string[] = [...(result.failedLeadIds || [])];
          const newlySucceeded: string[] = [];

          for (const item of result.results || []) {
            if (apiFailed.includes(item.leadId)) continue;
            nextSignals.set(item.leadId, item.signals);
            newlySucceeded.push(item.leadId);
          }

          const batchFailed = batch
            .map((lead) => lead.id)
            .filter((id) => !newlySucceeded.includes(id));

          completedLeads += newlySucceeded.length;
          if (batchFailed.length > 0) {
            failedBatchCount += 1;
            nextFailed = [...new Set([...nextFailed, ...batchFailed])];
          }
        } catch (batchError) {
          console.error(`Analyze batch ${i + 1} failed:`, batchError);
          failedBatchCount += 1;
          for (const lead of batch) {
            if (!nextSignals.has(lead.id)) {
              nextFailed.push(lead.id);
            }
          }
          // Failed batch does not increase completedLeads
        }

        setAiSignalsByLeadId(new Map(nextSignals));
        setProgress({
          label: "Analyzing leads with AI...",
          detail: `AI signal extraction · ${completedLeads} / ${totalLeads} leads · ${i + 1} / ${totalBatches} batches attempted`,
          current: completedLeads,
          total: totalLeads,
          failed: failedBatchCount,
        });
      }

      nextFailed = [...new Set(nextFailed)];
      setAiSignalsByLeadId(nextSignals);
      applyRanking(leads, nextSignals, nextFailed);
    } catch (err) {
      console.error("Qualification analysis error:", err);
      nextFailed = [
        ...new Set([
          ...nextFailed,
          ...leadIdsToAnalyze.filter((id) => !nextSignals.has(id)),
        ]),
      ];
      setAiSignalsByLeadId(nextSignals);
      applyRanking(leads, nextSignals, nextFailed);
    }
  };

  const handleRankLeads = async () => {
    if (!normalizedLeads.length) return;

    const missingIds = normalizedLeads
      .filter((lead) => !aiSignalsByLeadId.has(lead.id))
      .map((lead) => lead.id);

    if (missingIds.length === 0) {
      applyRanking(normalizedLeads, aiSignalsByLeadId, failedAnalysisIds);
      return;
    }

    await analyzeAndRank(
      normalizedLeads,
      aiSignalsByLeadId,
      missingIds,
      failedAnalysisIds,
    );
  };

  const handleRetryFailed = async () => {
    if (!failedAnalysisIds.length || !normalizedLeads.length) return;
    await analyzeAndRank(
      normalizedLeads,
      aiSignalsByLeadId,
      failedAnalysisIds,
      failedAnalysisIds,
    );
  };

  const handleExportNormalized = () => {
    if (!normalizedLeads.length) return;
    exportNormalizedLeadsCsv(normalizedLeads, fileName || "leads");
  };

  const handleExportRanked = () => {
    if (!rankedLeads.length) return;
    exportRankedLeadsCsv(rankedLeads);
  };

  const handleReset = () => {
    setRawRows(null);
    setFileName("");
    setStage("upload");
    setColumnMappings([]);
    setNormalizedLeads([]);
    setRankedLeads([]);
    setAiSignalsByLeadId(new Map());
    setFailedAnalysisIds([]);
    setError(null);
    setProgress(null);
    setCleaningSummary(null);
  };

  const previewColumns = NORMALIZED_PREVIEW_COLUMNS.filter((col) =>
    normalizedLeads.some((lead) => lead[col]),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Lead Triage AI
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Clean and prepare your monthly lead data before AI analysis.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-slate-700" />
            AI Analyzer & Ranker
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-medium">Error</div>
            <div className="mt-1">{error}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="mt-3"
            >
              Start Over
            </Button>
          </div>
        )}

        {stage === "upload" && (
          <FileUploader onFileSelected={handleFileSelected} />
        )}

        {stage === "profiling" && progress && (
          <ProcessingProgress progress={progress} />
        )}
        {stage === "profiling" && !progress && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-8">
            <Loader className="h-5 w-5 animate-spin text-slate-600" />
            <span className="text-slate-600">Reading file...</span>
          </div>
        )}

        {stage === "mapping_ai" &&
          (progress ? (
            <ProcessingProgress progress={progress} />
          ) : (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-8">
              <Loader className="h-5 w-5 animate-spin text-slate-600" />
              <span className="text-slate-600">Mapping columns...</span>
            </div>
          ))}

        {stage === "mapping_review" && (
          <ColumnMappingReview
            mappings={columnMappings}
            onMappingsConfirmed={handleMappingsConfirmed}
            isLoading={false}
          />
        )}

        {stage === "deterministic_cleaning" &&
          (progress ? (
            <ProcessingProgress progress={progress} />
          ) : (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-8">
              <Loader className="h-5 w-5 animate-spin text-slate-600" />
              <span className="text-slate-600">
                Cleaning structured fields...
              </span>
            </div>
          ))}

        {stage === "semantic_normalization" && progress && (
          <ProcessingProgress progress={progress} />
        )}

        {(stage === "analyzing" || stage === "scoring") && progress && (
          <ProcessingProgress progress={progress} />
        )}

        {stage === "complete" && cleaningSummary && (
          <div className="space-y-6">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Processing Complete</div>
                <div className="mt-2 text-emerald-700/80">
                  <ul className="space-y-1">
                    <li>
                      ✓ {cleaningSummary.rowsProcessed.toLocaleString()} leads
                      processed
                    </li>
                    <li>
                      ✓ {cleaningSummary.emailsCleaned.toLocaleString()} emails
                      normalized
                    </li>
                    <li>
                      ✓ {cleaningSummary.phonesCleaned.toLocaleString()} phone
                      numbers normalized
                    </li>
                    <li>
                      ✓ {cleaningSummary.datesCleaned.toLocaleString()} dates
                      normalized
                    </li>
                    <li>
                      ✓ {cleaningSummary.sourcesCleaned.toLocaleString()}{" "}
                      sources normalized
                    </li>
                    <li>
                      ✓ {cleaningSummary.duplicatesDetected.toLocaleString()}{" "}
                      duplicates detected
                    </li>
                    <li>
                      ✓ {cleaningSummary.semanticsNormalized.toLocaleString()}{" "}
                      leads processed by AI
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Normalized Leads Preview
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleRankLeads}
                  className="
                    px-6 py-3
                    font-semibold
                    shadow-sm
                    transition-all
                    hover:-translate-y-0.5
                    hover:shadow-md
                  "
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Rank Leads
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                </div>
              </div>
              <DataTable
                rows={normalizedLeads as any}
                columns={[...previewColumns]}
              />
            </div>

            <ExportActions
              onExport={handleExportNormalized}
              exportLabel="Export Normalized CSV"
            />
          </div>
        )}

        {stage === "ranking" && rankedLeads.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <RankedLeadsTable
              rankedLeads={rankedLeads}
              failedLeadIds={failedAnalysisIds}
              analyzedCount={aiSignalsByLeadId.size}
              totalCount={normalizedLeads.length}
              isAnalyzing={false}
              onRetryFailed={handleRetryFailed}
              onExport={handleExportRanked}
              onReset={handleReset}
              onBack={() => setStage("complete")}
            />
          </div>
        )}
      </div>
    </main>
  );
}
