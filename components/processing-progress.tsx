"use client";

import { Loader } from "lucide-react";

export type WorkProgress = {
  label: string;
  detail?: string;
  /** Successfully completed units of work */
  current: number;
  total: number;
  /** Finished but failed units (do not count toward current) */
  failed?: number;
};

type ProcessingProgressProps = {
  progress: WorkProgress;
};

export function ProcessingProgress({ progress }: ProcessingProgressProps) {
  const total = Math.max(progress.total, 0);
  const current = Math.min(Math.max(progress.current, 0), total || 0);
  const failed = progress.failed ?? 0;
  const percent =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  // Never show 100% while there are still failures pending representation
  // or while current < total. Completion UIs clear this panel entirely.

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-8">
      <div className="flex items-center justify-center gap-3">
        <Loader className="h-5 w-5 animate-spin text-slate-600" />
        <span className="text-slate-600">{progress.label}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{progress.detail || "Progress"}</span>
          <span>
            {current.toLocaleString()} / {total.toLocaleString()}
            {total > 0 ? ` · ${percent}%` : ""}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-slate-600 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        {failed > 0 && (
          <p className="text-xs text-amber-700">
            {failed.toLocaleString()} batch
            {failed === 1 ? "" : "es"} failed — successful work is preserved
          </p>
        )}
      </div>
    </div>
  );
}
