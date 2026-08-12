"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnMapping, SemanticField } from "@/types/column";

interface ColumnMappingReviewProps {
  mappings: ColumnMapping[];
  onMappingsConfirmed: (mappings: ColumnMapping[]) => void;
  isLoading?: boolean;
}

const SEMANTIC_FIELDS: SemanticField[] = [
  "leadId",
  "createdAt",
  "name",
  "email",
  "phone",
  "company",
  "employeeCount",
  "website",
  "jobTitle",
  "industry",
  "location",
  "source",
  "budget",
  "productInterest",
  "notes",
  "other",
  "ignore",
];

function formatFieldName(field: SemanticField): string {
  const map: Record<SemanticField, string> = {
    leadId: "Lead ID",
    createdAt: "Created At",
    name: "Name",
    email: "Email",
    phone: "Phone",
    company: "Company",
    employeeCount: "Employee Count",
    website: "Website",
    jobTitle: "Job Title",
    industry: "Industry",
    location: "Location",
    source: "Lead Source",
    budget: "Budget",
    productInterest: "Product Interest",
    notes: "Lead Notes",
    other: "Other",
    ignore: "Ignore",
  };
  return map[field];
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 0.9) return "bg-emerald-50 text-emerald-700";
  if (confidence >= 0.7) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function getConfidenceBadgeVariant(confidence: number) {
  if (confidence >= 0.9) return "success" as const;
  if (confidence >= 0.7) return "warning" as const;
  return "danger" as const;
}

export function ColumnMappingReview({
  mappings,
  onMappingsConfirmed,
  isLoading,
}: ColumnMappingReviewProps) {
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>(mappings);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleFieldChange = (idx: number, newField: SemanticField) => {
    setLocalMappings((current) =>
      current.map((m, i) =>
        i === idx ? { ...m, normalizedField: newField } : m,
      ),
    );
  };

  const needsReview = localMappings.filter((m) => m.confidence < 0.7);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-slate-900">
          Column Mapping
        </h2>
        <p className="text-sm text-slate-600">
          Review and adjust how columns are interpreted
        </p>
        {needsReview.length > 0 && (
          <p className="mt-2 text-sm text-amber-700">
            ⚠ {needsReview.length} column{needsReview.length !== 1 ? "s" : ""} need review
          </p>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {localMappings.map((mapping, idx) => {
          const isExpanded = expandedIdx === idx;
          const isLowConfidence = mapping.confidence < 0.7;

          return (
            <div
              key={mapping.originalColumn}
              className={`rounded-lg border p-3 transition-colors ${
                isLowConfidence
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full text-left hover:bg-slate-100/50 rounded px-2 py-1 -mx-2 -my-1 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900">{mapping.originalColumn}</div>
                    <div className="text-xs text-slate-600">
                      → {formatFieldName(mapping.normalizedField)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={getConfidenceBadgeVariant(mapping.confidence)}>
                      {Math.round(mapping.confidence * 100)}%
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Mapping
                    </label>
                    <select
                      value={mapping.normalizedField}
                      onChange={(e) =>
                        handleFieldChange(idx, e.target.value as SemanticField)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      {SEMANTIC_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {formatFieldName(field)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      AI Reasoning
                    </label>
                    <p className="text-xs leading-relaxed text-slate-600">
                      {mapping.reason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={() => onMappingsConfirmed(localMappings)}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? "Processing..." : "Confirm Mappings"}
      </Button>
    </div>
  );
}
