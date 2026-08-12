import {
  qualificationConfig,
  type QualificationConfig,
} from "@/lib/qualification/config";
import type { LeadClassification } from "@/types/qualification";

export function classifyLead(
  total: number,
  config: QualificationConfig = qualificationConfig,
): LeadClassification {
  const clamped = Math.min(Math.max(Math.round(total), 0), 100);
  for (const threshold of config.classification.thresholds) {
    if (clamped >= threshold.min) {
      return threshold.label;
    }
  }
  return "DISQUALIFIED";
}
