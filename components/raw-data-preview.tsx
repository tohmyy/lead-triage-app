"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { RawRow } from "@/types/lead";
import type { RowMap } from "@/lib/cleaning";

type RawDataPreviewProps = {
  rows: RawRow[];
  columns: string[];
  fileName: string;
  onContinue: () => void;
  onReset: () => void;
};

/**
 * Display uploaded CSV values without normalization or AI.
 * Values are stringified for table display only — no trim/case/format changes.
 */
function toDisplayRows(rows: RawRow[], columns: string[]): RowMap[] {
  return rows.map((row) => {
    const out: RowMap = {};
    for (const col of columns) {
      const value = row[col];
      if (value === null || value === undefined) {
        out[col] = "";
      } else {
        // Stringify only for rendering; do not trim or rewrite
        out[col] = typeof value === "string" ? value : String(value);
      }
    }
    return out;
  });
}

export function RawDataPreview({
  rows,
  columns,
  fileName,
  onContinue,
  onReset,
}: RawDataPreviewProps) {
  const displayRows = toDisplayRows(rows, columns);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Raw Data
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Exact values from your CSV — no cleaning or AI applied yet.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {rows.length.toLocaleString()} rows · {columns.length.toLocaleString()}{" "}
              columns
              {fileName ? ` · Source: ${fileName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={onReset}>
              Reset
            </Button>
            <Button
              type="button"
              onClick={onContinue}
              className="bg-slate-900 hover:bg-slate-800"
            >
              Continue to Normalize
            </Button>
          </div>
        </div>

        <DataTable rows={displayRows} columns={columns} />
      </div>
    </div>
  );
}
