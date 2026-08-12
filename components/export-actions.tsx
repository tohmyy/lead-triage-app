import { Download, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ExportActionsProps {
  onExport: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function ExportActions({ onExport, onReset, disabled = false }: ExportActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={onExport} disabled={disabled} className="gap-2">
        <Download className="h-4 w-4" />
        Export Clean CSV
      </Button>
      <Button type="button" variant="outline" onClick={onReset} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}
