"use client";

import * as XLSX from "xlsx";
import { CheckCircle2, Loader, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ColumnMappingReview } from "@/components/column-mapping-review";
import { DataQualitySummary } from "@/components/data-quality-summary";
import { DataSummary } from "@/components/data-summary";
import { DataTable } from "@/components/data-table";
import { ExportActions } from "@/components/export-actions";
import { FileUploader } from "@/components/file-uploader";
import { Button } from "@/components/ui/button";
import { profileColumns } from "@/lib/data/profileColumns";
import { cleanDeterministic } from "@/lib/data/cleanDeterministic";
import { detectDuplicates } from "@/lib/data/detectDuplicates";
import { mapColumnsWithAI } from "@/lib/ai/mapColumns";
import { normalizeLeadsWithAI } from "@/lib/ai/normalizeLeads";
import type { ColumnMapping, SemanticField } from "@/types/column";
import type { NormalizedLead, RawRow } from "@/types/lead";
import Papa from "papaparse";

type ProcessingStage = "upload" | "profiling" | "mapping_ai" | "mapping_review" | "deterministic_cleaning" | "semantic_normalization" | "complete";

export default function Home() {
  const [rawRows, setRawRows] = useState<RawRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [stage, setStage] = useState<ProcessingStage>("upload");
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [cleanedRows, setCleanedRows] = useState<RawRow[] | null>(null);
  const [normalizedLeads, setNormalizedLeads] = useState<NormalizedLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [cleaningSummary, setCleaningSummary] = useState<{
    trimmed: number;
    emailsCleaned: number;
    phonesCleaned: number;
    numericsCleaned: number;
    duplicatesDetected: number;
    semanticsNormalized: number;
  } | null>(null);

  // Handle file upload
  const handleFileSelected = async (file: File) => {
    setError(null);
    setStage("profiling");

    try {
      // Parse CSV
      const text = await file.text();
      Papa.parse(text, {
        complete: async (results: { data: any[] }) => {
          const rows = results.data
            .filter((row) => Array.isArray(row) ? row.some((v) => v) : Object.values(row).some((v) => v))
            .map((row) => {
              if (Array.isArray(row)) {
                // Convert array to object using first row as headers
                return {};
              }
              return row as RawRow;
            });

          if (!rows.length) {
            setError("CSV appears to be empty");
            setStage("upload");
            return;
          }

          // Get headers from first row
          const headers = Object.keys(rows[0]);
          if (!headers.length) {
            setError("Unable to detect columns in CSV");
            setStage("upload");
            return;
          }

          setFileName(file.name);
          setRawRows(rows);

          // Move to AI column mapping
          setStage("mapping_ai");
          await performAIColumnMapping(rows);
        },
        header: true,
        skipEmptyLines: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error parsing CSV";
      setError(msg);
      setStage("upload");
    }
  };

  // AI column mapping
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
      setStage("mapping_review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error mapping columns");
      setStage("upload");
    }
  };

  // User confirms mappings
  const handleMappingsConfirmed = async (mappings: ColumnMapping[]) => {
    setColumnMappings(mappings);
    setStage("deterministic_cleaning");

    try {
      if (!rawRows) throw new Error("No data to clean");

      // Apply deterministic cleaning
      const { cleaned, stats } = cleanDeterministic(rawRows, mappings);
      setCleanedRows(cleaned);

      // Detect duplicates
      const { totalDuplicateRecords } = detectDuplicates(cleaned, mappings);

      // Move to semantic normalization
      setProgress({ current: 0, total: cleaned.length });
      setStage("semantic_normalization");

      await performSemanticNormalization(cleaned, mappings, stats, totalDuplicateRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error during cleaning");
      setStage("upload");
    }
  };

  // Semantic normalization with progress
  const performSemanticNormalization = async (
    rows: RawRow[],
    mappings: ColumnMapping[],
    cleanStats: any,
    duplicates: number,
  ) => {
    try {
      // Prepare leads for normalization
      const leadsForNorm = rows.map((row, idx) => ({
        id: String(idx),
        jobTitle: row[mappings.find((m) => m.normalizedField === "jobTitle")?.originalColumn || ""],
        industry: row[mappings.find((m) => m.normalizedField === "industry")?.originalColumn || ""],
        location: row[mappings.find((m) => m.normalizedField === "location")?.originalColumn || ""],
        productInterest: row[mappings.find((m) => m.normalizedField === "productInterest")?.originalColumn || ""],
        notes: row[mappings.find((m) => m.normalizedField === "notes")?.originalColumn || ""],
      }));

      const normResponse = await fetch("/api/ai/normalize-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsForNorm, batchSize: 20 }),
      });

      if (!normResponse.ok) {
        throw new Error("Failed to normalize leads");
      }

      const normResult = await normResponse.json();
      setProgress(null);

      // Build normalized lead objects
      const normalized: NormalizedLead[] = rows.map((row, idx) => {
        const semanticNorm = normResult.results.find((r: any) => r.leadId === String(idx));
        const baseNorm: NormalizedLead = {
          id: String(idx),
        };

        // Map fields based on user's column mappings
        for (const mapping of mappings) {
          const value = row[mapping.originalColumn];
          const key = mapping.normalizedField;
          if (key !== "ignore" && key !== "other") {
            (baseNorm as any)[key] = value || null;
          }
        }

        // Apply AI semantic normalizations
        if (semanticNorm?.normalized) {
          Object.assign(baseNorm, semanticNorm.normalized);
        }

        return baseNorm;
      });

      setNormalizedLeads(normalized);
      setCleaningSummary({
        trimmed: cleanStats.trimmed,
        emailsCleaned: cleanStats.emailsCleaned,
        phonesCleaned: cleanStats.phonesCleaned,
        numericsCleaned: cleanStats.numericsCleaned,
        duplicatesDetected: duplicates,
        semanticsNormalized: normResult.totalProcessed,
      });

      setStage("complete");
    } catch (err) {
      console.error("Normalization error:", err);
      setError(err instanceof Error ? err.message : "Error normalizing leads");
      setStage("mapping_review");
    }
  };

  const handleExport = () => {
    if (!normalizedLeads.length) return;

    const rows = normalizedLeads.map((lead) => {
      const row: Record<string, string> = {};
      for (const key in lead) {
        if (lead[key as keyof NormalizedLead] !== undefined && lead[key as keyof NormalizedLead] !== null) {
          row[key] = String(lead[key as keyof NormalizedLead]);
        }
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "normalized_leads");

    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.replace(/\.csv$/i, "") + "-normalized.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setRawRows(null);
    setFileName("");
    setStage("upload");
    setColumnMappings([]);
    setCleanedRows(null);
    setNormalizedLeads([]);
    setError(null);
    setProgress(null);
    setCleaningSummary(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Lead Triage AI</h1>
            <p className="mt-1 text-sm text-slate-600">
              Clean and prepare your monthly lead data before AI analysis.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-slate-700" />
            AI Cleaner · v2
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="font-medium">Error</div>
            <div className="mt-1">{error}</div>
            <Button type="button" variant="outline" size="sm" onClick={handleReset} className="mt-3">
              Start Over
            </Button>
          </div>
        )}

        {stage === "upload" && <FileUploader onFileSelected={handleFileSelected} />}

        {stage === "profiling" && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-8">
            <Loader className="h-5 w-5 animate-spin text-slate-600" />
            <span className="text-slate-600">Analyzing CSV structure...</span>
          </div>
        )}

        {stage === "mapping_ai" && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-8">
            <Loader className="h-5 w-5 animate-spin text-slate-600" />
            <span className="text-slate-600">Using AI to understand columns...</span>
          </div>
        )}

        {stage === "mapping_review" && (
          <ColumnMappingReview
            mappings={columnMappings}
            onMappingsConfirmed={handleMappingsConfirmed}
            isLoading={false}
          />
        )}

        {stage === "deterministic_cleaning" && (
          <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white p-8">
            <Loader className="h-5 w-5 animate-spin text-slate-600" />
            <span className="text-slate-600">Cleaning data deterministically...</span>
          </div>
        )}

        {stage === "semantic_normalization" && (
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-8">
            <div className="flex items-center justify-center gap-3">
              <Loader className="h-5 w-5 animate-spin text-slate-600" />
              <span className="text-slate-600">Normalizing leads with AI...</span>
            </div>
            {progress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Progress</span>
                  <span>
                    {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-slate-600 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {stage === "complete" && cleaningSummary && (
          <div className="space-y-6">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Processing Complete</div>
                <div className="mt-2 text-emerald-700/80">
                  <ul className="space-y-1">
                    <li>✓ {cleaningSummary.trimmed.toLocaleString()} values trimmed</li>
                    <li>✓ {cleaningSummary.emailsCleaned.toLocaleString()} emails normalized</li>
                    <li>✓ {cleaningSummary.phonesCleaned.toLocaleString()} phone numbers normalized</li>
                    <li>✓ {cleaningSummary.duplicatesDetected.toLocaleString()} duplicates detected</li>
                    <li>✓ {cleaningSummary.semanticsNormalized.toLocaleString()} leads processed by AI</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">
                Normalized Leads Preview
              </h2>
              <DataTable rows={normalizedLeads as any} columns={Object.keys(normalizedLeads[0] || {})} />
            </div>

            <ExportActions onExport={handleExport} onReset={handleReset} />
          </div>
        )}
      </div>
    </main>
  );
}
