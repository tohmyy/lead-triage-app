"use client";

import { ChevronDown, ChevronRight, Download, RotateCcw } from "lucide-react";
import { Fragment, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { qualificationConfig } from "@/lib/qualification/config";
import type { LeadClassification, RankedLead } from "@/types/qualification";

const EMPTY = "—";

function classificationVariant(
  classification: LeadClassification,
): "success" | "warning" | "danger" {
  if (classification === "CONTACT_NOW") return "success";
  if (classification === "NURTURE") return "warning";
  return "danger";
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function ScoreBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-medium text-slate-800">
          {value} / {max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LeadDetail({ ranked }: { ranked: RankedLead }) {
  const { score, aiSignals, aiAnalyzed } = ranked;
  const max = qualificationConfig.categoryMaximums;

  return (
    <div className="space-y-5 border-t border-slate-200 bg-slate-50/80 px-4 py-4 text-sm">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Overall Score
          </div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">
            {score.total}{" "}
            <span className="text-base font-normal text-slate-500">/ 100</span>
          </div>
        </div>
        <Badge variant={classificationVariant(score.classification)}>
          {formatLabel(score.classification)}
        </Badge>
        {!aiAnalyzed && (
          <Badge variant="warning">AI signals unavailable</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ScoreBar label="Budget Fit" value={score.components.budgetFit} max={max.budgetFit} />
        <ScoreBar label="Intent" value={score.components.intent} max={max.intent} />
        <ScoreBar label="Company Fit" value={score.components.companyFit} max={max.companyFit} />
        <ScoreBar label="Buyer Fit" value={score.components.buyerFit} max={max.buyerFit} />
        <ScoreBar label="Source" value={score.components.source} max={max.source} />
        <ScoreBar label="Recency" value={score.components.recency} max={max.recency} />
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Why this lead ranked this way
        </h4>
        <p className="mt-2 text-slate-700">{score.explanation}</p>
        {score.reasons.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
            {score.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI Signals
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Extracted from lead notes and job title — not independently verified.
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Intent</dt>
            <dd className="font-medium text-slate-800">
              {formatLabel(aiSignals.intent.level)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Requested pricing</dt>
            <dd className="font-medium text-slate-800">
              {aiSignals.intent.requestedPricing ||
              aiSignals.intent.requestedQuote
                ? "Yes"
                : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Requested meeting</dt>
            <dd className="font-medium text-slate-800">
              {aiSignals.intent.requestedMeeting ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Actively comparing</dt>
            <dd className="font-medium text-slate-800">
              {aiSignals.intent.activelyComparing ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Problem identified</dt>
            <dd className="font-medium text-slate-800">
              {aiSignals.intent.problemIdentified ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Timeline</dt>
            <dd className="font-medium text-slate-800">
              {formatLabel(aiSignals.timeline.value)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Urgency</dt>
            <dd className="font-medium text-slate-800">
              {formatLabel(aiSignals.timeline.urgency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Decision maker</dt>
            <dd className="font-medium text-slate-800">
              {formatLabel(aiSignals.buyer.decisionMaker)}
              {aiSignals.buyer.seniority !== "unknown"
                ? ` (${formatLabel(aiSignals.buyer.seniority)})`
                : ""}
            </dd>
          </div>
        </dl>
        {aiSignals.painPoints.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-slate-500">Pain points</div>
            <ul className="mt-1 list-disc pl-5 text-slate-700">
              {aiSignals.painPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

type RankedLeadsTableProps = {
  rankedLeads: RankedLead[];
  failedLeadIds: string[];
  analyzedCount: number;
  totalCount: number;
  isAnalyzing: boolean;
  onRetryFailed: () => void;
  onExport: () => void;
  onReset: () => void;
  onBack: () => void;
};

const BREAKDOWN_HEADERS = [
  "Budget Fit",
  "Intent",
  "Company Fit",
  "Buyer Fit",
  "Source",
  "Recency",
] as const;

export function RankedLeadsTable({
  rankedLeads,
  failedLeadIds,
  analyzedCount,
  totalCount,
  isAnalyzing,
  onRetryFailed,
  onExport,
  onReset,
  onBack,
}: RankedLeadsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const baseHeaders = [
    "Rank",
    "Name",
    "Email",
    "Company",
    "Job Title",
    "Score",
    "Classification",
  ];
  const headers = showScoreBreakdown
    ? [...baseHeaders, ...BREAKDOWN_HEADERS]
    : baseHeaders;
  const colSpan = headers.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Ranked Leads
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Hybrid qualification — AI extracts signals; scoring is deterministic.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            AI analysis {analyzedCount.toLocaleString()} /{" "}
            {totalCount.toLocaleString()} leads
            {failedLeadIds.length > 0
              ? ` · ${failedLeadIds.length.toLocaleString()} could not be analyzed`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowScoreBreakdown((v) => !v)}
          >
            {showScoreBreakdown
              ? "Hide Score Breakdown"
              : "Show Score Breakdown"}
          </Button>
          {failedLeadIds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={onRetryFailed}
              disabled={isAnalyzing}
            >
              Retry Failed
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-slate-100">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500 last:border-r-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankedLeads.map((ranked) => {
              const isOpen = expandedId === ranked.lead.id;
              const name = ranked.lead.name || EMPTY;
              const email = ranked.lead.email || EMPTY;

              return (
                <Fragment key={ranked.lead.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-200 even:bg-slate-50/60 hover:bg-slate-50"
                    onClick={() =>
                      setExpandedId(isOpen ? null : ranked.lead.id)
                    }
                  >
                    <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        #{ranked.rank}
                      </span>
                    </td>
                    <td className="border-r border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
                      {name}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {email}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {ranked.lead.company || EMPTY}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {ranked.lead.jobTitle || EMPTY}
                    </td>
                    <td className="border-r border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
                      {ranked.score.total}
                    </td>
                    <td
                      className={`px-3 py-2 ${showScoreBreakdown ? "border-r border-slate-200" : ""}`}
                    >
                      <Badge
                        variant={classificationVariant(
                          ranked.score.classification,
                        )}
                      >
                        {formatLabel(ranked.score.classification)}
                      </Badge>
                    </td>
                    {showScoreBreakdown && (
                      <>
                        <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                          {ranked.score.components.budgetFit}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                          {ranked.score.components.intent}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                          {ranked.score.components.companyFit}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                          {ranked.score.components.buyerFit}
                        </td>
                        <td className="border-r border-slate-200 px-3 py-2 text-sm text-slate-700">
                          {ranked.score.components.source}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {ranked.score.components.recency}
                        </td>
                      </>
                    )}
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={colSpan} className="p-0">
                        <LeadDetail ranked={ranked} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onExport}
          disabled={!rankedLeads.length}
          className="gap-2 bg-slate-900 hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Export Ranked Leads CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
