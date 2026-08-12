"use client";

import { ChevronDown, FileSpreadsheet, FileWarning, Rows3, TableProperties, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";

interface DataSummaryProps {
  fileName: string;
  rows: number;
  columns: number;
  duplicateRows: number;
  rowsWithMissingValues: number;
  invalidEmailCount: number;
  invalidPhoneCount: number;
}

export function DataSummary({
  fileName,
  rows,
  columns,
  duplicateRows,
  rowsWithMissingValues,
  invalidEmailCount,
  invalidPhoneCount,
}: DataSummaryProps) {
  const [isOpen, setIsOpen] = useState(true);
  const issueCount = rowsWithMissingValues + invalidEmailCount + invalidPhoneCount + duplicateRows;
  const summaryStats = [
    { label: "Rows", value: rows.toLocaleString(), icon: Rows3 },
    { label: "Columns", value: columns.toString(), icon: TableProperties },
    { label: "Duplicates", value: duplicateRows.toLocaleString(), icon: Users },
    { label: "Missing Values", value: rowsWithMissingValues.toLocaleString(), icon: FileWarning },
    { label: "Invalid Emails", value: invalidEmailCount.toLocaleString(), icon: TriangleAlert },
    { label: "Invalid Phones", value: invalidPhoneCount.toLocaleString(), icon: TriangleAlert },
    { label: "Issues", value: issueCount.toLocaleString(), icon: TriangleAlert },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          <div className="rounded-md bg-slate-100 p-2 text-slate-700">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">{fileName}</div>
            <div className="text-xs text-slate-500">Uploaded lead export</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="info">Active dataset</Badge>
          <ChevronDown
            className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
              isOpen ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {summaryStats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                <span>{label}</span>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
