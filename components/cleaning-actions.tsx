"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { CleaningAction } from "@/lib/cleaning";

interface CleaningActionsProps {
  actions: CleaningAction[];
  onToggle: (key: string) => void;
}

export function CleaningActions({ actions, onToggle }: CleaningActionsProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-900">Cleaning Actions</h2>

      <div className="space-y-3">
        {actions.map((action) => (
          <label
            key={action.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50"
          >
            <Checkbox checked={action.enabled} onCheckedChange={() => onToggle(action.key)} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{action.label}</div>
                <div className="text-xs font-medium text-slate-500">{action.affected} affected</div>
              </div>
              <p className="mt-1 text-xs text-slate-500">{action.description}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
