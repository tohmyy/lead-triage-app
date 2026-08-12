import { scoreLead } from "@/lib/qualification/scoreLead";
import { UNKNOWN_AI_SIGNALS } from "@/lib/qualification/unknownSignals";
import {
  qualificationConfig,
  type QualificationConfig,
} from "@/lib/qualification/config";
import type { NormalizedLead } from "@/types/lead";
import type {
  LeadAISignals,
  RankedLead,
} from "@/types/qualification";

export type RankLeadsOptions = {
  /** Map of lead.id → AI signals. Missing entries use unknown/zero AI scoring. */
  signalsByLeadId: Map<string, LeadAISignals>;
  config?: QualificationConfig;
  now?: Date;
};

/**
 * Score and rank normalized leads.
 * Does not mutate the underlying NormalizedLead objects.
 */
export function rankLeads(
  leads: NormalizedLead[],
  options: RankLeadsOptions,
): RankedLead[] {
  const {
    signalsByLeadId,
    config = qualificationConfig,
    now = new Date(),
  } = options;

  const scored: RankedLead[] = leads.map((lead) => {
    const aiSignals = signalsByLeadId.get(lead.id) ?? UNKNOWN_AI_SIGNALS;
    const score = scoreLead(lead, aiSignals, config, now);
    return {
      rank: 0,
      lead,
      aiSignals,
      score,
      aiAnalyzed: signalsByLeadId.has(lead.id),
    };
  });

  scored.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (b.score.components.intent !== a.score.components.intent) {
      return b.score.components.intent - a.score.components.intent;
    }
    if (b.score.components.recency !== a.score.components.recency) {
      return b.score.components.recency - a.score.components.recency;
    }
    const aDate = a.lead.createdAt ? new Date(a.lead.createdAt).getTime() : 0;
    const bDate = b.lead.createdAt ? new Date(b.lead.createdAt).getTime() : 0;
    if (bDate !== aDate) return bDate - aDate;
    return a.lead.id.localeCompare(b.lead.id);
  });

  return scored.map((item, index) => ({
    ...item,
    rank: index + 1,
    // Mark as analyzed only when we have real cached signals (not unknown fallback alone)
    aiAnalyzed: signalsByLeadId.has(item.lead.id),
  }));
}
