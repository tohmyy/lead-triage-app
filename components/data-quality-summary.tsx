"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, XCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { DataIssue } from "@/lib/cleaning";

interface DataQualitySummaryProps {
  issues: DataIssue[];
}

function severityLabel(severity: DataIssue["severity"]) {
  if (severity === "error") return "High";
  if (severity === "warning") return "Medium";
  return "Low";
}

function severityVariant(severity: DataIssue["severity"]) {
  if (severity === "error") return "danger" as const;
  if (severity === "warning") return "warning" as const;
  return "success" as const;
}

function issueIcon(severity: DataIssue["severity"]) {
  if (severity === "error") return <XCircle className="h-4 w-4" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4" />;
  return <CheckCircle2 className="h-4 w-4" />;
}

export function DataQualitySummary({ issues }: DataQualitySummaryProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Data Quality</h2>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="default">{issues.length} checks</Badge>
          <ChevronDown
            className={`h-5 w-5 text-slate-500 transition-transform duration-200 ${
              isOpen ? "" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {issues.map((issue) => (
            <div key={issue.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  {issueIcon(issue.severity)}
                  <span>{issue.category}</span>
                </div>
                <Badge variant={severityVariant(issue.severity)}>{severityLabel(issue.severity)}</Badge>
              </div>

              <div className="mb-2 text-2xl font-semibold tracking-tight text-slate-900">{issue.count}</div>
              <p className="text-xs leading-5 text-slate-600">{issue.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
