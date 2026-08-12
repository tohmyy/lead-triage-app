import {
  qualificationConfig,
  type QualificationConfig,
} from "@/lib/qualification/config";
import { classifyLead } from "@/lib/qualification/classifyLead";
import type {
  LeadAISignals,
  LeadScore,
  ScoreComponents,
} from "@/types/qualification";
import type { NormalizedLead } from "@/types/lead";

function parseBudget(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/** Use lower bound of ranges like "10-50" or "50+". */
export function parseEmployeeLowerBound(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).toLowerCase().replace(/,/g, "");
  const match = str.match(/(\d+)/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isFinite(num) ? num : null;
}

function scoreBudgetFit(
  lead: NormalizedLead,
  config: QualificationConfig,
): number {
  const budget = parseBudget(lead.budget);
  if (budget === null) return config.budget.missingScore;

  for (const range of config.budget.ranges) {
    if (budget >= range.min && budget <= range.max) {
      return Math.min(range.points, config.budget.maxPoints);
    }
  }
  return config.budget.missingScore;
}

function scoreCompanyFit(
  lead: NormalizedLead,
  config: QualificationConfig,
): number {
  const employees = parseEmployeeLowerBound(lead.employeeCount);
  if (employees === null) return config.companyFit.missingScore;

  for (const range of config.companyFit.employeeRanges) {
    if (employees >= range.min && employees <= range.max) {
      return Math.min(range.points, config.companyFit.maxPoints);
    }
  }
  return config.companyFit.missingScore;
}

function scoreBuyerFit(
  signals: LeadAISignals,
  config: QualificationConfig,
): number {
  const points =
    config.buyerFit.decisionMakerPoints[signals.buyer.decisionMaker] ?? 0;
  return Math.min(points, config.buyerFit.maxPoints);
}

/**
 * Intent scoring from structured AI signals.
 * requestedPricing and requestedQuote share a single award.
 * Intent level only adds "general research" when no stronger boolean signals fire.
 */
export function scoreIntent(
  signals: LeadAISignals,
  config: QualificationConfig = qualificationConfig,
): number {
  const w = config.intent.weights;
  let points = 0;
  let strongSignal = false;

  if (signals.intent.readyToPurchase) {
    points += w.readyToPurchase;
    strongSignal = true;
  }

  if (signals.intent.requestedPricing || signals.intent.requestedQuote) {
    points += w.requestedPricingOrQuote;
    strongSignal = true;
  }

  if (signals.intent.requestedMeeting) {
    points += w.requestedMeeting;
    strongSignal = true;
  }

  if (signals.intent.activelyComparing) {
    points += w.activelyComparing;
    strongSignal = true;
  }

  if (signals.intent.problemIdentified) {
    points += w.problemIdentified;
    strongSignal = true;
  }

  if (signals.timeline.value !== "unknown") {
    points += w.definedTimeline;
    strongSignal = true;
  }

  if (
    !strongSignal &&
    (signals.intent.level === "medium" || signals.intent.level === "high")
  ) {
    points += w.generalResearch;
  }

  return Math.min(Math.max(points, 0), config.intent.maxPoints);
}

function scoreSource(
  lead: NormalizedLead,
  config: QualificationConfig,
): number {
  if (!lead.source) return config.source.unknownScore;
  const key = String(lead.source).toLowerCase().trim();
  const points = config.source.scores[key] ?? config.source.unknownScore;
  return Math.min(points, config.source.maxPoints);
}

export function scoreRecency(
  lead: NormalizedLead,
  now: Date = new Date(),
  config: QualificationConfig = qualificationConfig,
): number {
  if (!lead.createdAt) return config.recency.missingScore;

  const created = new Date(lead.createdAt);
  if (Number.isNaN(created.getTime())) return config.recency.missingScore;

  const days = Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) return config.recency.maxPoints;

  for (const band of config.recency.bands) {
    if (days <= band.maxDaysInclusive) {
      return Math.min(band.points, config.recency.maxPoints);
    }
  }
  return Math.min(config.recency.olderPoints, config.recency.maxPoints);
}

function buildReasons(
  components: ScoreComponents,
  signals: LeadAISignals,
  config: QualificationConfig,
): string[] {
  const reasons: string[] = [];
  const max = config.categoryMaximums;

  if (components.budgetFit >= max.budgetFit * 0.8) {
    reasons.push("Strong budget fit");
  } else if (components.budgetFit === 0) {
    reasons.push("No budget provided");
  }

  if (components.buyerFit >= 12) reasons.push("Decision-maker");
  else if (components.buyerFit === 0) reasons.push("Unknown buyer authority");

  if (signals.intent.readyToPurchase) reasons.push("Ready to purchase");
  if (signals.intent.requestedPricing || signals.intent.requestedQuote) {
    reasons.push("Requested pricing");
  }
  if (signals.intent.requestedMeeting) reasons.push("Requested meeting/demo");
  if (signals.intent.activelyComparing) {
    reasons.push("Actively comparing providers");
  }
  if (signals.intent.problemIdentified) reasons.push("Clear business problem");
  if (signals.timeline.value !== "unknown") {
    reasons.push(
      `Purchase timeline: ${signals.timeline.value.replace(/_/g, " ")}`,
    );
  }

  if (components.companyFit >= max.companyFit * 0.8) {
    reasons.push("Good company-size fit");
  }
  if (components.source >= 8) reasons.push("Strong lead source");
  if (components.recency >= 4) reasons.push("Recent lead");
  if (components.intent === 0 && !reasons.some((r) => r.includes("budget"))) {
    // keep list informative when intent is empty
  }

  for (const signal of signals.explanationSignals.slice(0, 3)) {
    if (!reasons.includes(signal)) reasons.push(signal);
  }

  return reasons;
}

function buildExplanation(
  total: number,
  classification: LeadScore["classification"],
  components: ScoreComponents,
  signals: LeadAISignals,
  reasons: string[],
): string {
  const label = classification.replace(/_/g, " ");
  const highlights = reasons.slice(0, 4).join("; ");
  const intentBits: string[] = [];

  if (signals.intent.activelyComparing) intentBits.push("active provider comparison");
  if (signals.intent.problemIdentified) intentBits.push("an identified problem");
  if (signals.timeline.value !== "unknown") {
    intentBits.push(
      `a timeline of ${signals.timeline.value.replace(/_/g, " ")}`,
    );
  }
  if (signals.intent.requestedPricing || signals.intent.requestedQuote) {
    intentBits.push("a request for pricing");
  }

  const notesClause =
    intentBits.length > 0
      ? ` Notes indicate ${intentBits.join(", ")}.`
      : components.intent === 0
        ? " No clear buying signals were extracted from the notes."
        : "";

  const fitClause =
    highlights.length > 0 ? ` Key factors: ${highlights}.` : "";

  return `${label} — ${total}/100.${fitClause}${notesClause}`.trim();
}

export function scoreLead(
  lead: NormalizedLead,
  aiSignals: LeadAISignals,
  config: QualificationConfig = qualificationConfig,
  now: Date = new Date(),
): LeadScore {
  const components: ScoreComponents = {
    budgetFit: scoreBudgetFit(lead, config),
    intent: scoreIntent(aiSignals, config),
    companyFit: scoreCompanyFit(lead, config),
    buyerFit: scoreBuyerFit(aiSignals, config),
    source: scoreSource(lead, config),
    recency: scoreRecency(lead, now, config),
  };

  const sum =
    components.budgetFit +
    components.intent +
    components.companyFit +
    components.buyerFit +
    components.source +
    components.recency;

  const total = Math.min(Math.max(sum, 0), 100);
  const classification = classifyLead(total, config);
  const reasons = buildReasons(components, aiSignals, config);
  const explanation = buildExplanation(
    total,
    classification,
    components,
    aiSignals,
    reasons,
  );

  return {
    total,
    components,
    classification,
    explanation,
    reasons,
  };
}
